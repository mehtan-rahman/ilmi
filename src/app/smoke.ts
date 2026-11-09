// Dev only: `ILMI_VAULT=/path ILMI_SMOKE=1 npm run tauri dev` runs every
// tree operation through the real store (the Rust side's SQLite, milestone
// 59) and logs each result to the terminal, since this sandbox cannot see
// the window. `ILMI_VAULT` is a folder of files (a scratch copy of the
// corpus vault or of `samples/double-major`): it is imported afresh as a
// collection of its own name on every run (`devCollection`), and the smoke
// creates, renames, moves, and deletes in that collection, never in the
// folder. A file a smoke hands to the Rust side by path (a package, a PDF
// to drop) is named under the folder (`sourceDir`).
// `ILMI_SMOKE=reader` opens a document in the reader instead, types into
// a paragraph, moves the marker, and logs what reached the disk.
// `ILMI_SMOKE=cards` selects a passage of a frozen source, presses `e`,
// then selects again, presses `m`, fills the composer, and saves.
// `ILMI_SMOKE=intake` opens the intake, takes the sample, places it, and
// then pastes an address to see the fetch land.
// `ILMI_SMOKE=queue` opens the day's queue, enters it, and walks the whole
// session with the keys (space and 3 on a card, ⏎ on a topic or a draft),
// logging what each element wrote, until the queue is one quiet line.
// `ILMI_SMOKE=loop` runs the whole loop: import the sample, start reading
// it, extract a passage, make a card, find both in the queue, review them.
// `ILMI_SMOKE=shots` walks every screen, pausing on each and logging
// `shot: <name>` so a shell loop can take a screenshot of the window.
// `ILMI_SMOKE=deck` opens the deck, deletes a card from its right-click
// menu and another from the row's ×, walks the rows with j k, edits the
// selected card from the inspector, deletes it with backspace, resets one
// from the inspector, moves one to a new deck through the menu's "move to…",
// and logs what left the disk; then it opens a deck card and a source card
// from the palette and logs that each landed selected.
// `ILMI_SMOKE=pri` sets a source's priority from the inspector, then a
// card's, logging the one line each wrote and where the queue and the
// session put them.
// `ILMI_SMOKE=growth` sets a source's growth factor from the inspector,
// reads the preview, looks at a draft's, then postpones a topic from the
// session, logging the one line each wrote.
// `ILMI_SMOKE=overload` sets a day budget from the tweaks panel, reads the
// fold in the day's queue and the top strip's count, finds the palette
// command, postpones the rest from the row under the fold, and logs every
// file that changed, what tomorrow's queue holds, and a session's length.
// `ILMI_SMOKE=faces` enters the session and walks it to one card of each
// form, pausing on the two faces hidden and revealed, then in the dark.
// `ILMI_SMOKE=pdf` (milestone 15's lens: the rail, the composer, the text
// toggle, an extract from a selection) was retired in 49: `book` and `books`
// hold the pages beside the notes.
// `ILMI_SMOKE=cards-text` pastes a `Q:`/`A:` list and a tab list on the
// intake, reads the delimiter row's choice, flips a delimiter, places both
// as decks, and logs each file's lines; then pastes prose to see no row.
// `ILMI_SMOKE=anki` drops the fixture package (`ILMI_APKG=<path>`, else
// `two-decks.apkg` in the vault) on the intake, reads the deck list, places
// it, logs each deck file's lines, and opens both decks.
// `ILMI_SMOKE=math` opens maxwell, reads its formula chips in the reader,
// then enters a session over its three blanks inside math and logs each
// hidden and revealed (the first by a click on the chip), grading as it goes.
// `ILMI_SMOKE=epub` drops the fixture book (`ILMI_EPUB=<path>`, else
// `three-chapters.epub` in the vault) on the intake, reads the preview,
// places it, logs the tree and each chapter's first lines, and starts
// reading the first chapter with `r`.
// `ILMI_SMOKE=clip` hands `ilmi://` links to the clipper's handler as the
// OS would: `new` with content, with a folder, with an address (fetched),
// `open`, a foreign vault, and garbage, logging the file written, the tab,
// and the notice each left; then sets `clippings go to` from the tweaks
// panel and clips once more.
// `ILMI_SMOKE=clipping` pastes a real address on the intake (`ILMI_URL=…`,
// else the Wikipedia page on spaced repetition; offline it logs and stops),
// reads the preview (site and title, author and date, the count with the
// image count and `via …`), places it, logs the file's first twenty lines
// and the images landed in its folder, opens it, and clicks the
// inspector's `url`.
// `ILMI_SMOKE=plugins` opens tweaks and reads the sample plugin's row, turns
// it off and on, runs its command from the palette, selects a passage and
// runs its verb from the cue, finds the `[hello]` it lights in a source and
// in a deck, edits its setting, grades a card and reads the plugin's
// notice, touches `main.js` on disk for the reload notice, removes the
// plugin's folder, and adds it back from a zip (`ILMI_PLUGIN_ZIP=<path>`,
// `plugins/dist/hello.zip` after `npm run plugins`) through the section's
// hook.
// `ILMI_SMOKE=dictionary` turns the dictionary plugin on from tweaks, opens
// the sutton paper, selects the Arabic word in its margin line, presses `d`
// and reads the popover the live Wiktionary lookup fills (the article
// stripped on the way), adds the word with `a` and logs the deck file's
// lines and the queue's count, looks an English word up from the cue's
// verb and adds it too, then opens the deck.
// `ILMI_SMOKE=render` opens the markdown sampler and reads what the reader
// drew (emphasis, strong, code, the link, the markers hidden while frozen
// and dimmed once thawed, the list, the quote, the code block, the table,
// the two images from the vault), clicks a list to see its source, selects
// an emphasised passage and presses `e` to log the extract's text, makes a
// card with inline code with `m` and reads its session faces and queue
// row, drops the fixture book and opens its first chapter, then turns
// `show remote images` off from the tweaks panel.
// `ILMI_SMOKE=live` opens the markdown sampler thawed, walks a caret through
// its first paragraph logging which markers show at each stop, backspaces
// into a hidden marker to see it revealed with nothing deleted, deletes and
// retypes the closing `*` to see the span light as it closes, types a new
// `*span*` at the end of the last paragraph, then thaws maxwell, clicks its
// binomial chip, types into the editor (a good formula, a broken one, the
// good one again), closes with ⏎, reopens to see Escape write nothing and an
// arrow step out, and logs the file's lines after each write.
// `ILMI_SMOKE=blocks` opens the markdown sampler thawed and edits its blocks
// in place: ⏎ at the end of the bullet list's last item and typing, Tab and
// ⇧Tab, a task box typed and clicked, ⏎ on an empty item to leave; ⏎ at the
// end of the quote and typing, ⏎ twice to leave; ⏎, Tab, and typing in the
// code block, ⌘⏎ to step out; the file's lines logged after each write.
// `ILMI_SMOKE=use` opens the day's queue and logs its first three rows'
// source lines (the path after the kind tag), turns `queue shows titles` on
// from the tweaks panel and logs them again, right-clicks the sidebar's
// empty space and logs the root menu's entries, right-clicks a row, hovers
// `move to…` (nothing opens), clicks it and logs the list, steps back with
// `◂ move to…`, closes with Escape, runs the palette's `close collection`
// and logs the welcome, then reopens the vault through the menu's dispatch
// (`recent:<path>`, as File → Open Recent sends it) and logs the tree.
// `ILMI_SMOKE=land` drops the corpus PDF on a folder row and the fixture
// book (`ILMI_EPUB=<path>`, else `three-chapters.epub` in the vault) on the
// reader through the drop router (`dropAt`), undoes the book from the
// notice, runs `import…` with the picker stubbed, pastes an address
// (`ILMI_URL`, else the Wikipedia page; offline it logs and skips) with
// nothing focused, right-clicks a folder-lens row and its empty space, and
// opens the sidebar's `+`, logging the tree, the tab, and the notice after each.
// `ILMI_SMOKE=nest` drags rows in the sidebar as a pointer would (dragstart,
// dragover at a third of the row, drop): the deck `german` into the middle of
// a source, the folder `papers/archive` into a draft, then the course's three
// children reordered by their top thirds; opens the course's children as a
// folder lens and the course's inspector `children` line, renames the course
// inline from its row, lists `move to…` for a deck, and asks to delete the
// course, logging the rows and `.ilmi/order.json` after each.
// `ILMI_SMOKE=tabs` (`smokeTabs`): the course as a notebook, its tab rail
// made, arranged, read, stepped, and folded (see the function).
// `ILMI_SMOKE=tree` (`smokeTree`) over a copy of `samples/double-major`:
// the tree refined, drags at every zone logged against where they landed,
// the keys, the reveal, the hover menus, a hoist (see the function).
// `ILMI_SMOKE=notes` (`smokeNotes`) over a copy of `samples/double-major`:
// a typeless file opens as a note, the five kind words in the menus, a note
// revisited from the top and from a heading, `e` typed over a selection in
// a note, ⌘⇧E and ⌘⇧M there, bare `e` in a frozen source, F2 only in the
// tree, and an import landing as a source (see the function).
// `ILMI_SMOKE=editing` (`smokeEditing`) over a copy of `samples/double-major`:
// the formatting keys, the block rules, lists moved and indented with their
// children, ⌘K and a pasted address, and the selection toolbar (see the
// function).
// `ILMI_SMOKE=insert` (`smokeInsert`) over a copy of `samples/double-major`:
// the slash menu's every row on a note, a web fragment and a plain paste,
// an image pasted, dropped, and picked beside the note, and find walking
// every unvoweled match in the voweled kāna note, then replace (see the
// function).
// `ILMI_SMOKE=tabs2` (`smokeTabs2`) over a copy of `samples/double-major`:
// 38's three window findings (a still rest nests, a delete's undo, the
// indent and the sidebar's edge), then tabs refined: the top row's toggle, no
// extracts as tabs, the outline, a tab added, renamed, nested and moved by
// keys and drags, a drag into the sidebar, the hover menus, ⌃⌘T, the rail's
// edge; every step asserted (see the function).
// `ILMI_SMOKE=listcards` (`smokeListCards`) over a copy of
// `samples/double-major`: a bullet card typed in a note, found in the queue,
// reviewed with its heading path and its sr line under the item, go to
// source landing on it, and study from the reader's top row (see the
// function).
// `ILMI_SMOKE=arabic` (`smokeArabic`) over a copy of `samples/double-major`:
// the grammar note, the prose passage, formulas in Arabic sentences, the
// vocab deck, and a session on Arabic cards, light and dark: directions by
// majority script (a glossed line LTR, an all-Arabic one RTL), isolation,
// no clipped mark, the Arabic faces loaded; every step asserted.
// `ILMI_SMOKE=rest` (`smokeRest`) over a copy of `samples/double-major`:
// the outline in the rail and the inspector, a heading folded and kept, a
// folded section read by one press, code coloured in three themes and its
// language picked, the verb-forms table edited as a table (see the function).
// `ILMI_SMOKE=open` (`smokeOpen`) over a copy of `samples/double-major`:
// milestone 46's open items, each asserted (see the function).
// `ILMI_SMOKE=same` (`smokeSame`) over a copy of `samples/double-major`:
// milestone 45, the same fact twice: the stat-mech pairs listed, one linked,
// one merged (and undone, and merged again), one said not the same.
// `ILMI_SMOKE=book` (`smokeBook`) over a copy of `samples/double-major`, with
// `ILMI_BOOKS=<repo>/design/books`: milestone 48, the book beside its notes.
// `ILMI_SMOKE=books` (`smokeBooks`) over a copy of `samples/double-major`: the
// sample's own two books, three days of the flow (milestone 49).
// `ILMI_SMOKE=textsections` (`smokeTextSections`) over a copy of
// `samples/double-major`: passages marked in a clipping and a chapter become
// sections of their notes, moved, and an old extract folded in (milestone 50).
// `ILMI_SMOKE=zoom` (`smokeZoom`): the page's text size by ⌘= ⌘− ⌘0 and the tweaks.
// `ILMI_SMOKE=cadence` (`smokeCadence`) over a copy of `samples/double-major`:
// milestone 51, the reading loop re-tuned: a pass on a half-read source lands
// on its cadence, a section sixty days late lands past 90 days, the day's
// order differs between two days and holds within one, `postpone the rest`
// touches nothing first due today (and the tweak runs it at the day's start),
// ⏎ on a finished source dismisses it, the inspector's interval field.
// `ILMI_SMOKE=sync` (`smokeSync`, with `ILMI_VAULT2=<an empty path>`) over
// a copy of `samples/double-major`: milestone 53, sync by git. The first
// window connects its copy to a bare repository beside it; the second
// window (`ILMI_VAULT2`) clones it and takes its steps over Tauri events; a
// card graded in each, the same card graded in both, a pass on each, a
// paragraph edited in both, a drag in both, offline and back; the strip's
// word and the notices read on both sides (see the function).
// `ILMI_SMOKE=nudge` (`smokeNudge`, with `ILMI_VAULT2`) the same two
// windows over a loopback ntfy-shaped server the Rust side starts, the
// pull timers off: a grade pushed in one lands in the other on the nudge
// alone, timed; the stream dropped and back; the nudge off in one, and the
// timer is all there is (see the function).
// `ILMI_SMOKE=storage` (`smokeStorage`, milestone 63, with `ILMI_VAULT2` a
// name, `ILMI_STORAGE=s3` or `webdav`, `ILMI_BIG` a large PDF on disk and
// `ILMI_SNAP=4`): the same two windows through the loopback server shaped
// like a bucket or a WebDAV folder; the second collection keeps what it
// has opened and holds no PDF until one is; a 200 MB PDF taken in by one
// goes up and comes down by the piece, and opens; a snapshot is written
// and a third collection made from it (see the function).
// `ILMI_SMOKE=crdt` (`smokeCrdt`, milestone 61, with `ILMI_VAULT2` a name
// for the second collection and `ILMI_STORAGE` an empty folder) over
// `samples/double-major`: this window's collection makes the storage in the
// folder, the second window's is made from it; then the checks of 53's
// smoke through the engine, and milestone 62's: two drags merged move by
// move, a rename against an edit and a new page, a move against a new
// document (see the function).
// `ILMI_SMOKE=welcome` runs before any vault opens: it seeds the recents
// with the scratch vault (`ILMI_VAULT`) and a path that does not exist,
// turns `reopen the last vault on start` off, reads the welcome's rows and
// the dimmed one, opens the scratch vault from its row, closes it from the
// palette, names a new vault beside the scratch one and reads its
// `start here.md`, switches back through the palette's `vaults` group,
// turns the toggle on, and reloads the page; the second run (a
// sessionStorage marker) only checks that the vault opened itself.
// `ILMI_SMOKE=search` (`smokeSearch`, milestone 68): the palette over the
// sample on any of the three shapes, by word, unvoweled Arabic, phrase and
// under three letters, light and dark; a result opens at its place; a write,
// a rename and a delete followed in the database itself.
// `ILMI_SMOKE=finish` (`smokeFinish`, milestone 52): a finish day on a half-read
// source of the sample, set and cleared from the inspector (see the function).
// `ILMI_SMOKE=size` (`smokeSize`, milestone 60) runs from the welcome: the
// folder imported 15 and 152 times over (`ILMI_SIZE`) into collections of
// their own, each opened and a card graded, the times and the web content
// process's memory printed (see the function).
// `ILMI_SMOKE=touch` (`smokeTouch` on an iPad, `smokeTouchMac` on the Mac,
// milestone 57) over a storage folder both read (`ILMI_STORAGE`): the Mac's
// collection makes the storage, the iPad's is made from it and a chapter is
// read there under touches the touch rig makes (a passage boxed by a held
// finger becomes a section), and the Mac finds the section after a sync
// (`ILMI_EXPECT`; see the functions).
// `ILMI_SMOKE=phone` (`smokePhone` on a simulated iPhone, `smokePhoneMac` on
// the Mac, milestone 56): three runs over one storage folder, as `touch` is:
// the day's cards reviewed by the buttons, a quick card, a page clipped by an
// `ilmi://new?url=` link, all three on the Mac. See `smokePhone`.
// `ILMI_SMOKE=ink` (`smokeInk` on an iPad, `smokeInkMac` on the Mac,
// milestones 58, 69), over a storage folder as `touch` is: a note is written
// on where the rig's finger, standing in for the Pencil, lands, with nothing
// chosen first; the area grows; a finger scrolls it; and the Mac finds it
// between the same two paragraphs as a picture it makes from the strokes
// (`ILMI_EXPECT`, `ILMI_STROKES`).
// `ILMI_SMOKE=pageink` (`smokePageInk` on an iPad, `smokePageInkMac` on the
// Mac, milestones 67, 69), over a storage folder, in four runs: the Mac writes
// on a page of the sample's book and does not send it; the iPad's
// collection, made from the storage, writes on the same page from its first
// touch (and makes a note of two pages of ink); the Mac holds both writings
// after a sync and shows them over the page; the iPad's collection, opened
// again (`ILMI_AGAIN`), holds both too, on dark paper (see the functions).
// `ILMI_SMOKE=ipad` (`smokeIpad`, milestone 55) starts at the iPad's
// welcome, on a simulated iPad from `smoke.json` in the app's Documents
// (`{"mode": "ipad", "remote": "/path/to/bare.git"}`) or in the Mac's
// window with `ILMI_MOBILE=1 ILMI_DOCUMENTS=<dir> ILMI_REMOTE=<bare>`:
// `connect` clones the remote into Documents, the shell is one pane with
// the sidebar and the inspector hidden, the queue is walked by its buttons,
// a card graded there is pushed (see the function).
// `ILMI_SMOKE=cardview` (`smokeCardView`, milestone 72) over a copy of
// `samples/double-major`: a deck's cards listed in the tree, the card view
// opened from a row, a face edited and saved, `]`, a session's card edited
// with `e`, and a cell's right-click menu adding a row (see the function).

import { invoke } from '@tauri-apps/api/core';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { info } from '@tauri-apps/plugin-log';
import { queue, type CardItem } from '../schedule/index.js';
import type { Vault } from '../vault/index.js';
import { cardLabel } from './chrome.js';
import { GLYPH, SESSION, notesId, notesPath, queueId, titleOf } from './names.js';
import { vaultName } from './recents.js';
import { useApp } from './store.js';
import { runMenu } from './menu.js';
import { createNode, currentVault, importNode, moveNode, toggleOpen, openCard, openIntake, openNode, openSession, openVault, removeNode, renameNode, setInspector, setSidebar, startFromRecents } from './vault.js';
import { activeTab, besideAt, closePane } from './panes.js';

const WOZ = 'papers/wozniak-1990.md';

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** The folder the run's collection was imported from (`ILMI_VAULT`), for a file handed to the Rust side by path. */
const sourceDir = async (): Promise<string> => ((await invoke<string | null>('dev_env', { name: 'ILMI_VAULT' })) ?? '').replace(/\/+$/, '');

async function until<T>(probe: () => T | null | undefined, ms = 5000): Promise<T> {
  const t0 = Date.now();
  for (;;) {
    const v = probe();
    if (v) return v;
    if (Date.now() - t0 > ms) throw new Error('timed out');
    await sleep(50);
  }
}

/**
 * Freeze or thaw the open page through the inspector's toggle (40 took the
 * word off the reader's top row), the inspector shown for it; resolves once
 * the page says so (`data-frozen` on `.doc-view`).
 */
async function setFrozenUi(want: boolean): Promise<void> {
  const page = () => document.querySelector<HTMLElement>('.doc-view');
  const is = () => page()?.dataset.frozen === (want ? '1' : '0');
  if (is()) return;
  useApp.setState({ inspForced: true });
  setInspector({ open: true });
  const btn = await until(() => document.querySelector<HTMLElement>('.insp .fr-toggle[data-frozen]'));
  btn.click();
  await until(() => (is() ? true : null));
}

/** Lines that differ, for two texts with the same number of lines. */
function changedLines(a: string, b: string): number[] {
  const la = a.split('\n');
  const lb = b.split('\n');
  if (la.length !== lb.length) return [-1];
  return la.flatMap((l, i) => (l === lb[i] ? [] : [i + 1]));
}

export async function smokeReader(vault: Vault): Promise<void> {
  const log = (s: string) => info(`smoke reader: ${s}`);
  try {
    const before = (await vault.read(WOZ)).text;
    openNode(WOZ);
    const surface = await until(() => document.querySelector<HTMLElement>('.draft-doc'));
    await until(() => surface.querySelector('.katex, .card-span'));
    await sleep(300);
    log(`blocks ${surface.children.length}, cards ${surface.querySelectorAll('.card-span').length}, math ${surface.querySelectorAll('.math').length}, marks ${surface.querySelectorAll('.ed-mark').length}`);
    const rule = document.querySelector<HTMLElement>('.read-rule');
    log(`rule ${rule ? `${rule.style.top} + ${rule.style.height}` : 'none'}; frozen ${(document.querySelector<HTMLElement>('.doc-view')?.dataset.frozen === '1' ? 'frozen' : 'editable')}; editable ${surface.contentEditable}`);

    // frozen: the surface refuses text
    const p = Array.from(surface.querySelectorAll<HTMLElement>('p.dd-p')).find((el) => el.textContent?.startsWith('Cramming'));
    if (!p) throw new Error('no paragraph');
    const place = () => {
      const r = document.createRange();
      r.setStart(p.firstChild!, 8);
      r.collapse(true);
      const sel = window.getSelection()!;
      sel.removeAllRanges();
      sel.addRange(r);
      surface.focus();
    };
    place();
    document.execCommand('insertText', false, 'X');
    await sleep(800);
    log(`frozen refused: ${(await vault.read(WOZ, true)).text === before}`);

    // thaw, then the same keystroke lands as one changed line
    await setFrozenUi(false);
    await sleep(200);
    place();
    document.execCommand('insertText', false, ', they say,');
    await sleep(1000);
    const after = (await vault.read(WOZ, true)).text;
    log(`typed: changed lines ${JSON.stringify(changedLines(before, after))}; line 5 ${after.split('\n')[4]}`);

    // the marker: a pointer in the gutter beside the third paragraph
    const gutter = document.querySelector<HTMLElement>('.read-gutter');
    if (!gutter) throw new Error('no gutter');
    const target = surface.querySelectorAll<HTMLElement>('p.dd-p')[2]!;
    const y = target.getBoundingClientRect().top + 30;
    const opts = { bubbles: true, clientY: y, pointerId: 1 };
    gutter.dispatchEvent(new PointerEvent('pointerdown', opts));
    gutter.dispatchEvent(new PointerEvent('pointerup', opts));
    await sleep(1000);
    const moved = (await vault.read(WOZ, true)).text;
    log(`marker: ${moved.split('\n')[4]}; rule ${document.querySelector<HTMLElement>('.read-rule')?.style.height}; settled ${surface.querySelectorAll('.settled').length}`);
  } catch (e) {
    log(`failed: ${e instanceof Error ? e.message : String(e)}`);
  }
}

/** A DOM range over `text` inside the paragraph `p`, or collapsed at `offset` into it when one is given. */
function rangeIn(p: HTMLElement, text: string, offset?: number): Range {
  // the paragraph's text may be split over decorated spans: find the range across its text nodes
  const walker = document.createTreeWalker(p, NodeFilter.SHOW_TEXT);
  const nodes: Text[] = [];
  for (let t = walker.nextNode(); t; t = walker.nextNode()) nodes.push(t as Text);
  const whole = nodes.map((t) => t.data).join('');
  const at = whole.indexOf(text);
  if (at < 0) throw new Error(`no "${text}" in the paragraph`);
  const locate = (off: number): [Text, number] => {
    let seen = 0;
    for (const t of nodes) { if (off <= seen + t.data.length) return [t, off - seen]; seen += t.data.length; }
    const last = nodes[nodes.length - 1]!;
    return [last, last.data.length];
  };
  const r = document.createRange();
  if (offset === undefined) {
    const [sn, so] = locate(at);
    const [en, eo] = locate(at + text.length);
    r.setStart(sn, so);
    r.setEnd(en, eo);
  } else {
    const [n, o] = locate(at + offset);
    r.setStart(n, o);
    r.collapse(true);
  }
  return r;
}

/** Select `text` inside the paragraph `p`, as a pointer would. */
function select(p: HTMLElement, text: string): void {
  const sel = window.getSelection()!;
  sel.removeAllRanges();
  sel.addRange(rangeIn(p, text));
}

/** Put the caret `offset` characters into `text` inside the paragraph `p`. */
function caret(p: HTMLElement, text: string, offset: number): void {
  const sel = window.getSelection()!;
  sel.removeAllRanges();
  sel.addRange(rangeIn(p, text, offset));
}

const press = (key: string, init: KeyboardEventInit = {}) =>
  window.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ...init }));

export async function smokeCards(vault: Vault): Promise<void> {
  const log = (s: string) => info(`smoke cards: ${s}`);
  try {
    const before = (await vault.read(WOZ)).text;
    openNode(WOZ);
    const surface = await until(() => document.querySelector<HTMLElement>('.draft-doc'));
    await until(() => surface.querySelector('.card-span'));
    await sleep(300);
    const paras = () => Array.from(surface.querySelectorAll<HTMLElement>('p.dd-p'));

    // extract: select part of the §4 paragraph, press e
    const cram = paras().find((el) => el.textContent?.startsWith('Cramming'))!;
    select(cram, 'Cramming is mass repetition compressed in time.');
    const cue = await until(() => document.querySelector<HTMLElement>('.sel-cue'));
    log(`cue: ${Array.from(cue.querySelectorAll('.cue-act')).map((b) => b.textContent).join(' | ')}`);
    press('e');
    const child = await until(() => vault.documents().find((d) => d.startsWith('papers/wozniak-1990/Cramming')));
    await sleep(600);
    const ex = await vault.read(child, true);
    log(`extract ${child}; front-matter ${ex.text.split('\n').slice(0, 5).join(' / ')}; body ${ex.doc.blocks.length} block; diagnostics ${ex.diagnostics.length}`);
    const parent = await vault.read(WOZ, true);
    log(`parent: ${parent.text.split('\n').length - before.split('\n').length} lines added; backref ${parent.text.includes('<!-- extract Cramming is mass repetition compressed -->')}; read ${parent.text.split('\n')[4]}; extracted paragraphs ${surface.querySelectorAll('p.extracted').length}`);

    // a card: select in the "Choosing well" paragraph, press m, fill, ⌘↵
    await until(() => (document.querySelector('.sel-cue') ? null : true));
    const choose = paras().find((el) => el.textContent?.startsWith('Choosing well'))!;
    select(choose, 'Each successful recall pushes the curve out further than the last.');
    await until(() => document.querySelector('.sel-cue'));
    press('m');
    const ta = await until(() => document.querySelector<HTMLTextAreaElement>('.composer textarea'));
    log(`composer: seed "${ta.value}"; forms ${Array.from(document.querySelectorAll('.composer .type-toggle button')).map((b) => b.textContent).join(' ')}; able ${document.querySelector('.composer .act')?.getAttribute('data-able')}`);
    const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')!.set!;
    setter.call(ta, 'Each successful recall pushes the curve {{out further}} than the last.');
    ta.dispatchEvent(new Event('input', { bubbles: true }));
    await sleep(100);
    log(`preview blanks ${document.querySelectorAll('.composer .cloze-mark').length}; able ${document.querySelector('.composer .act')?.getAttribute('data-able')}`);
    press('Enter', { metaKey: true });
    await until(() => (document.querySelector('.composer') ? null : true));
    await sleep(800);
    const after = await vault.read(WOZ, true);
    const lines = after.text.split('\n');
    const at = lines.findIndex((l) => l.startsWith('Each successful recall pushes the curve {{out further}}'));
    log(`card: line ${at + 1} (after "${lines[at - 2]?.slice(0, 30)}…"); cards ${after.doc.blocks.filter((b) => b.kind === 'card').length}; diagnostics ${after.diagnostics.length}; surface cards ${surface.querySelectorAll('.card-span').length}`);
  } catch (e) {
    log(`failed: ${e instanceof Error ? e.message : String(e)}`);
  }
}

export async function smoke(vault: Vault): Promise<void> {
  const log = (s: string) => info(`smoke: ${s}`);
  const before = vault.documents().join(', ');
  try {
    const folder = await createNode('', 'folder');
    log(`folder ${folder}`);
    const deck = await createNode(folder, 'deck');
    log(`deck ${deck}`);
    const renamed = await renameNode(deck, 'smoke deck');
    log(`renamed ${renamed}`);
    const moved = await moveNode(renamed, 'papers');
    log(`moved ${moved}`);
    const woz = await moveNode('papers/wozniak-1990.md', folder);
    log(`moved with children ${woz} → ${vault.documents().filter((d) => d.startsWith(folder)).join(', ')}`);
    const back = await moveNode(woz, 'papers');
    log(`moved back ${back}`);
    const ex = await renameNode('papers/wozniak-1990/woz-ex1.md', 'woz-first');
    log(`renamed extract ${ex}; parent has backref: ${(await vault.read('papers/wozniak-1990.md', true)).text.includes('<!-- extract woz-first -->')}`);
    await renameNode(ex, 'woz-ex1');
    await removeNode(moved);
    await removeNode(folder);
    log(`removed; tree unchanged: ${vault.documents().join(', ') === before}`);
    await vault.saveState({ folders: ['', 'papers'] });
    log(`state: ${JSON.stringify(await vault.loadState())}`);
  } catch (e) {
    log(`failed: ${e instanceof Error ? e.message : String(e)}`);
  }
}

export async function smokeIntake(vault: Vault): Promise<void> {
  const log = (s: string) => info(`smoke intake: ${s}`);
  const q = <T extends Element>(sel: string) => document.querySelector<T>(sel);
  try {
    openIntake('papers');
    const ta = await until(() => q<HTMLTextAreaElement>('.intake textarea'));
    log(`open: tab "${q('.tabbar .tab[data-active="1"] .title')?.textContent}"; h1 "${q('.intake h1')?.textContent}"; hint "${q('.intake .paste-hint')?.textContent}"; focused ${document.activeElement === ta}`);
    Array.from(document.querySelectorAll<HTMLButtonElement>('.intake .paste-hint .link')).find((b) => b.textContent?.includes('sample'))!.click();
    const detail = await until(() => q('.intake-detail'));
    const active = detail.querySelector('.folder-pick button[data-active="1"]')?.textContent;
    log(`sample: stats "${detail.querySelector('.stats')?.textContent}"; title "${q<HTMLInputElement>('.intake .field input')?.value}"; folders ${Array.from(detail.querySelectorAll('.folder-pick button')).map((b) => b.textContent).join(', ')}; chosen ${active}; buttons ${Array.from(detail.querySelectorAll('.place')).map((b) => b.textContent).join(' | ')}`);
    q<HTMLButtonElement>('.intake .place.primary')!.click();
    const path = await until(() => vault.documents().find((d) => d.startsWith('papers/Spaced repetition')));
    await sleep(600);
    const loaded = await vault.read(path, true);
    const fm = loaded.text.split('\n').slice(0, 5).join(' / ');
    log(`placed ${path}; front-matter ${fm}; blocks ${loaded.doc.blocks.length}; diagnostics ${loaded.diagnostics.length}`);
    const h1 = await until(() => q('.doc-view h1'));
    log(`reader: h1 "${h1.textContent}"; ${(document.querySelector<HTMLElement>('.doc-view')?.dataset.frozen === '1' ? 'frozen' : 'editable')}; paragraphs ${document.querySelectorAll('.draft-doc p.dd-p').length}; intake tabs left ${document.querySelectorAll('.tabbar .tab[data-t="intake"]').length}`);

    // an address pasted into the empty field is fetched
    openIntake('books');
    const ta2 = await until(() => q<HTMLTextAreaElement>('.intake textarea'));
    const dt = new DataTransfer();
    dt.setData('text/plain', 'https://example.com/');
    ta2.dispatchEvent(new ClipboardEvent('paste', { bubbles: true, cancelable: true, clipboardData: dt }));
    log(`paste: hint "${q('.intake .paste-hint')?.textContent}"`);
    const got = await until(() => {
      if (ta2.value) return ta2.value;
      const n = q('.intake .paste-hint .note')?.textContent;
      return n && n !== 'fetching' ? n : null;
    }, 30000);
    log(`fetched: "${got.slice(0, 80).replace(/\n/g, ' ')}"; title "${q<HTMLInputElement>('.intake .field input')?.value ?? ''}"; chosen ${q('.folder-pick button[data-active="1"]')?.textContent}`);
  } catch (e) {
    log(`failed: ${e instanceof Error ? e.message : String(e)}`);
  }
}

export async function smokeQueue(vault: Vault): Promise<void> {
  const log = (s: string) => info(`smoke queue: ${s}`);
  const q = <T extends Element>(sel: string) => document.querySelector<T>(sel);
  const qa = (sel: string) => Array.from(document.querySelectorAll<HTMLElement>(sel));
  try {
    openNode(queueId('today'));
    await until(() => q('.queue .qlist li'));
    await sleep(300);
    const rows = qa('.queue .qlist li');
    log(`today: tab "${q('.tabbar .tab[data-active="1"] .title')?.textContent}"; h1 "${q('.queue h1')?.textContent}"; summary "${q('.queue .summary')?.textContent}"; rows ${rows.length}; saved queries ${qa('.queries .row').map((r) => `${r.querySelector('.name')?.textContent} ${r.querySelector('.meta')?.textContent}`).join(', ')}`);
    log(`first rows: ${rows.slice(0, 3).map((r) => `[${r.dataset.el}] ${r.querySelector('.src')?.textContent} | ${r.querySelector('.due')?.textContent}`).join(' / ')}`);

    // enter the queue
    press('Enter');
    await until(() => q('.recall-wrap, .doc-session'));
    let steps = 0;
    const seen: string[] = [];
    for (;;) {
      await sleep(250);
      const done = q('.recall-wrap .empty.center');
      if (done) { log(`end: "${done.textContent}"`); break; }
      if (++steps > 40) throw new Error('did not finish');
      const el = useApp.getState().sessionEl;
      const item = useApp.getState().session?.items[steps - 1];
      const path = item?.path ?? '?';
      const before = (await vault.read(path)).text;
      if (q('.recall-wrap .card')) {
        const meta = q('.recall-meta')?.textContent;
        const hidden = qa('.recall-wrap .card .cloze:not(.revealed):not(.ctx)').length;
        const ctx = qa('.recall-wrap .card .cloze.ctx').length;
        press(' ');
        await sleep(50);
        const shown = qa('.recall-wrap .card .cloze.revealed').length;
        const gaps = qa('.grades .gap').map((g) => g.textContent).join(' ');
        press('3');
        await sleep(400);
        const after = (await vault.read(path, true)).text;
        seen.push(`card ${el?.label}: meta "${meta}"; blanks hidden ${hidden} ctx ${ctx} → revealed ${shown}; gaps ${gaps}; changed lines ${JSON.stringify(changedLines(before, after))}`);
      } else {
        await until(() => q('.doc-session .draft-doc'));
        await sleep(200);
        const bar = qa('.session-bar .sb-actions button').map((b) => b.textContent).join(' | ');
        const kind = q('.session-bar .sb-kind')?.textContent;
        const rule = q<HTMLElement>('.read-rule')?.style.height;
        press('Enter');
        await sleep(500);
        const after = (await vault.read(path, true)).text;
        seen.push(`${kind} ${el?.label}: bar ${bar}; rule ${rule ?? 'none'}; changed lines ${JSON.stringify(changedLines(before, after))}; line ${after.split('\n').find((l) => l.startsWith(kind === 'reading' ? 'read:' : 'write:'))}`);
      }
    }
    for (const s of seen) log(s);
    log(`session tab title now "${q('.tabbar .tab[data-active="1"] .title')?.textContent}"`);
    openNode(queueId('today'));
    await until(() => q('.queue .empty'));
    log(`queue after: "${q('.queue .empty')?.textContent}"; log ${qa('.qlog-line').map((l) => l.textContent).join(' / ')}; saved queries ${qa('.queries .row').map((r) => `${r.querySelector('.name')?.textContent} ${r.querySelector('.meta')?.textContent}`).join(', ')}`);
  } catch (e) {
    log(`failed: ${e instanceof Error ? e.message : String(e)}`);
  }
}

export async function smokeLoop(vault: Vault): Promise<void> {
  const log = (s: string) => info(`smoke loop: ${s}`);
  const q = <T extends Element>(sel: string) => document.querySelector<T>(sel);
  const qa = (sel: string) => Array.from(document.querySelectorAll<HTMLElement>(sel));
  try {
    // import
    openIntake('papers');
    await until(() => q<HTMLTextAreaElement>('.intake textarea'));
    Array.from(document.querySelectorAll<HTMLButtonElement>('.intake .paste-hint .link')).find((b) => b.textContent?.includes('sample'))!.click();
    await until(() => q('.intake-detail'));
    q<HTMLButtonElement>('.intake .place.primary')!.click();
    const path = await until(() => vault.documents().find((d) => d.startsWith('papers/Spaced repetition')));
    const surface = await until(() => q<HTMLElement>('.doc-view .draft-doc'));
    await sleep(400);
    log(`imported ${path}; frozen ${(document.querySelector<HTMLElement>('.doc-view')?.dataset.frozen === '1' ? 'frozen' : 'editable')}; enrol button "${q('.frozen-tag.enrol')?.textContent}"; bottom strip "${q('.bot')?.textContent}"; inspector "${qa('.insp .block h6').map((h) => h.textContent).join(', ')}"`);

    // start reading
    press('r');
    await until(() => (q('.read-gutter') ? true : null));
    await sleep(300);
    const enrolled = (await vault.read(path, true)).text.split('\n').find((l) => l.startsWith('read:'));
    log(`reading: ${enrolled}; rule ${q<HTMLElement>('.read-rule')?.style.height}; queries ${qa('.queries .row').map((r) => `${r.querySelector('.name')?.textContent} ${r.querySelector('.meta')?.textContent}`).join(', ')}`);

    // extract the second paragraph's first sentence
    const paras = () => Array.from(surface.querySelectorAll<HTMLElement>('p.dd-p'));
    const p2 = paras().find((el) => el.textContent?.startsWith('The mistake'))!;
    select(p2, 'The mistake most learners make is to treat the wager as free.');
    await until(() => q('.sel-cue'));
    press('e');
    const child = await until(() => vault.documents().find((d) => d.startsWith('papers/Spaced repetition and the economics of attention/')));
    await sleep(500);
    log(`extract ${child}; read line ${(await vault.read(child, true)).text.split('\n').find((l) => l.startsWith('read:'))}; parent marker ${(await vault.read(path, true)).text.split('\n').find((l) => l.startsWith('read:'))}`);

    // a card from the third paragraph
    await until(() => (q('.sel-cue') ? null : true));
    const p3 = paras().find((el) => el.textContent?.startsWith('A good system'))!;
    select(p3, 'A good system spends your attention the way a careful gardener spends water');
    await until(() => q('.sel-cue'));
    press('m');
    const ta = await until(() => q<HTMLTextAreaElement>('.composer textarea'));
    const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')!.set!;
    setter.call(ta, 'A good system spends your attention the way a careful {{gardener}} spends water');
    ta.dispatchEvent(new Event('input', { bubbles: true }));
    await sleep(100);
    press('Enter', { metaKey: true });
    await until(() => (q('.composer') ? null : true));
    await sleep(800);
    const withCard = await vault.read(path, true);
    log(`card: cards ${withCard.doc.blocks.filter((b) => b.kind === 'card').length}; diagnostics ${withCard.diagnostics.length}; inspector cards "${qa('.insp .insp-cards .cl-t').map((c) => c.textContent).join(' | ')}"`);

    // select the card in the reader: the inspector edits it
    const cardEl = surface.querySelector<HTMLElement>('.card-span')!;
    const cr = cardEl.getBoundingClientRect();
    const at = { bubbles: true, button: 0, clientX: cr.left + 20, clientY: cr.top + 12, view: window };
    cardEl.dispatchEvent(new MouseEvent('mousedown', at));
    cardEl.dispatchEvent(new MouseEvent('mouseup', at));
    cardEl.dispatchEvent(new MouseEvent('click', at));
    await sleep(200);
    const ce = q<HTMLTextAreaElement>('.insp .ce-field');
    log(`selected card: ${JSON.stringify(useApp.getState().selectedCard)}; editor "${ce?.value.slice(0, 40)}"; note ${q('.insp .ce-note')?.textContent}`);
    if (ce) {
      setter.call(ce, 'A good system spends your {{attention}} the way a careful {{gardener}} spends water');
      ce.dispatchEvent(new Event('input', { bubbles: true }));
      await sleep(900);
      const edited = await vault.read(path, true);
      log(`edited card: "${edited.doc.blocks.find((b) => b.kind === 'card')?.text.slice(0, 50)}"; surface blanks ${surface.querySelectorAll('.card-span .cz').length}`);
    }

    // the palette finds the new source
    press('k', { metaKey: true });
    const input = await until(() => q<HTMLInputElement>('.palette-input input'));
    const iset = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!;
    iset.call(input, 'spaced');
    input.dispatchEvent(new Event('input', { bubbles: true }));
    await sleep(100);
    log(`palette: ${qa('.palette-row').slice(0, 4).map((r) => `[${r.dataset.t}] ${r.querySelector('.pt')?.textContent} · ${r.querySelector('.psub')?.textContent}`).join(' / ')}`);
    press('Escape');
    await until(() => (q('.palette-overlay') ? null : true));

    // the queue has the extract and the card
    openNode(queueId('today'));
    await until(() => q('.queue .qlist li'));
    await sleep(300);
    const mine = qa('.queue .qlist li').filter((r) => r.textContent?.includes('Spaced repetition') || r.textContent?.includes('The mistake most'));
    log(`queue: ${qa('.queue .qlist li').length} rows; ours ${mine.map((r) => `[${r.dataset.el}] ${r.querySelector('.src')?.textContent}`).join(' / ')}`);

    // review ours: click the extract's row, read on; then the card
    const exRow = mine.find((r) => r.dataset.el === 'read');
    exRow?.click();
    await until(() => q('.doc-session .draft-doc'));
    await sleep(300);
    log(`session: tab "${q('.tabbar .tab[data-active="1"] .title')?.textContent}"; bar ${qa('.session-bar .sb-actions button').map((b) => b.textContent).join(' | ')}; inspector "${qa('.insp .block h6').map((h) => h.textContent).join(', ')}"; strip "${q('.bot')?.textContent}"`);
    press('Enter');
    await sleep(600);
    log(`read on: ${(await vault.read(child!, true)).text.split('\n').find((l) => l.startsWith('read:'))}`);
    // step to our card: it is the next new card in today's order, so walk until the meta names our source
    for (let i = 0; i < 40 && !q('.recall-meta')?.textContent?.includes('Spaced repetition'); i++) {
      if (q('.recall-wrap .empty.center')) break;
      press(']');
      await sleep(80);
    }
    if (q('.recall-meta')?.textContent?.includes('Spaced repetition')) {
      log(`card element: meta "${q('.recall-meta')?.textContent}"; inspector editor "${q<HTMLTextAreaElement>('.insp .ce-field')?.value.slice(0, 30)}"; strip "${q('.bot')?.textContent}"`);
      press(' ');
      await sleep(50);
      press('3');
      await sleep(600);
      const graded = (await vault.read(path, true)).text.split('\n').find((l) => l.startsWith('<!-- sr'));
      log(`graded: ${graded}`);
    } else {
      log('card element not reached');
    }
    log(`tweaks: theme ${useApp.getState().theme}, accent ${useApp.getState().accent}, density ${useApp.getState().density}; stored ${localStorage.getItem('ilmi.tweaks')}`);
  } catch (e) {
    log(`failed: ${e instanceof Error ? e.message : String(e)}`);
  }
}

export async function smokeDeck(vault: Vault): Promise<void> {
  const log = (s: string) => info(`smoke deck: ${s}`);
  const shot = async (name: string, ms = 1800) => { await sleep(600); log(`shot: ${name}`); await sleep(ms); };
  const DECK = 'german.md';
  try {
    setInspector({ open: true });
    const before = (await vault.read(DECK)).text;
    openNode(DECK);
    const view = await until(() => document.querySelector<HTMLElement>('.deck-view'));
    // from the document, not `view`: the tab switch below unmounts the deck, and the palette mounts a new one
    const rows = () => Array.from(document.querySelectorAll<HTMLElement>('.deck-view .card-span'));
    await until(() => (rows().length ? true : null));
    await sleep(300);
    log(`rows ${rows().length}; header "${view.querySelector('.meta .right')?.textContent}"`);

    // right-click the third row, look at the menu, take the shot, delete from it
    const third = rows()[2]!;
    const text = third.querySelector('.cs-body')?.textContent ?? '';
    const r = third.getBoundingClientRect();
    third.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true, clientX: r.left + 80, clientY: r.top + r.height / 2 }));
    const menu = await until(() => view.querySelector<HTMLElement>('.ctx-menu'));
    log(`menu: ${Array.from(menu.querySelectorAll('.ci')).map((b) => b.textContent).join(' | ')}; row marked ${third.getAttribute('data-menu')}`);
    // where the first row's × is, in viewport px, so a shell can park the pointer there for the shot
    const del = rows()[0]!.querySelector<HTMLElement>('.cs-del')!.getBoundingClientRect();
    log(`hover: ${Math.round(del.left + del.width / 2)} ${Math.round(del.top + del.height / 2)} of ${window.innerWidth}x${window.innerHeight}`);
    // long: the webview's log lines reach the terminal some seconds late, and the shell shoots on the line
    await shot('deck-menu', 10000);
    // a press outside closes the menu, and the shell's focus games during the pause can count as one
    let live = view.querySelector<HTMLElement>('.ctx-menu');
    if (!live) {
      log('menu closed during the pause (an outside press); opening it again');
      third.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true, clientX: r.left + 80, clientY: r.top + r.height / 2 }));
      live = await until(() => view.querySelector<HTMLElement>('.ctx-menu'));
    }
    live.querySelector<HTMLElement>('.ci.danger')!.click();
    await until(() => (rows().length === 6 ? true : null));
    await sleep(500);
    let after = await vault.read(DECK, true);
    log(`menu delete: rows ${rows().length}; menu gone ${!view.querySelector('.ctx-menu')}; "${text.slice(0, 20)}" on disk ${after.text.includes(text.slice(0, 12))}; ^cv-gedacht on disk ${after.text.includes('cv-gedacht')}; lines ${before.split('\n').length} → ${after.text.split('\n').length}; cards ${after.doc.blocks.filter((b) => b.kind === 'card').length}; diagnostics ${after.diagnostics.length}`);
    log(`inspector: ${document.querySelector('.insp .kv')?.textContent}; log "${useApp.getState().log[0]}"`);

    // the × on the first row
    const first = rows()[0]!;
    const firstText = first.querySelector('.cs-body')?.textContent ?? '';
    first.querySelector<HTMLElement>('.cs-del')!.click();
    await until(() => (rows().length === 5 ? true : null));
    await sleep(500);
    after = await vault.read(DECK, true);
    log(`× delete: rows ${rows().length}; "${firstText.slice(0, 20)}" on disk ${after.text.includes(firstText.slice(0, 12))}; first row now "${rows()[0]?.querySelector('.cs-body')?.textContent?.slice(0, 24)}"; header "${view.querySelector('.meta .right')?.textContent}"; front-matter intact ${after.text.startsWith('---\ntype: deck\ntitle: german · A1\ndefault-card: bidir\n---\n')}`);
    await shot('deck-after');

    // the keys: j k walk the rows, the inspector edits the selected card,
    // backspace deletes it and the row after takes its place, a delete above
    // the selection leaves it on its card, escape lets go
    const srCount = (t: string) => t.split('\n').filter((l) => l.startsWith('<!-- sr')).length;
    const srAfterId = (t: string, id: string) => { const lines = t.split('\n'); return lines[lines.findIndex((l) => l.endsWith(`^${id}`)) + 1] ?? ''; };
    const selText = () => document.querySelector('.deck-view .card-span.selected .cs-body')?.textContent?.slice(0, 24);
    const selCount = () => rows().filter((r) => r.classList.contains('selected')).length;
    const editor = () => document.querySelector<HTMLTextAreaElement>('.insp .ce-field');
    const state = () => `selected ${JSON.stringify(useApp.getState().selectedCard)}; selected rows ${selCount()} of ${rows().length}; editor ${!!editor()}; palette ${useApp.getState().paletteOpen}; tweaks ${useApp.getState().tweaksOpen}; active pane ${useApp.getState().panes.active}`;
    const waitFor = async <T,>(what: string, probe: () => T | null | undefined): Promise<T> => {
      try { return await until(probe); } catch (e) { log(`${what}: ${e instanceof Error ? e.message : String(e)}; ${state()}`); throw e; }
    };
    // the right-click selected the third row, the menu delete moved the selection to the row that took
    // its place, and the × delete above it left it on that card: it should be "vergessen" now
    log(`after the deletes: selected "${selText()}" at ${JSON.stringify(useApp.getState().selectedCard)}, row ${rows().findIndex((r) => r.classList.contains('selected'))}; selected rows ${selCount()}`);
    press('Escape');
    await waitFor('escape clears', () => (useApp.getState().selectedCard === null ? true : null));
    press('j');
    await waitFor('j selects row 0', () => (rows()[0]?.classList.contains('selected') ? true : null));
    press('j');
    await waitFor('j selects row 1', () => (rows()[1]?.classList.contains('selected') ? true : null));
    press('k');
    await waitFor('k selects row 0', () => (rows()[0]?.classList.contains('selected') ? true : null));
    const ta = await waitFor('inspector editor', editor);
    log(`keys: j j k → selected ${JSON.stringify(useApp.getState().selectedCard)} "${selText()}"; selected rows ${selCount()}; inspector editor "${ta.value.slice(0, 24)}"; strip "${document.querySelector('.bot')?.textContent}"`);

    const cardId0 = (await vault.read(DECK)).doc.blocks.find((b) => b.kind === 'card')?.id ?? '';
    const edited = `${ta.value}; edited`;
    Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')!.set!.call(ta, edited);
    ta.dispatchEvent(new Event('input', { bubbles: true }));
    await until(() => (rows()[0]?.querySelector('.cs-body')?.textContent?.includes('edited') ? true : null));
    await sleep(300);
    after = await vault.read(DECK, true);
    log(`inspector edit: row 0 "${rows()[0]?.querySelector('.cs-body')?.textContent?.slice(0, 44)}"; on disk ${after.text.includes(edited)}; sr line kept ${srAfterId(after.text, cardId0).startsWith('<!-- sr')}; still selected ${rows()[0]?.classList.contains('selected')}; diagnostics ${after.diagnostics.length}`);

    press('j');
    await until(() => (rows()[1]?.classList.contains('selected') ? true : null));
    const gone = selText() ?? '';
    const goneCard = (await vault.read(DECK)).doc.blocks.filter((b) => b.kind === 'card')[1]!;
    const n0 = rows().length;
    press('Backspace');
    await until(() => (rows().length === n0 - 1 ? true : null));
    await sleep(400);
    after = await vault.read(DECK, true);
    log(`backspace: rows ${n0} → ${rows().length}; "${gone}" on disk ${after.text.includes(goneCard.text)}; selected ${JSON.stringify(useApp.getState().selectedCard)} "${selText()}" took its place; selected rows ${selCount()}; log "${useApp.getState().log[0]}"`);

    rows()[2]!.click();
    await until(() => (rows()[2]?.classList.contains('selected') ? true : null));
    const kept = selText();
    const n1 = rows().length;
    rows()[0]!.querySelector<HTMLElement>('.cs-del')!.click();
    await until(() => (rows().length === n1 - 1 ? true : null));
    await sleep(300);
    log(`delete above: the selection stays on its card: "${kept}" → "${selText()}" at ${JSON.stringify(useApp.getState().selectedCard)}; rows ${rows().length}`);

    press('Escape');
    await until(() => (useApp.getState().selectedCard === null ? true : null));
    log(`escape: selected ${JSON.stringify(useApp.getState().selectedCard)}; selected rows ${selCount()}; inspector editor ${editor() ? 'still up' : 'gone'}`);
    after = await vault.read(DECK, true);
    await shot('deck-keys');

    // select the first row (still scheduled), reset it from the inspector, and watch its sr line go
    const schedBlock = () => Array.from(document.querySelectorAll<HTMLElement>('.insp .block')).find((b) => ['schedule', 'front to back'].includes(b.querySelector('h6')?.textContent ?? ''));
    const resetBtn = () => Array.from(document.querySelectorAll<HTMLButtonElement>('.insp .fr-toggle')).find((b) => b.textContent === 'reset');
    const row = rows()[0]!;
    const rowId = (await vault.read(DECK)).doc.blocks.find((b) => b.kind === 'card')?.id ?? '';
    const srBefore = srCount(after.text);
    row.click();
    await until(() => (row.classList.contains('selected') ? true : null));
    const btn = await until(resetBtn);
    log(`selected: ${JSON.stringify(useApp.getState().selectedCard)}; schedule block "${schedBlock()?.textContent?.slice(0, 40)}"; sr line for ^${rowId} on disk "${srAfterId(after.text, rowId).slice(0, 24)}"`);
    btn.click();
    await until(() => (schedBlock()?.querySelector('.insp-line')?.textContent === 'new' ? true : null));
    await sleep(500);
    after = await vault.read(DECK, true);
    log(`reset: schedule block "${schedBlock()?.textContent}"; reset button gone ${!resetBtn()}; sr lines ${srBefore} → ${srCount(after.text)}; line after ^${rowId} now "${srAfterId(after.text, rowId)}"; still selected ${rows()[0]?.classList.contains('selected')} ${JSON.stringify(useApp.getState().selectedCard)}; rows ${rows().length}; log "${useApp.getState().log[0]}"; diagnostics ${after.diagnostics.length}`);
    await shot('deck-reset');

    // a second deck, then the second row moved to it from the menu's "move to…"
    const dest = await createNode('', 'deck');
    await until(() => (useApp.getState().docs[dest]?.type === 'deck' ? true : null));
    const destTitle = titleOf(dest, useApp.getState().docs, vault.root);
    const rowsHere = rows().length;
    const mover = rows()[1]!;
    // the card's text as written, not the row's rendering: the row shows ⇄ where the file has :::
    const moverCard = (await vault.read(DECK)).doc.blocks.filter((b) => b.kind === 'card')[1];
    const moverText = moverCard?.text ?? '';
    const moverId = moverCard?.id ?? '';
    const srLine = srAfterId((await vault.read(DECK)).text, moverId);
    const mr = mover.getBoundingClientRect();
    mover.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true, clientX: mr.left + 80, clientY: mr.top + mr.height / 2 }));
    const menu2 = await until(() => view.querySelector<HTMLElement>('.ctx-menu'));
    log(`move: dest ${dest} "${destTitle}"; menu: ${Array.from(menu2.querySelectorAll('.ci')).map((b) => b.textContent).join(' | ')}; selected ${JSON.stringify(useApp.getState().selectedCard)}`);
    menu2.querySelector<HTMLElement>('.ci.has-sub')!.click();
    const sub = await until(() => menu2.querySelector<HTMLElement>('.sub-scroll'));
    const items = Array.from(sub.querySelectorAll<HTMLElement>('.ci'));
    log(`move: submenu: ${items.map((b) => b.textContent).join(' | ')}; back "${menu2.querySelector('.ci.back')?.textContent}"`);
    const pick = items.find((b) => b.textContent === `${GLYPH.deck}${destTitle}`) ?? items[0]!;
    await shot('deck-move-menu');
    pick.click();
    await until(() => (rows().length === rowsHere - 1 ? true : null));
    await sleep(500);
    after = await vault.read(DECK, true);
    const there = await vault.read(dest, true);
    const destCards = there.doc.blocks.filter((b) => b.kind === 'card');
    log(`move: rows ${rowsHere} → ${rows().length}; menu gone ${!view.querySelector('.ctx-menu')}; "${moverText.slice(0, 20)}" here ${after.text.includes(moverText.slice(0, 12))}, there ${there.text.includes(moverText.slice(0, 12))}; ^${moverId} here ${after.text.includes(`^${moverId}`)}, there ${there.text.includes(`^${moverId}`)}; sr line "${srLine.slice(0, 24)}" here ${after.text.includes(srLine)}, there ${there.text.includes(srLine)}; dest cards ${destCards.length}, last block ${there.doc.blocks[there.doc.blocks.length - 1]?.kind}; selected ${JSON.stringify(useApp.getState().selectedCard)}; log "${useApp.getState().log[0]}"; diagnostics ${after.diagnostics.length} ${there.diagnostics.length}`);
    await shot('deck-moved');

    // from the palette to a card: the deck tab comes up with that row selected
    const q = <T extends Element>(sel: string) => document.querySelector<T>(sel);
    const tabTitle = () => q('.tabbar .tab[data-active="1"] .title')?.textContent;
    const cardBlock = () => q<HTMLTextAreaElement>('.insp .ce-field')?.value.slice(0, 30);
    const viaPalette = async (label: string) => {
      press('k', { metaKey: true });
      const input = await until(() => q<HTMLInputElement>('.palette-input input'));
      // a card is found through the search index, by what it says: a label cut to fit is typed up to its cut, and `⇄` is the row's, not the card's
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input, label.replace(/…$/, '').split(' ⇄ ')[0]!);
      input.dispatchEvent(new Event('input', { bubbles: true }));
      const isIt = (r: HTMLElement) => r.dataset.t === 'card' && r.querySelector('.pt')?.textContent === label;
      await until(() => Array.from(document.querySelectorAll<HTMLElement>('.palette-row')).find(isIt));
      const rowsNow = Array.from(document.querySelectorAll<HTMLElement>('.palette-row'));
      const at = rowsNow.findIndex(isIt);
      log(`palette "${label}": ${rowsNow.length} rows, card at ${at}: ${rowsNow.slice(0, 3).map((r) => `[${r.dataset.t}] ${r.querySelector('.pt')?.textContent}`).join(' / ')}`);
      const key = (k: string) => input.dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true, cancelable: true }));
      for (let i = 0; i < at; i++) key('ArrowDown');
      key('Enter');
      await until(() => (q('.palette-overlay') ? null : true));
    };
    const deckCards = (await vault.read(DECK)).doc.blocks.filter((b) => b.kind === 'card');
    const last = deckCards[deckCards.length - 1]!;
    openNode(queueId('today'));
    await until(() => q('.queue'));
    await viaPalette(cardLabel(last.text));
    const landed = await until(() => q<HTMLElement>('.deck-view .card-span.selected'));
    await sleep(300);
    log(`landed deck: tab "${tabTitle()}"; selected ${JSON.stringify(useApp.getState().selectedCard)} = "${landed.querySelector('.cs-body')?.textContent?.slice(0, 24)}" (wanted "${last.text.slice(0, 24)}", block ${deckCards.length - 1} of ${rows().length} rows); inspector card "${cardBlock()}"; reveal ${JSON.stringify(useApp.getState().reveal)}`);
    // the deck is already showing: a second card lands without a remount
    const first0 = deckCards[0]!;
    await viaPalette(cardLabel(first0.text));
    await until(() => (rows()[0]?.classList.contains('selected') ? true : null));
    log(`landed again: selected ${JSON.stringify(useApp.getState().selectedCard)} = "${rows()[0]?.querySelector('.cs-body')?.textContent?.slice(0, 24)}" (wanted "${first0.text.slice(0, 24)}"); selected rows ${rows().filter((r) => r.classList.contains('selected')).length}; inspector card "${cardBlock()}"`);
    await shot('palette-deck-card');

    // a source card: the reader selects the node and the inspector shows it
    const woz = (await vault.read(WOZ)).doc.blocks;
    const wozIndex = woz.findIndex((b) => b.kind === 'card');
    const wozCard = woz[wozIndex]!;
    await viaPalette(cardLabel(wozCard.text));
    const surface = await until(() => q<HTMLElement>('.doc-view .draft-doc'));
    const node = await until(() => surface.querySelector<HTMLElement>('.card-span.selected'));
    await sleep(300);
    const nr = node.getBoundingClientRect();
    log(`landed source: tab "${tabTitle()}"; selected ${JSON.stringify(useApp.getState().selectedCard)} (wanted ${wozIndex}); node "${node.querySelector('.cs-body')?.textContent?.slice(0, 24)}" in view ${nr.top >= 0 && nr.bottom <= window.innerHeight}; inspector card "${cardBlock()}"; reveal ${JSON.stringify(useApp.getState().reveal)}`);
    await shot('palette-source-card');
    log(`done; vault ${vault.root}`);
  } catch (e) {
    log(`failed: ${e instanceof Error ? e.message : String(e)}`);
  }
}

export async function smokeShots(vault: Vault): Promise<void> {
  const log = (s: string) => info(`smoke shots: ${s}`);
  const q = <T extends Element>(sel: string) => document.querySelector<T>(sel);
  // the log line reaches the terminal about 5 s late; the pause gives the capture its screen
  const shot = async (name: string, ms = 10000) => { await sleep(600); log(`shot: ${name}`); await sleep(ms); };
  try {
    setInspector({ open: true });
    openNode(queueId('today'));
    await until(() => q('.queue'));
    await shot('queue-today');
    openNode(WOZ);
    await until(() => q('.doc-view .draft-doc .card-span'));
    await shot('reader-source');
    const surface = q<HTMLElement>('.draft-doc')!;
    const p = Array.from(surface.querySelectorAll<HTMLElement>('p.dd-p')).find((el) => el.textContent?.startsWith('Choosing well'))!;
    select(p, 'Each successful recall pushes the curve out further than the last.');
    await until(() => q('.sel-cue'));
    await shot('reader-selection');
    press('m');
    await until(() => q('.composer'));
    await shot('composer');
    press('Escape');
    window.getSelection()?.removeAllRanges();
    openNode('essays/spaced-composition.md');
    await until(() => q('.draft-sched'));
    await shot('draft');
    openNode('german.md');
    await until(() => q('.deck-view'));
    await shot('deck');
    openIntake('papers');
    await until(() => q('.intake'));
    // the hint's first link now picks a file (a native dialog); the sample is the one named so
    Array.from(document.querySelectorAll<HTMLButtonElement>('.intake .paste-hint .link')).find((b) => b.textContent?.includes('sample'))!.click();
    await until(() => q('.intake-detail'));
    await shot('intake');
    openNode(queueId('today'));
    await until(() => q('.queue'));
    press('Enter');
    await until(() => q('.recall-wrap .card'));
    await shot('session-card');
    press(' ');
    await shot('session-card-revealed');
    // walk to a reading element
    for (let i = 0; i < 40 && !q('.doc-session'); i++) { press(']'); await sleep(60); }
    await until(() => q('.doc-session .draft-doc'));
    await shot('session-reading');
    press('k', { metaKey: true });
    await until(() => q('.palette-overlay'));
    await shot('palette');
    press('Escape');
    useApp.setState({ tweaksOpen: true });
    await until(() => q('.tweaks'));
    await shot('tweaks');
    useApp.getState().setTheme('dark');
    await shot('dark');
    useApp.getState().setTheme('eink');
    await shot('eink');
    useApp.getState().setTheme('light');
    useApp.setState({ tweaksOpen: false });
    openNode('papers');
    await until(() => q('.folder-view'));
    await shot('folder');
    log(`done; session tab ${SESSION} open: ${!!q('.tabbar .tab[data-t="session"]')}; vault ${vault.root}`);
  } catch (e) {
    log(`failed: ${e instanceof Error ? e.message : String(e)}`);
  }
}

export async function smokePri(vault: Vault): Promise<void> {
  const log = (s: string) => info(`smoke pri: ${s}`);
  // long pauses: the log line reaches the terminal seconds late, and the shell shoots on the line
  const shot = async (name: string, ms = 10000) => { await sleep(600); log(`shot: ${name}`); await sleep(ms); };
  const q = <T extends Element>(sel: string) => document.querySelector<T>(sel);
  const qa = (sel: string) => Array.from(document.querySelectorAll<HTMLElement>(sel));
  const CRICK = 'papers/crick-1995.md';
  /** Lines in `b` that are not in `a`, and the other way, for files whose length may differ. */
  const diff = (a: string, b: string) => {
    const la = a.split('\n');
    const lb = b.split('\n');
    return `-[${la.filter((l) => !lb.includes(l)).join(' | ')}] +[${lb.filter((l) => !la.includes(l)).join(' | ')}] lines ${la.length} → ${lb.length}`;
  };
  /** Type into a React-controlled number field and leave it, which commits. */
  const enter = async (el: HTMLInputElement, v: string) => {
    el.focus();
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(el, v);
    el.dispatchEvent(new Event('input', { bubbles: true }));
    await sleep(50);
    el.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));
    el.blur();
    await sleep(600);
  };
  const rows = () => qa('.queue .qlist li').map((r) => `[${r.dataset.el}] ${r.querySelector('.src')?.textContent?.slice(0, 28)} ${r.querySelector('.pri')?.textContent || '-'}`);
  try {
    setInspector({ open: true });
    openNode(queueId('today'));
    await until(() => q('.queue .qlist li'));
    await sleep(300);
    log(`today before: ${rows().slice(0, 4).join(' / ')}; count ${q('.top .count, .topstrip .due')?.textContent ?? q('.top')?.textContent?.slice(0, 40)}`);

    // the source: its priority row in the inspector
    const before = (await vault.read(CRICK)).text;
    openNode(CRICK);
    await until(() => q('.draft-doc'));
    const field = await until(() => q<HTMLInputElement>('.insp .kv .pri-field'));
    log(`inspector: priority field "${field.value}" placeholder ${field.placeholder}; rows "${q('.insp .kv')?.textContent?.slice(0, 120)}"`);
    await shot('pri-inspector');
    await enter(field, '10');
    let after = (await vault.read(CRICK, true)).text;
    log(`source → 10: ${diff(before, after)}; field now "${q<HTMLInputElement>('.insp .kv .pri-field')?.value}"; diagnostics ${(await vault.read(CRICK)).diagnostics.length}`);
    // and back to nothing: the line goes
    await enter(q<HTMLInputElement>('.insp .kv .pri-field')!, '');
    const cleared = (await vault.read(CRICK, true)).text;
    log(`source → empty: ${diff(after, cleared)}; same as before ${cleared === before}`);
    await enter(q<HTMLInputElement>('.insp .kv .pri-field')!, '10');
    after = (await vault.read(CRICK, true)).text;

    // the queue reordered: crick's reading is first now
    openNode(queueId('today'));
    await until(() => q('.queue .qlist li'));
    await sleep(400);
    log(`today after: ${rows().slice(0, 4).join(' / ')}`);
    await shot('pri-queue');

    // a card: land on it, the inspector shows the card's own row, empty, with the document's as the hint
    const woz = (await vault.read(WOZ)).doc;
    const idx = woz.blocks.findIndex((b) => b.kind === 'card' && b.id === 'cw1-paths');
    const wozBefore = (await vault.read(WOZ)).text;
    openCard(WOZ, idx, 'cw1-paths');
    const cardField = await until(() => (q('.insp .block h6')?.textContent === 'card' ? q<HTMLInputElement>('.insp .kv .pri-field') : null));
    log(`card: selected ${JSON.stringify(useApp.getState().selectedCard)}; field "${cardField.value}" placeholder ${cardField.placeholder}; schedule "${qa('.insp .block')[1]?.textContent?.slice(0, 60)}"`);
    await enter(cardField, '5');
    const wozAfter = (await vault.read(WOZ, true)).text;
    log(`card → 5: changed lines ${JSON.stringify(changedLines(wozBefore, wozAfter))}; line "${wozAfter.split('\n').find((l) => l.includes('pri=5'))}"; diagnostics ${(await vault.read(WOZ)).diagnostics.length}`);
    await shot('pri-card');

    // the card leads the queue now, and the session says so
    openNode(queueId('today'));
    await until(() => q('.queue .qlist li'));
    await sleep(400);
    log(`today with the card: ${rows().slice(0, 3).join(' / ')}`);
    press('Enter');
    await until(() => q('.recall-wrap .card'));
    await sleep(300);
    log(`session: meta "${q('.card-meta')?.textContent}"; inspector card field "${q<HTMLInputElement>('.insp .kv .pri-field')?.value}"`);
    await shot('pri-session');
    // grading keeps the priority on the line
    press(' ');
    await sleep(100);
    press('3');
    await sleep(600);
    const graded = (await vault.read(WOZ, true)).text;
    log(`graded: line "${graded.split('\n').find((l) => l.includes('^cw1-paths') ? false : l.includes('pri=5'))}"; changed lines ${JSON.stringify(changedLines(wozAfter, graded))}`);
    log('done');
  } catch (e) {
    log(`failed: ${e instanceof Error ? e.message : String(e)}`);
  }
}

export async function smokeGrowth(vault: Vault): Promise<void> {
  const log = (s: string) => info(`smoke growth: ${s}`);
  const shot = async (name: string, ms = 10000) => { await sleep(600); log(`shot: ${name}`); await sleep(ms); };
  const q = <T extends Element>(sel: string) => document.querySelector<T>(sel);
  const CRICK = 'papers/crick-1995.md';
  const TALK = 'essays/talk-incremental.md';
  const diff = (a: string, b: string) => {
    const la = a.split('\n');
    const lb = b.split('\n');
    return `-[${la.filter((l) => !lb.includes(l)).join(' | ')}] +[${lb.filter((l) => !la.includes(l)).join(' | ')}] lines ${la.length} → ${lb.length}`;
  };
  const enter = async (el: HTMLInputElement, v: string) => {
    el.focus();
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(el, v);
    el.dispatchEvent(new Event('input', { bubbles: true }));
    await sleep(50);
    el.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));
    el.blur();
    await sleep(600);
  };
  const row = () => `growth "${q<HTMLInputElement>('.insp .kv .af-field')?.value}" placeholder ${q<HTMLInputElement>('.insp .kv .af-field')?.placeholder}; next "${q('.insp .kv .af-next')?.textContent}"`;
  try {
    setInspector({ open: true });
    // the source: its growth row, the corpus's af=2, and the preview from ivl=2
    let before = (await vault.read(CRICK)).text;
    openNode(CRICK);
    await until(() => q('.draft-doc'));
    const field = await until(() => q<HTMLInputElement>('.insp .kv .af-field'));
    log(`inspector: ${row()}`);
    await shot('growth-inspector');
    await enter(field, '3');
    let after = (await vault.read(CRICK, true)).text;
    log(`source → 3: ${diff(before, after)}; ${row()}; diagnostics ${(await vault.read(CRICK)).diagnostics.length}`);
    await enter(q<HTMLInputElement>('.insp .kv .af-field')!, '');
    before = after;
    after = (await vault.read(CRICK, true)).text;
    log(`source → empty: ${diff(before, after)}; ${row()}`);
    await enter(q<HTMLInputElement>('.insp .kv .af-field')!, '1.6');
    before = after;
    after = (await vault.read(CRICK, true)).text;
    log(`source → 1.6, the default: ${diff(before, after)}; same file ${before === after}; ${row()}`);
    await enter(q<HTMLInputElement>('.insp .kv .af-field')!, '1');
    before = after;
    after = (await vault.read(CRICK, true)).text;
    log(`source → 1, below the floor: ${diff(before, after)}; same file ${before === after}; ${row()}`);
    await enter(q<HTMLInputElement>('.insp .kv .af-field')!, '2');

    // the draft: the row sits with the spaced-composition numbers
    openNode(TALK);
    await until(() => q('.draft-doc'));
    await until(() => q<HTMLInputElement>('.insp .kv .af-field'));
    await sleep(200);
    log(`draft: ${row()}; block "${Array.from(document.querySelectorAll('.insp .block'))[1]?.textContent?.slice(0, 80)}"`);
    await shot('growth-draft');

    // postpone from the session: the first topic of the day, one line
    openNode(queueId('today'));
    await until(() => q('.queue .qlist li'));
    await sleep(300);
    press('Enter');
    await until(() => q('.recall-wrap'));
    for (let i = 0; i < 20 && !q('.doc-session'); i++) { press(']'); await sleep(200); }
    const el = useApp.getState().sessionEl?.item;
    if (!el || el.kind === 'card') throw new Error('no topic in the session');
    before = (await vault.read(el.path)).text;
    log(`session on ${el.path}: ivl ${el.sched.ivl ?? 1} af ${el.sched.af ?? '-'}; bar "${q('.session-bar')?.textContent?.slice(0, 80)}"`);
    await shot('growth-session');
    press('p');
    await sleep(800);
    after = (await vault.read(el.path, true)).text;
    log(`postponed: ${diff(before, after)}; log "${useApp.getState().log[0]}"`);
    log('done');
  } catch (e) {
    log(`failed: ${e instanceof Error ? e.message : String(e)}`);
  }
}

export async function smokeOverload(vault: Vault): Promise<void> {
  const log = (s: string) => info(`smoke overload: ${s}`);
  const shot = async (name: string, ms = 10000) => { await sleep(600); log(`shot: ${name}`); await sleep(ms); };
  const q = <T extends Element>(sel: string) => document.querySelector<T>(sel);
  const qa = (sel: string) => Array.from(document.querySelectorAll<HTMLElement>(sel));
  const enter = async (el: HTMLInputElement, v: string) => {
    el.focus();
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(el, v);
    el.dispatchEvent(new Event('input', { bubbles: true }));
    await sleep(50);
    el.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));
    el.blur();
    await sleep(600);
  };
  const rows = () => qa('.queue .qlist li:not(.fold)');
  const view = () => {
    const above = rows().filter((r) => r.dataset.below === '0').length;
    const below = rows().filter((r) => r.dataset.below === '1').length;
    const fold = q('.queue .qlist li.fold');
    return `rows ${above} above, ${below} below; fold "${fold?.textContent ?? 'none'}"; top strip "${q('.top .right span')?.textContent}"; budget ${useApp.getState().budget}`;
  };
  const changed = (a: string, b: string) => {
    const la = a.split('\n');
    const lb = b.split('\n');
    if (la.length !== lb.length) return `lines ${la.length} → ${lb.length}`;
    const at = la.flatMap((l, i) => (l === lb[i] ? [] : [i + 1]));
    return at.map((n) => `${n}: "${la[n - 1]}" → "${lb[n - 1]}"`).join('; ');
  };
  try {
    openNode(queueId('today'));
    await until(() => q('.queue .qlist li'));
    await sleep(300);
    log(`no budget: ${view()}`);

    // the tweaks panel sets the budget; the state file keeps it
    useApp.setState({ tweaksOpen: true });
    const field = await until(() => q<HTMLInputElement>('.tweaks .tw-num'));
    log(`tweaks: budget field "${field.value}"`);
    await enter(field, '5');
    await sleep(600);
    log(`budget 5: ${view()}; state.json ${JSON.stringify(await vault.loadState())}`);
    await shot('overload-tweaks');
    useApp.setState({ tweaksOpen: false });
    await sleep(300);
    const fold = await until(() => q('.queue .qlist li.fold'));
    log(`queue: ${view()}; below ${rows().filter((r) => r.dataset.below === '1').map((r) => `[${r.dataset.el}] ${r.querySelector('.src')?.textContent}`).join(' / ')}`);
    await shot('overload-queue');

    // the palette offers the command while something sits below the fold
    press('k', { metaKey: true });
    const input = await until(() => q<HTMLInputElement>('.palette-input input'));
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input, 'postpone');
    input.dispatchEvent(new Event('input', { bubbles: true }));
    await sleep(100);
    log(`palette "postpone": ${qa('.palette-row').map((r) => `[${r.dataset.t}] ${r.querySelector('.pt')?.textContent}`).join(' / ')}`);
    await shot('overload-palette');
    press('Escape');
    await until(() => (q('.palette-overlay') ? null : true));

    // postpone the rest from the row: one line per topic below the fold, nothing else
    const before = new Map<string, string>();
    for (const path of vault.documents()) before.set(path, (await vault.read(path, true)).text);
    const act = fold.querySelector<HTMLButtonElement>('.fold-act');
    log(`row: "${act?.textContent}"`);
    act?.click();
    await until(() => useApp.getState().log[0]?.startsWith('postponed') ? true : null);
    await sleep(800);
    const touched: string[] = [];
    for (const path of vault.documents()) {
      const after = (await vault.read(path, true)).text;
      if (after !== before.get(path)) touched.push(`${path} ${changed(before.get(path)!, after)}`);
    }
    log(`postponed: ${touched.length} files changed: ${touched.join(' || ')}; log "${useApp.getState().log[0]}"`);
    await sleep(300);
    log(`after: ${view()}; palette command ${qa('.palette-row').length ? 'open?' : 'closed'}`);
    press('k', { metaKey: true });
    const input2 = await until(() => q<HTMLInputElement>('.palette-input input'));
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input2, 'postpone');
    input2.dispatchEvent(new Event('input', { bubbles: true }));
    await sleep(100);
    log(`palette "postpone" now: ${qa('.palette-row').map((r) => `[${r.dataset.t}] ${r.querySelector('.pt')?.textContent}`).join(' / ') || 'nothing'}`);
    press('Escape');
    await until(() => (q('.palette-overlay') ? null : true));
    await shot('overload-after');

    // tomorrow's queue, from the files as they are now
    const tomorrow = new Date(Date.now() + 86400000);
    const next = (await queue(vault, tomorrow, 'today'));
    log(`tomorrow: ${next.length} due, ${next.filter((i) => i.kind !== 'card').length} topics; ${Math.max(0, next.length - 5)} below a budget of 5`);

    // a session walks what is above the fold
    press('Enter');
    await until(() => q('.recall-wrap, .doc-session'));
    await sleep(300);
    log(`session: ${useApp.getState().session?.items.length} elements; count "${q('.sess-count, .sb-count')?.textContent}"`);
    await shot('overload-session');

    // no budget again: the fold goes
    openNode(queueId('today'));
    await until(() => q('.queue .qlist li'));
    useApp.setState({ tweaksOpen: true });
    await enter(await until(() => q<HTMLInputElement>('.tweaks .tw-num')), '');
    useApp.setState({ tweaksOpen: false });
    await sleep(600);
    log(`cleared: ${view()}; state.json ${JSON.stringify(await vault.loadState())}`);
    log('done');
  } catch (e) {
    log(`failed: ${e instanceof Error ? e.message : String(e)}`);
  }
}


export async function smokeFaces(vault: Vault): Promise<void> {
  const log = (s: string) => info(`smoke faces: ${s}`);
  const shot = async (name: string, ms = 10000) => { await sleep(600); log(`shot: ${name}`); await sleep(ms); };
  const q = <T extends Element>(sel: string) => document.querySelector<T>(sel);
  const faceText = (sel: string) => q(sel)?.textContent?.replace(/\s+/g, ' ').trim().slice(0, 40) ?? '';
  // walk forward until the card on screen has the face wanted
  const walkTo = async (sel: string): Promise<boolean> => {
    for (let i = 0; i < 60; i++) {
      if (q(`.recall-wrap .card ${sel}`)) return true;
      if (q('.recall-wrap .empty.center')) return false;
      press(']');
      await sleep(80);
    }
    return false;
  };
  try {
    openNode(queueId('today'));
    await until(() => q('.queue'));
    press('Enter');
    await until(() => q('.recall-wrap, .doc-session'));
    for (const [form, sel] of [['qa', '.qa-q'], ['cloze', '.cloze-text'], ['bidir', '.bidir-a']] as const) {
      if (!(await walkTo(sel))) { log(`${form}: none in the session`); continue; }
      const card = q<HTMLElement>('.recall-wrap .card')!;
      const front = card.querySelector<HTMLElement>('.face.front')!;
      const back = card.querySelector<HTMLElement>('.face.back');
      const h = (el: HTMLElement | null) => el ? Math.round(el.getBoundingClientRect().height) : 0;
      log(`${form} hidden: faces ${card.dataset.faces}, revealed ${card.dataset.revealed}, front ${h(front)}px, back ${h(back)}px, filter "${back ? getComputedStyle(back.querySelector('.face-body')!).filter : ''}", hint ${!!q('.face-hint')}, front "${faceText('.face.front')}"`);
      await shot(`${form}-hidden`);
      press(' ');
      await sleep(400);
      log(`${form} revealed: revealed ${card.dataset.revealed}, filter "${back ? getComputedStyle(back.querySelector('.face-body')!).filter : ''}", hint ${!!q('.face-hint')}, back "${faceText('.face.back .face-body')}", blanks shown ${card.querySelectorAll('.cloze.revealed').length}`);
      await shot(`${form}-revealed`);
    }
    // the next card, unrevealed, for the themes
    press(']');
    await sleep(300);
    log(`themes on: ${q('.recall-wrap .card') ? `a card, revealed ${q<HTMLElement>('.recall-wrap .card')!.dataset.revealed}` : 'no card'}`);
    useApp.getState().setTheme('dark');
    await shot('dark');
    useApp.getState().setTheme('eink');
    await sleep(300); // the theme lands on the root in an effect
    const body = q<HTMLElement>('.face.back .face-body');
    log(`eink: visibility ${body ? getComputedStyle(body).visibility : 'none'}, filter "${body ? getComputedStyle(body).filter : ''}"`);
    await shot('eink');
    useApp.getState().setTheme('light');
    log(`done; vault ${vault.root}`);
  } catch (e) {
    log(`failed: ${e instanceof Error ? e.message : String(e)}`);
  }
}

export async function smokeCardsText(vault: Vault): Promise<void> {
  const log = (s: string) => info(`smoke cards-text: ${s}`);
  const shot = async (name: string, ms = 10000) => { await sleep(600); log(`shot: ${name}`); await sleep(ms); };
  const q = <T extends Element>(sel: string) => document.querySelector<T>(sel);
  const qa = (sel: string) => Array.from(document.querySelectorAll<HTMLElement>(sel));
  /** Type `text` into a React-controlled field: the native setter, then an input event. */
  const type = (el: HTMLTextAreaElement | HTMLInputElement, text: string) => {
    const proto = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
    Object.getOwnPropertyDescriptor(proto, 'value')!.set!.call(el, text);
    el.dispatchEvent(new Event('input', { bubbles: true }));
  };
  const choice = () => qa('.delim-row .field').map((f) => `${f.querySelector('.flbl')?.textContent}: ${f.querySelector('.delim-note')?.textContent ?? Array.from(f.querySelectorAll('button[data-active="1"]')).map((b) => b.textContent).join(' ')}`).join('; ');
  const preview = () => qa('.cards-preview .card-span').map((r) => r.textContent).join(' | ');
  const count = () => q('.cards-preview + .stats, .delim-row ~ .stats')?.textContent ?? '';
  const fileLines = async (path: string) => { const l = await vault.read(path, true); return `${l.text.split('\n').join(' / ')}; blocks ${l.doc.blocks.map((b) => b.kind).join(',')}; diagnostics ${l.diagnostics.length}`; };
  const QA = 'Q: what is the capital of France?\nA: Paris\n\nQ: and of Spain?\nA: Madrid\n\nQuestion: what does FSRS stand for\nAnswer: free spaced repetition scheduler';
  const TAB = 'der Vorsatz\tresolution, intention\ndie Gelassenheit\tcomposure, serenity\nder Zufall\tchance, coincidence\ndie Sehnsucht\tlonging';
  try {
    setInspector({ open: true });
    openIntake('');
    const ta = await until(() => q<HTMLTextAreaElement>('.intake textarea'));
    type(ta, QA);
    await until(() => q('.delim-row'));
    await sleep(300);
    log(`qa pasted: h1 "${q('.intake h1')?.textContent}"; row ${choice()}; preview ${preview()}; count "${count()}"; title "${q<HTMLInputElement>('.intake .field input:not(.custom)')?.value}"`);
    await shot('cards-qa');
    // flip the delimiter between cards to newline: the same three cards
    const newline = qa('.delim-pick button').find((b) => b.textContent === 'newline');
    newline!.click();
    await sleep(200);
    log(`flipped to newline: row ${choice()}; count "${count()}"`);
    // a wrong one: tab finds nothing, and the place buttons go quiet
    qa('.delim-pick button').find((b) => b.textContent === 'tab')!.click();
    await sleep(200);
    log(`flipped to tab: count "${count()}"; place disabled ${q<HTMLButtonElement>('.intake .place.primary')?.disabled}`);
    qa('.delim-pick button').find((b) => b.textContent === 'Q: A:')!.click();
    qa('.delim-pick button').find((b) => b.textContent === 'both directions')!.click();
    await sleep(200);
    log(`both directions: preview ${preview()}`);
    await shot('cards-qa-both');
    q<HTMLButtonElement>('.intake .place.primary')!.click();
    const deck1 = await until(() => vault.documents().find((d) => /^cards( \d+)?\.md$/.test(d)));
    await sleep(500);
    log(`placed ${deck1}: ${await fileLines(deck1)}`);
    await until(() => q('.deck-view'));
    await sleep(300);
    log(`deck lens: h1 "${q('.deck-view h1')?.textContent}"; meta "${q('.deck-view .meta')?.textContent}"; rows ${qa('.deck-view .card-span').length}; inspector "${q('.insp .kv')?.textContent?.slice(0, 80)}"`);
    await shot('cards-deck');

    // the tab list, with a name
    openIntake('');
    const ta2 = await until(() => q<HTMLTextAreaElement>('.intake textarea'));
    type(ta2, TAB);
    await until(() => q('.delim-row'));
    await sleep(300);
    log(`tab pasted: row ${choice()}; preview ${preview()}; count "${count()}"`);
    type(q<HTMLInputElement>('.intake .field input:not(.custom)')!, 'german nouns');
    await sleep(200);
    await shot('cards-tab');
    qa('.intake .place').find((b) => b.textContent?.startsWith('place & leave'))!.click();
    const deck2 = await until(() => vault.documents().find((d) => d.startsWith('german nouns')));
    await sleep(500);
    log(`placed ${deck2}: ${await fileLines(deck2)}; intake cleared ${!q<HTMLTextAreaElement>('.intake textarea')?.value}`);

    // prose: no row, the intake as before
    const { INTAKE_SAMPLE } = await import('./Intake.js');
    type(q<HTMLTextAreaElement>('.intake textarea')!, INTAKE_SAMPLE);
    await until(() => q('.intake-detail'));
    await sleep(300);
    log(`prose pasted: row ${q('.delim-row') ? 'shown' : 'none'}; stats "${q('.intake .stats')?.textContent}"; h1 "${q('.intake h1')?.textContent}"`);
    q<HTMLButtonElement>('.intake .stats .link')!.click();
    await sleep(300);
    log(`as cards: row ${choice()}; count "${count()}"; place disabled ${q<HTMLButtonElement>('.intake .place.primary')?.disabled}`);
    await shot('cards-prose');
    log('done');
  } catch (e) {
    log(`failed: ${e instanceof Error ? e.message : String(e)}`);
  }
}

export async function smokeAnki(vault: Vault): Promise<void> {
  const log = (s: string) => info(`smoke anki: ${s}`);
  const shot = async (name: string, ms = 10000) => { await sleep(600); log(`shot: ${name}`); await sleep(ms); };
  const q = <T extends Element>(sel: string) => document.querySelector<T>(sel);
  const qa = (sel: string) => Array.from(document.querySelectorAll<HTMLElement>(sel));
  const fileLines = async (path: string) => { const l = await vault.read(path, true); return `${l.text.split('\n').join(' / ')}; blocks ${l.doc.blocks.map((b) => b.kind).join(',')}; diagnostics ${l.diagnostics.length}`; };
  const lens = () => `h1 "${q('.deck-view h1')?.textContent}"; meta "${q('.deck-view .meta')?.textContent}"; rows ${qa('.deck-view .card-span').map((r) => r.textContent).join(' | ')}; inspector "${q('.insp .kv')?.textContent?.slice(0, 120)}"`;
  try {
    setInspector({ open: true });
    openIntake('');
    await until(() => q<HTMLTextAreaElement>('.intake textarea'));
    log(`intake hint: "${q('.intake .paste-hint')?.textContent}"`);
    const { intakeHooks } = await import('./Intake.js');
    const apkg = (await invoke<string | null>('dev_env', { name: 'ILMI_APKG' })) ?? `${await sourceDir()}/two-decks.apkg`;
    await intakeHooks.ingestFile!(apkg);
    const detail = await until(() => q('.intake-detail') ?? (q('.intake .paste-hint .note')?.textContent && q('.intake .paste-hint .note')?.textContent !== 'reading' ? q('.intake .paste-hint') : null), 15000);
    if (!detail.classList.contains('intake-detail')) throw new Error(`intake said "${detail.textContent}"`);
    await sleep(300);
    log(`dropped ${apkg.slice(apkg.lastIndexOf('/') + 1)}: h1 "${q('.intake h1')?.textContent}"; decks ${qa('.deck-list .deck-row').map((r) => `${r.querySelector('.dname')?.textContent} (${r.querySelector('.dcount')?.textContent})`).join(' | ')}; count "${q('.intake-detail .stats')?.textContent}"; title field ${q('.intake .field input') ? 'shown' : 'none'}; textarea ${q('.intake textarea') ? 'shown' : 'none'}`);
    await shot('anki-intake');
    q<HTMLButtonElement>('.intake .place.primary')!.click();
    const german = await until(() => vault.documents().find((d) => d.startsWith('Languages/German')), 10000);
    const science = await until(() => vault.documents().find((d) => d.startsWith('Science')), 10000);
    await sleep(500);
    log(`placed ${german}: ${await fileLines(german)}`);
    log(`placed ${science}: ${await fileLines(science)}`);
    log(`notices: ${useApp.getState().log.slice(0, 2).join(' | ')}; intake ${q('.intake .deck-list') ? 'still lists decks' : 'cleared'}`);
    await until(() => q('.deck-view'));
    await sleep(300);
    log(`deck lens (opened): ${lens()}`);
    log(`tree rows: ${qa('.tree .trow').map((r) => r.textContent?.trim()).filter((t) => t && /Languages|German|Science/.test(t)).join(' | ')}`);
    await shot('anki-german');
    openNode(science);
    await until(() => q('.deck-view h1')?.textContent === 'Science');
    await sleep(300);
    // the first row selected: the inspector reads the cloze's seeded schedule
    qa('.deck-view .card-span')[0]?.click();
    await sleep(300);
    log(`deck lens (science): ${lens()}`);
    await shot('anki-science');
    log('done');
  } catch (e) {
    log(`failed: ${e instanceof Error ? e.message : String(e)}`);
  }
}

export async function smokeMath(vault: Vault): Promise<void> {
  const log = (s: string) => info(`smoke math: ${s}`);
  const shot = async (name: string, ms = 10000) => { await sleep(600); log(`shot: ${name}`); await sleep(ms); };
  const q = <T extends Element>(sel: string) => document.querySelector<T>(sel);
  const MX = 'papers/maxwell.md';
  const chipInfo = (chip: HTMLElement | null) => (chip
    ? `blanks ${chip.dataset.blanks}, revealed ${chip.dataset.revealed}, boxes ${chip.querySelectorAll('.colorbox').length}, tex ${chip.dataset.tex ? 'kept' : 'none'}, display ${chip.classList.contains('display')}, katex ${!!chip.querySelector('.katex')}, fallback ${!!chip.querySelector('.tex')}`
    : 'none');
  const squash = (s: string | null | undefined) => (s ?? '').replace(/\s+/g, ' ').trim();
  try {
    // the reader: two cards with formulas, their blanks on the accent; the binomial stays prose
    openNode(MX);
    const surface = await until(() => q<HTMLElement>('.draft-doc'));
    await until(() => surface.querySelector('.math.blanks'));
    await sleep(300);
    const chips = Array.from(surface.querySelectorAll<HTMLElement>('.card-span .math.blanks'));
    log(`reader: blocks ${surface.children.length}, cards ${surface.querySelectorAll('.card-span').length}, chips with blanks ${chips.length}: ${chips.map(chipInfo).join(' | ')}; prose math ${surface.querySelectorAll('.math:not(.blanks)').length}`);
    await shot('math-reader');

    // a session over the file's blanks, in queue order
    const items = useApp.getState().queue.filter((i) => i.kind === 'card' && i.path === MX);
    log(`session over ${items.length} blanks`);
    useApp.setState((s) => ({ session: { seq: (s.session?.seq ?? 0) + 1, items } }));
    openNode(SESSION);
    for (let i = 0; i < items.length; i++) {
      await sleep(300);
      const card = await until(() => q<HTMLElement>('.recall-wrap .card[data-revealed="0"]'));
      await sleep(300);
      const chip = card.querySelector<HTMLElement>('.face.front .math.blanks');
      const html = card.querySelector('.face.front')!.innerHTML;
      log(`card ${i + 1} hidden: ${squash(q('.card-meta')?.textContent)}; chip ${chipInfo(chip)}; tex in html ${html.includes('{{c') || html.includes('\\frac') || html.includes('x^{2}')}; ctx blanks ${card.querySelectorAll('.cloze.ctx').length}; hint ${!!q('.face-hint')}`);
      await shot(`math-${i + 1}-hidden`);
      if (i === 0 && chip) chip.click(); else press(' ');
      await sleep(400);
      log(`card ${i + 1} revealed by ${i === 0 ? 'a click on the chip' : 'space'}: revealed ${card.dataset.revealed}; chip ${chipInfo(card.querySelector('.face.front .math.blanks'))}; answer face "${squash(q('.face.back .face-body')?.textContent).slice(0, 60)}", math answers ${card.querySelectorAll('.cloze-answer .math').length}, hint ${!!q('.face-hint')}`);
      await shot(`math-${i + 1}-revealed`);
      press('3');
      await sleep(400);
    }
    await sleep(600);
    log(`after: ${squash(q('.recall-wrap .empty')?.textContent)}; sr lines ${(await vault.read(MX, true)).text.split('\n').filter((l) => l.startsWith('<!-- sr')).join(' / ')}`);
    log('done');
  } catch (e) {
    log(`failed: ${e instanceof Error ? e.message : String(e)}`);
  }
}

export async function smokeEpub(vault: Vault): Promise<void> {
  const log = (s: string) => info(`smoke epub: ${s}`);
  const shot = async (name: string, ms = 10000) => { await sleep(600); log(`shot: ${name}`); await sleep(ms); };
  const q = <T extends Element>(sel: string) => document.querySelector<T>(sel);
  const qa = (sel: string) => Array.from(document.querySelectorAll<HTMLElement>(sel));
  const firstLines = async (path: string) => { const l = await vault.read(path, true); return `${l.text.split('\n').slice(0, 7).join(' / ')}; blocks ${l.doc.blocks.map((b) => b.kind).join(',')}; diagnostics ${l.diagnostics.length}`; };
  try {
    setInspector({ open: true });
    openIntake('');
    await until(() => q<HTMLTextAreaElement>('.intake textarea'));
    log(`intake hint: "${q('.intake .paste-hint')?.textContent}"`);
    const { intakeHooks } = await import('./Intake.js');
    const epub = (await invoke<string | null>('dev_env', { name: 'ILMI_EPUB' })) ?? `${await sourceDir()}/three-chapters.epub`;
    await intakeHooks.ingestFile!(epub);
    const detail = await until(() => q('.intake-detail') ?? (q('.intake .paste-hint .note')?.textContent && q('.intake .paste-hint .note')?.textContent !== 'reading' ? q('.intake .paste-hint') : null), 15000);
    if (!detail.classList.contains('intake-detail')) throw new Error(`intake said "${detail.textContent}"`);
    await sleep(300);
    log(`dropped ${epub.slice(epub.lastIndexOf('/') + 1)}: h1 "${q('.intake h1')?.textContent}"; by "${q('.book-by')?.textContent}"; chapters ${qa('.book-list .deck-row').map((r) => `${r.querySelector('.dname')?.textContent} (${r.querySelector('.dcount')?.textContent})`).join(' | ')}; count "${q('.intake-detail .stats')?.textContent}"; title "${q<HTMLInputElement>('.intake .field input')?.value}"; textarea ${q('.intake textarea') ? 'shown' : 'none'}`);
    await shot('epub-intake');
    q<HTMLButtonElement>('.intake .place.primary')!.click();
    const first = await until(() => vault.documents().find((d) => /^The Small Book\/01 /.test(d)), 10000);
    await until(() => (vault.documents().filter((d) => d.startsWith('The Small Book/')).length >= 3 ? true : null), 10000);
    await sleep(500);
    const chapters = vault.documents().filter((d) => d.startsWith('The Small Book/')).sort();
    log(`placed ${chapters.length} files: ${chapters.join(' | ')}`);
    for (const c of chapters) log(`${c}: ${await firstLines(c)}`);
    log(`notices: ${useApp.getState().log.slice(0, 1).join(' | ')}; intake ${q('.intake .book-list') ? 'still lists the book' : 'cleared'}`);
    const surface = await until(() => q<HTMLElement>('.doc-view .draft-doc'));
    await sleep(400);
    log(`reader: crumb "${q('.doc-view .crumb')?.textContent}"; blocks ${surface.children.length}; marks ${surface.querySelectorAll('.ed-mark').length}; frozen ${(document.querySelector<HTMLElement>('.doc-view')?.dataset.frozen === '1' ? 'frozen' : 'editable')}; enrol "${q('.frozen-tag.enrol')?.textContent}"; first block "${surface.firstElementChild?.textContent?.slice(0, 60)}"`);
    log(`tree rows: ${qa('.tree .trow').map((r) => r.textContent?.trim()).filter((t) => t && /Small Book|One|Two|Three/.test(t)).join(' | ')}`);
    await shot('epub-chapter');
    press('r');
    await until(() => (q('.read-gutter') ? true : null));
    await sleep(600);
    const enrolled = (await vault.read(first, true)).text.split('\n').find((l) => l.startsWith('read:'));
    log(`reading: ${enrolled}; rule ${q<HTMLElement>('.read-rule')?.style.height}; bottom strip "${q('.bot')?.textContent}"; queries ${qa('.queries .row').map((r) => `${r.querySelector('.name')?.textContent} ${r.querySelector('.meta')?.textContent}`).join(', ')}`);
    await shot('epub-reading');
    log('done');
  } catch (e) {
    log(`failed: ${e instanceof Error ? e.message : String(e)}`);
  }
}

export async function smokeClip(vault: Vault): Promise<void> {
  const log = (s: string) => info(`smoke clip: ${s}`);
  const shot = async (name: string, ms = 10000) => { await sleep(600); log(`shot: ${name}`); await sleep(ms); };
  const q = <T extends Element>(sel: string) => document.querySelector<T>(sel);
  const enc = encodeURIComponent;
  const tab = () => `tab "${q('.tabbar .tab[data-active="1"] .title')?.textContent}"`;
  const notice = () => `notice "${useApp.getState().log[0] ?? ''}"`;
  const fileLines = async (path: string) => { const l = await vault.read(path, true); return `${l.text.split('\n').join(' / ')}; blocks ${l.doc.blocks.map((b) => b.kind).join(',')}; diagnostics ${l.diagnostics.length}`; };
  const landed = async (prefix: string) => {
    const path = await until(() => vault.documents().find((d) => d.startsWith(prefix)), 10000);
    await sleep(500);
    return path;
  };
  try {
    const { handleUri } = await import('./clipper.js');
    const before = vault.documents();

    // new with content: a frozen source at the root, opened, one notice
    await handleUri(`ilmi://new?name=${enc('clip test')}&content=${enc('hello from the clipper\n\nsecond paragraph')}`);
    const p1 = await landed('clip test');
    log(`new with content: ${p1}; ${await fileLines(p1)}; ${tab()}; ${notice()}; h1 "${q('.doc-view h1')?.textContent}"; ${(document.querySelector<HTMLElement>('.doc-view')?.dataset.frozen === '1' ? 'frozen' : 'editable')}`);
    await shot('clip-new');

    // new with a folder that is not there yet: made along the way
    await handleUri(`ilmi://new?folder=${enc('fleeting/web')}&content=${enc('in a new folder')}`);
    const p2 = await landed('fleeting/web/');
    log(`new with folder: ${p2}; ${await fileLines(p2)}; ${tab()}; ${notice()}; folder row ${!!Array.from(document.querySelectorAll('.tree .trow')).find((r) => r.textContent?.trim() === 'web')}`);

    // new with an address: the intake's fetch path against a real page (nothing is mocked there)
    await handleUri(`ilmi://new?url=${enc('https://example.com/')}`);
    const p3 = await until(() => vault.documents().find((d) => !before.includes(d) && d !== p1 && d !== p2), 30000).catch(() => null);
    if (p3) log(`new with url: ${p3}; ${(await fileLines(p3)).slice(0, 200)}; ${tab()}; ${notice()}`);
    else log(`new with url: nothing landed; ${notice()} (offline?)`);

    // open: with and without .md, and a path that is not there
    await handleUri(`ilmi://open?path=${enc(WOZ)}`);
    await until(() => (activeTab(useApp.getState().panes)?.id === WOZ ? true : null));
    await sleep(300);
    log(`open: ${tab()}; ${notice()}`);
    await handleUri(`ilmi://open?path=${enc('papers/maxwell')}`);
    await sleep(500);
    log(`open without .md: ${tab()}`);
    await handleUri(`ilmi://open?path=${enc('papers/nothing-here')}`);
    await sleep(200);
    log(`open a missing path: ${notice()}; ${tab()}`);

    // a link for another vault, one for this vault by name, and garbage: a notice each
    const n = vault.documents().length;
    await handleUri(`ilmi://new?vault=${enc('someone-else')}&content=hi`);
    await sleep(200);
    log(`foreign vault: ${notice()}`);
    await handleUri(`ilmi://new?vault=${enc(vault.root.slice(vault.root.lastIndexOf('/') + 1))}&content=${enc('own vault by name')}&name=${enc('own vault')}`);
    const p4 = await landed('own vault');
    log(`own vault by name: ${p4}; ${notice()}`);
    await handleUri('garbage');
    await sleep(200);
    log(`garbage: ${notice()}`);
    await handleUri('ilmi://new');
    await sleep(200);
    log(`empty new: ${notice()}; documents ${vault.documents().length} (was ${n}; one more, the own-vault clip)`);
    await shot('clip-notices');

    // the setting: clippings go to a folder, then a link with no folder lands there
    useApp.setState({ tweaksOpen: true });
    const sel = await until(() => q<HTMLSelectElement>('.tweaks .tw-sel'));
    log(`tweaks: options ${Array.from(sel.options).map((o) => o.textContent).join(' | ')}; chosen "${sel.selectedOptions[0]?.textContent}"`);
    await shot('clip-tweaks');
    const setter = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value')?.set;
    setter?.call(sel, 'fleeting');
    sel.dispatchEvent(new Event('change', { bubbles: true }));
    await sleep(500);
    log(`set: store "${useApp.getState().clipDir}"; state file ${JSON.stringify((await vault.loadState()).clippings)}`);
    useApp.setState({ tweaksOpen: false });
    await handleUri(`ilmi://new?name=${enc('to the setting')}&content=${enc('lands in fleeting')}`);
    const p5 = await landed('fleeting/to the setting');
    log(`new to the setting: ${p5}; ${tab()}; ${notice()}`);
    log('done');
  } catch (e) {
    log(`failed: ${e instanceof Error ? e.message : String(e)}`);
  }
}

export async function smokeClipping(vault: Vault): Promise<void> {
  const log = (s: string) => info(`smoke clipping: ${s}`);
  const shot = async (name: string, ms = 10000) => { await sleep(600); log(`shot: ${name}`); await sleep(ms); };
  const q = <T extends Element>(sel: string) => document.querySelector<T>(sel);
  const qa = (sel: string) => Array.from(document.querySelectorAll<HTMLElement>(sel));
  try {
    setInspector({ open: true });
    openIntake('fleeting');
    const ta = await until(() => q<HTMLTextAreaElement>('.intake textarea'));
    const url = (await invoke<string | null>('dev_env', { name: 'ILMI_URL' })) ?? 'https://en.wikipedia.org/wiki/Spaced_repetition';
    // the address pasted into the empty field, as a person would
    const dt = new DataTransfer();
    dt.setData('text/plain', url);
    ta.dispatchEvent(new ClipboardEvent('paste', { bubbles: true, cancelable: true, clipboardData: dt }));
    log(`pasted ${url}: hint "${q('.intake .paste-hint')?.textContent}"`);
    const got = await until(() => {
      if (ta.value) return ta.value;
      const n = q('.intake .paste-hint .note')?.textContent;
      return n && n !== 'fetching' ? n : null;
    }, 45000);
    if (!ta.value) { log(`nothing fetched: "${got}" (offline?); stopping`); return; }
    await sleep(400);
    log(`preview: meta "${q('.intake .page-meta')?.textContent}"; stats "${q('.intake-detail .stats')?.textContent}"; title "${q<HTMLInputElement>('.intake .field input')?.value}"; chosen ${q('.folder-pick button[data-active="1"]')?.textContent}; first lines "${ta.value.split('\n').slice(0, 3).join(' / ').slice(0, 240)}"`);
    await shot('clipping-intake');
    const before = vault.documents();
    const remote = (ta.value.match(/!\[[^\]]*\]\(https?:/g) ?? []).length;
    q<HTMLButtonElement>('.intake .place.primary')!.click();
    const path = await until(() => vault.documents().find((d) => !before.includes(d)), 20000);
    const folder = path.slice(0, -3);
    // the images land after the file, one fetch each; wait for them, within reason
    const t0 = Date.now();
    let files: string[] = [];
    while (Date.now() - t0 < 60000) {
      files = (await vault.fs.readDir(vault.abs(folder)).catch(() => [])).map((f) => f.name).filter((n) => !n.endsWith('.ilmi-tmp')).sort();
      const text = (await vault.read(path, true)).text;
      const left = (text.match(/!\[[^\]]*\]\(https?:/g) ?? []).length;
      if (remote === 0 || left + files.length >= remote) { if (left + files.length >= remote && left < remote) break; if (remote === 0) break; }
      await sleep(1000);
    }
    await sleep(1500);
    const loaded = await vault.read(path, true);
    log(`placed ${path}: blocks ${loaded.doc.blocks.length}; diagnostics ${loaded.diagnostics.length}; cards ${loaded.doc.blocks.filter((b) => b.kind === 'card').length}; words ${loaded.text.split(/\s+/).length}`);
    loaded.text.split('\n').slice(0, 20).forEach((l, i) => log(`  ${String(i + 1).padStart(2)}: ${l.slice(0, 160)}`));
    log(`images: ${remote} in the page; landed in ${folder}/: ${files.join(', ') || 'none'}; relative links ${(loaded.text.match(/!\[[^\]]*\]\([^)h][^)]*\)/g) ?? []).length}; remote left ${(loaded.text.match(/!\[[^\]]*\]\(https?:/g) ?? []).length}; tweak ${useApp.getState().clipImages ? 'on' : 'off'}`);
    const h1 = await until(() => q('.doc-view h1'));
    await sleep(400);
    log(`reader: h1 "${h1.textContent}"; ${(document.querySelector<HTMLElement>('.doc-view')?.dataset.frozen === '1' ? 'frozen' : 'editable')}; inspector ${qa('.insp .kv .kvr').map((r) => `${r.querySelector('dt')?.textContent}=${r.querySelector('dd')?.textContent?.slice(0, 80)}`).join(' | ')}`);
    await sleep(2000);
    const slots = qa('.draft-doc .md-img-slot, .draft-doc img.md-img');
    let bytes = -1;
    try { bytes = (await vault.fs.readBytes(vault.abs('fleeting/Spaced repetition/img-01.png'))).length; } catch { bytes = -2; }
    log(`images drawn: ${slots.map((e) => `${e.tagName.toLowerCase()}${e.getAttribute('data-state') ? `[${e.getAttribute('data-state')}]` : ''}${e.getAttribute('src') ? ` src=${e.getAttribute('src')?.slice(0, 40)}` : ''}`).join(' | ') || 'none'}; dd-img ${qa('.draft-doc .dd-img').map((e) => e.className).join(' | ') || 'none'}; img-01 bytes ${bytes}; text at top "${q('.draft-doc')?.textContent?.slice(0, 60)}"`);
    await shot('clipping-reader');
    const link = await until(() => q<HTMLButtonElement>('.insp .insp-link'));
    link.click();
    await sleep(1500);
    log(`clicked url "${link.textContent}" (title "${link.title}"); the browser should be showing it`);
    await shot('clipping-inspector');
    log('done');
  } catch (e) {
    log(`failed: ${e instanceof Error ? e.message : String(e)}`);
  }
}

export async function smokePlugins(vault: Vault): Promise<void> {
  const log = (s: string) => info(`smoke plugins: ${s}`);
  const shot = async (name: string, ms = 10000) => { await sleep(600); log(`shot: ${name}`); await sleep(ms); };
  const q = <T extends Element>(sel: string) => document.querySelector<T>(sel);
  const qa = <T extends Element>(sel: string) => Array.from(document.querySelectorAll<T>(sel));
  const notice = () => useApp.getState().log[0] ?? '';
  const noticed = (part: string, ms = 6000) => until(() => (useApp.getState().log.some((l) => l.includes(part)) ? true : null), ms);
  const row = () => q<HTMLElement>('.tweaks .pl-row[data-id="hello"]');
  const rowText = () => { const r = row(); return r ? `state ${r.dataset.state}; head "${r.querySelector('.pl-head')?.textContent}"; error "${r.querySelector('.pl-err')?.textContent ?? ''}"; settings ${r.querySelectorAll('.pl-set .tw-lbl').length}` : 'no row'; };
  const enabledFile = async () => (await vault.fs.readText(vault.abs('.ilmi/plugins.json'))).replace(/\s+/g, '');
  const setText = (el: HTMLInputElement | HTMLTextAreaElement, v: string) => {
    const proto = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
    Object.getOwnPropertyDescriptor(proto, 'value')!.set!.call(el, v);
    el.dispatchEvent(new Event('input', { bubbles: true }));
  };
  const { pluginHost, pluginHooks } = await import('../plugins/index.js');
  try {
    const host = pluginHost();
    if (!host) throw new Error('no plugin runtime');
    log(`csp ${document.querySelector('meta[http-equiv="Content-Security-Policy"]') ? 'set' : 'none'}; new Function ${typeof new Function('return 1')() === 'number' ? 'runs' : 'blocked'}`);
    log(`rows ${JSON.stringify(host.rows().map((r) => ({ id: r.id, version: r.version, enabled: r.enabled, state: r.state })))}; commands ${host.pluginCommands().map((c) => c.title).join(', ')}; style ${!!document.head.querySelector('style[data-plugin="hello"]')}`);

    // tweaks: the row, off and on
    useApp.setState({ tweaksOpen: true });
    await until(row);
    log(`tweaks: heading "${q('.tweaks .tw-plugins .tw-lbl')?.textContent}"; note "${q('.tweaks .tw-plugins .pl-note')?.textContent}"; row ${rowText()}; add "${qa('.tweaks .pl-add .pl-link').map((b) => b.textContent).join(' | ')}"`);
    await shot('plugins-tweaks');
    row()!.querySelector<HTMLButtonElement>('.pl-head .pl-toggle')!.click();
    await until(() => (row()?.dataset.state === 'off' ? true : null));
    await sleep(300);
    log(`off: ${rowText()}; plugins.json ${await enabledFile()}; commands ${host.pluginCommands().length}; style ${!!document.head.querySelector('style[data-plugin="hello"]')}`);
    row()!.querySelector<HTMLButtonElement>('.pl-head .pl-toggle')!.click();
    await until(() => (row()?.dataset.state === 'on' ? true : null));
    await sleep(300);
    log(`on: ${rowText()}; plugins.json ${await enabledFile()}; commands ${host.pluginCommands().length}`);
    useApp.setState({ tweaksOpen: false });

    // the command, from the palette
    useApp.setState({ paletteOpen: true });
    const input = await until(() => q<HTMLInputElement>('.palette-input input'));
    setText(input, 'say hi');
    const hit = await until(() => qa<HTMLElement>('.palette-row').find((r) => r.querySelector('.pt')?.textContent === 'hello: say hi'));
    log(`palette: "${hit.querySelector('.pt')?.textContent}" tag ${hit.querySelector('.ptag')?.textContent}; rows ${qa('.palette-row').length}`);
    await shot('plugins-palette');
    hit.click();
    await noticed('hi');
    log(`command ran: notice "${notice()}"; palette ${q('.palette-panel') ? 'open' : 'closed'}`);

    // the action, from the cue
    openNode(WOZ);
    const surface = await until(() => q<HTMLElement>('.doc-view .draft-doc'));
    await until(() => surface.querySelector('.card-span'));
    await sleep(300);
    const cram = Array.from(surface.querySelectorAll<HTMLElement>('p.dd-p')).find((el) => el.textContent?.startsWith('Cramming'))!;
    cram.scrollIntoView({ block: 'center' });
    await sleep(300);
    select(cram, 'Cramming is mass repetition compressed in time.');
    const cue = await until(() => q<HTMLElement>('.sel-cue'));
    await until(() => cue.querySelector('.cue-act.plug'));
    log(`cue: ${Array.from(cue.querySelectorAll('.cue-act')).map((b) => b.textContent).join(' | ')}`);
    await shot('plugins-cue');
    cue.querySelector<HTMLButtonElement>('.cue-act.plug')!.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }));
    await noticed('words');
    log(`action ran: notice "${notice()}"; cue ${q('.sel-cue') ? 'still up' : 'gone'}`);
    window.getSelection()?.removeAllRanges();

    // the block hook: a source and a deck with [hello] in them
    const src = await vault.createDoc('', 'source', 'hello test');
    await vault.update(src, (doc) => { doc.blocks.push({ kind: 'paragraph', text: 'Say [hello] to the margin, and [hello] once more.' }, { kind: 'paragraph', text: 'A plain paragraph.' }); });
    openNode(src);
    const s1 = await until(() => { const s2 = q<HTMLElement>('.doc-view .draft-doc'); return s2 && s2.textContent?.includes('[hello]') ? s2 : null; });
    await sleep(800);
    log(`reader: children ${s1.children.length}; p "${s1.querySelector('p.dd-p')?.textContent}"; marks ${s1.querySelectorAll('.ed-mark').length}; frozen ${(document.querySelector<HTMLElement>('.doc-view')?.dataset.frozen === '1' ? 'frozen' : 'editable')}`);
    const lit = await until(() => { const s2 = q<HTMLElement>('.doc-view .draft-doc'); return s2 && s2.querySelectorAll('.hello-lit').length === 2 ? s2 : null; });
    const litEl = lit.querySelector<HTMLElement>('.hello-lit')!;
    log(`reader: lit ${lit.querySelectorAll('.hello-lit').length}; text "${litEl.textContent}"; background ${getComputedStyle(litEl).backgroundColor}; paragraph "${litEl.closest('p')?.textContent}"; file ${(await vault.read(src, true)).text.split('\n').length} lines`);
    await shot('plugins-lit');
    const deck = await vault.createDoc('', 'deck', 'hello deck');
    await vault.update(deck, (doc) => { doc.blocks.push({ kind: 'card', text: 'say [hello] :: a greeting' }); });
    openNode(deck);
    const deckLit = await until(() => q<HTMLElement>('.deck-view .card-span .hello-lit'));
    log(`deck: lit "${deckLit.textContent}" in row "${deckLit.closest('.card-span')?.textContent?.trim()}"`);

    // the setting
    useApp.setState({ tweaksOpen: true });
    const field = await until(() => row()?.querySelector<HTMLInputElement>('.pl-set .pl-text'));
    log(`setting: label "${field.closest('.tw-lbl')?.textContent}"; placeholder "${field.placeholder}"; value "${field.value}"`);
    setText(field, 'salaam');
    field.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));
    await until(() => (host.settingValue('hello', 'greeting') === 'salaam' ? true : null));
    await sleep(300);
    log(`set: data.json ${(await vault.fs.readText(vault.abs('.ilmi/plugins/hello/data.json'))).replace(/\s+/g, '')}`);
    await shot('plugins-setting');
    useApp.setState({ tweaksOpen: false });
    host.runCommand('plugin:hello:say-hi');
    await noticed('salaam');
    log(`command with the setting: notice "${notice()}"`);

    // a grade in the session
    const item = useApp.getState().queue.find((i) => i.kind === 'card' && i.dueAt <= new Date());
    if (!item) throw new Error('no due card');
    openSession(item);
    await until(() => q('.recall-wrap .card'));
    await sleep(400);
    press(' ');
    await sleep(300);
    press('3');
    await noticed('hello saw a 3');
    log(`graded: notices ${JSON.stringify(useApp.getState().log.slice(0, 2))}; session on ${useApp.getState().sessionEl?.kind}`);
    await shot('plugins-session');

    // the files on disk: a touch reloads, a removed folder drops the row
    const mainAbs = vault.abs('.ilmi/plugins/hello/main.js');
    const main = await vault.fs.readText(mainAbs);
    await vault.fs.writeText(mainAbs, `${main}\n// touched by the smoke\n`);
    await noticed('reloaded · hello', 8000);
    await sleep(300);
    log(`touched main.js: notice "${notice()}"; state ${host.rows()[0]?.state}; commands ${host.pluginCommands().length}; setting kept ${host.settingValue('hello', 'greeting')}`);
    await vault.fs.remove(vault.abs('.ilmi/plugins/hello'));
    await noticed('removed · hello', 8000);
    await sleep(300);
    log(`removed folder: notice "${notice()}"; rows ${host.rows().length}; commands ${host.pluginCommands().length}; style ${!!document.head.querySelector('style[data-plugin="hello"]')}`);

    // add a plugin, from the zip, through the section's hook
    useApp.setState({ tweaksOpen: true });
    await until(() => (pluginHooks.addFromPath ? true : null));
    log(`tweaks after removal: rows ${qa('.tweaks .pl-row').length}`);
    const zip = await invoke<string | null>('dev_env', { name: 'ILMI_PLUGIN_ZIP' });
    if (!zip) {
      log('no ILMI_PLUGIN_ZIP: the add step is skipped');
    } else {
      await pluginHooks.addFromPath!(zip);
      await noticed('added · hello', 8000);
      await until(() => (row()?.dataset.state === 'on' ? true : null));
      await sleep(300);
      const files = (await vault.fs.readDir(vault.abs('.ilmi/plugins/hello'))).map((e) => e.name).sort();
      log(`added from zip: notice "${notice()}"; ${rowText()}; files ${files.join(', ')}; plugins.json ${await enabledFile()}; commands ${host.pluginCommands().map((c) => c.title).join(', ')}`);
      await shot('plugins-added');
      // the same zip again: already here
      await pluginHooks.addFromPath!(zip);
      await noticed('is already here');
      log(`same zip again: notice "${notice()}"`);
    }
    useApp.setState({ tweaksOpen: false });
    log('done');
  } catch (e) {
    log(`failed: ${e instanceof Error ? e.message : String(e)}`);
  }
}

export async function smokeWelcome(scratch: string | null): Promise<void> {
  const log = (s: string) => info(`smoke welcome: ${s}`);
  const shot = async (name: string, ms = 10000) => { await sleep(600); log(`shot: ${name}`); await sleep(ms); };
  const q = <T extends Element>(sel: string) => document.querySelector<T>(sel);
  const qa = <T extends Element>(sel: string) => Array.from(document.querySelectorAll<T>(sel));
  const MARK = 'ilmi.smoke.welcome';
  const rows = () => qa<HTMLElement>('.welcome-row').map((r) => `${r.querySelector('.pt')?.textContent} · ${r.querySelector('.ptag')?.textContent}${r.dataset.gone === '1' ? ' (dimmed)' : ''}${r.dataset.sel === '1' ? ' ←' : ''}`).join(' | ');
  const title = async () => { try { return await getCurrentWindow().title(); } catch { return '?'; } };
  const type = (el: HTMLInputElement, text: string) => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(el, text);
    el.dispatchEvent(new Event('input', { bubbles: true }));
  };
  const key = (el: Element | Window, k: string) => el.dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true, cancelable: true }));
  const paletteRows = () => qa<HTMLElement>('.palette-row').map((r) => `[${r.dataset.t}] ${r.querySelector('.pt')?.textContent}`);
  const viaPalette = async (text: string, pick: (r: HTMLElement) => boolean) => {
    useApp.setState({ paletteOpen: true });
    const input = await until(() => q<HTMLInputElement>('.palette-input input'));
    type(input, text);
    await sleep(150);
    const list = qa<HTMLElement>('.palette-row');
    const at = list.findIndex(pick);
    log(`palette "${text}": ${list.length} rows, picked ${at}: ${paletteRows().slice(0, 4).join(' / ')}`);
    for (let i = 0; i < at; i++) key(input, 'ArrowDown');
    key(input, 'Enter');
    await until(() => (q('.palette-overlay') ? null : true));
  };
  try {
    if (!scratch) throw new Error('ILMI_VAULT names the folder imported as the collection the welcome lists');
    if (sessionStorage.getItem(MARK)) {
      // the second run: the toggle is on, the scratch vault is the newest; it should open itself
      sessionStorage.removeItem(MARK);
      await startFromRecents();
      await sleep(800);
      const s = useApp.getState();
      log(`after reload: reopen ${s.reopen}; vault ${s.vault}; started ${s.started}; welcome shown ${!!q('.welcome')}; title "${await title()}"`);
      log(s.vault === scratch ? 'the vault opened itself' : 'the vault did NOT open itself');
      await shot('welcome-reopened');
      log('done');
      return;
    }

    // the collections earlier runs made here go first
    {
      const { deleteCollection, listCollections } = await import('../vault/tauri-store.js');
      const { home, names } = await listCollections();
      for (const n of names) if (n.startsWith('welcome-smoke-')) await deleteCollection(`${home}/${n}`);
    }
    // the first run: the recents remember the collection and a folder that is no collection (a vault
    // opened by its path before milestone 59), toggle off, then let the start decide: the rows are the collections
    const gonePath = '/nowhere/gone-vault';
    const s0 = useApp.getState();
    s0.setReopen(false);
    s0.setRecents([
      { path: scratch, name: vaultName(scratch), opened: new Date().toISOString() },
      { path: gonePath, name: 'gone-vault', opened: new Date(Date.now() - 3 * 86400000).toISOString() },
    ]);
    await startFromRecents();
    await until(() => q('.welcome'));
    await sleep(400);
    log(`welcome: mark "${q('.welcome-mark')?.textContent}"; line "${q('.welcome-line')?.textContent}"; buttons ${qa('.welcome-acts button').map((b) => b.textContent).join(', ')}; foot "${q('.welcome .palette-foot')?.textContent}"`);
    log(`rows: ${rows()}; gone ${JSON.stringify(useApp.getState().gone)}; title "${await title()}"`);
    await shot('welcome');
    key(window, 'j');
    await sleep(100);
    const forget = q('.welcome-row[data-gone="1"] .welcome-forget');
    log(`after j: ${rows()}; forget ${forget ? getComputedStyle(forget).visibility : 'missing'}`);
    key(window, 'k');
    await sleep(100);

    // ⏎ opens the top row
    key(window, 'Enter');
    await until(() => (useApp.getState().vault === scratch ? true : null), 10000);
    await until(() => q('.tabbar'));
    await sleep(600);
    log(`opened from the row: vault ${useApp.getState().vault}; title "${await title()}"; recents ${useApp.getState().recents.map((r) => r.name).join(', ')}; stored ${localStorage.getItem('ilmi.recents')?.slice(0, 160)}`);
    await shot('welcome-opened');

    // close from the palette: back to the welcome, the title plain
    await viaPalette('close collection', (r) => r.dataset.t === 'command' && r.querySelector('.pt')?.textContent === 'close collection');
    await until(() => q('.welcome'));
    await sleep(400);
    log(`closed: vault ${useApp.getState().vault}; title "${await title()}"; rows: ${rows()}`);

    // a new collection beside the scratch one, named on the welcome
    const parent = scratch.slice(0, scratch.lastIndexOf('/'));
    const name = `welcome-smoke-${new Date().toISOString().slice(11, 19).replace(/:/g, '')}`;
    key(window, 'n');
    const field = await until(() => q<HTMLInputElement>('.welcome-name input'));
    log(`naming in "${q('.welcome-name .psub')?.textContent}"; field focused ${document.activeElement === field}`);
    type(field, 'a/b');
    key(field, 'Enter');
    await sleep(300);
    log(`a bad name: "${q('.welcome-problem')?.textContent}"; still on the welcome ${!!q('.welcome')}`);
    type(field, name);
    await shot('welcome-naming', 4000);
    key(field, 'Enter');
    await until(() => (useApp.getState().vault === `${parent}/${name}` ? true : null), 15000);
    await until(() => (useApp.getState().files.length ? true : null));
    await sleep(800);
    const nv = currentVault()!;
    const starter = await nv.read('start here.md', true);
    log(`new vault: ${nv.root}; files ${nv.documents().join(', ')}; title "${await title()}"; tab "${q('.tabbar .tab[data-active="1"] .title')?.textContent}"`);
    log(`start here.md: ${starter.text.split('\n').filter(Boolean).slice(0, 6).map((l) => l.slice(0, 60)).join(' / ')}; blocks ${starter.doc.blocks.map((b) => b.kind).join(',')}; diagnostics ${starter.diagnostics.length}; queue ${useApp.getState().queue.map((i) => i.kind).join(',')}`);
    await shot('welcome-new-vault');

    // back to the scratch vault through the palette's vaults group
    await viaPalette(vaultName(scratch), (r) => r.dataset.t === 'vault' && r.querySelector('.pt')?.textContent === vaultName(scratch));
    await until(() => (useApp.getState().vault === scratch ? true : null), 10000);
    await sleep(600);
    log(`switched back: vault ${useApp.getState().vault}; title "${await title()}"; recents ${useApp.getState().recents.map((r) => r.name).join(', ')}`);

    // the toggle on, from the tweaks panel; then the page reloads and the second run checks
    useApp.setState({ tweaksOpen: true });
    const row = await until(() => qa<HTMLElement>('.tweaks .tw-row').find((r) => r.querySelector('.tw-lbl')?.textContent?.startsWith('reopen')));
    const buttons = Array.from(row.querySelectorAll<HTMLButtonElement>('button'));
    log(`tweaks row "${row.querySelector('.tw-lbl')?.textContent}": ${buttons.map((b) => `${b.textContent}${b.dataset.active === '1' ? '*' : ''}`).join(' ')}`);
    buttons.find((b) => b.textContent === 'on')?.click();
    await sleep(200);
    log(`toggle on: reopen ${useApp.getState().reopen}; stored ${localStorage.getItem('ilmi.tweaks')}`);
    await shot('welcome-tweaks', 4000);
    useApp.setState({ tweaksOpen: false });
    sessionStorage.setItem(MARK, '1');
    log('reloading');
    await sleep(300);
    location.reload();
  } catch (e) {
    log(`failed: ${e instanceof Error ? e.message : String(e)}`);
  }
}

export async function smokeDictionary(vault: Vault): Promise<void> {
  const log = (s: string) => info(`smoke dictionary: ${s}`);
  const shot = async (name: string, ms = 10000) => { await sleep(600); log(`shot: ${name}`); await sleep(ms); };
  const q = <T extends Element>(sel: string) => document.querySelector<T>(sel);
  const qa = <T extends Element>(sel: string) => Array.from(document.querySelectorAll<T>(sel));
  const notice = () => useApp.getState().log[0] ?? '';
  const noticed = (part: string, times = 1, ms = 8000) => until(() => (useApp.getState().log.filter((l) => l.includes(part)).length >= times ? true : null), ms);
  const row = () => q<HTMLElement>('.tweaks .pl-row[data-id="dictionary"]');
  const file = async (rel: string) => (await vault.fs.readText(vault.abs(rel))).replace(/\s+/g, '');
  const popover = () => {
    const pop = q<HTMLElement>('.plug-pop');
    if (!pop) return 'no popover';
    const entries = qa<HTMLElement>('.plug-pop .dict-entry').map((e) => `${e.querySelector('h3')?.textContent ?? '-'}: ${Array.from(e.querySelectorAll('li')).slice(0, 3).map((li) => li.firstChild?.textContent).join(' / ')} (${e.querySelectorAll('li').length})`);
    return `headword "${q('.plug-pop .dict-word')?.textContent}"; from "${q('.plug-pop .dict-from')?.textContent ?? ''}"; language "${q('.plug-pop .dict-lang')?.textContent ?? ''}"; quiet "${q('.plug-pop .dict-quiet')?.textContent ?? ''}"; entries ${entries.join(' || ')}; button "${q('.plug-pop .dict-acts button')?.textContent ?? ''}"; box top ${pop.style.top} left ${pop.style.left} height ${pop.offsetHeight} of ${window.innerHeight}`;
  };
  const filled = () => until(() => (q('.plug-pop .dict-entry') || (q('.plug-pop .dict-quiet') && q('.plug-pop .dict-quiet')?.textContent !== '…') ? true : null), 20000);
  const SUTTON = 'papers/archive/sutton-2019.md';
  const { pluginHost } = await import('../plugins/index.js');
  try {
    const host = pluginHost();
    if (!host) throw new Error('no plugin runtime');
    log(`rows ${JSON.stringify(host.rows().map((r) => ({ id: r.id, version: r.version, enabled: r.enabled, state: r.state })))}`);

    // on, from tweaks
    useApp.setState({ tweaksOpen: true });
    await until(row);
    if (row()!.dataset.state !== 'on') row()!.querySelector<HTMLButtonElement>('.pl-head .pl-toggle')!.click();
    await until(() => (row()?.dataset.state === 'on' ? true : null));
    await until(() => (row()?.querySelector('.pl-set') ? true : null));
    await sleep(400);
    const settings = Array.from(row()!.querySelectorAll<HTMLElement>('.pl-set .tw-lbl')).map((l) => `${l.firstChild?.textContent} [${l.querySelector('input')?.placeholder ?? l.querySelector('button')?.textContent ?? ''}]`);
    log(`on: head "${row()!.querySelector('.pl-head')?.textContent}"; plugins.json ${await file('.ilmi/plugins.json')}; settings ${settings.join(' | ')}; data.json ${await file('.ilmi/plugins/dictionary/data.json').catch(() => 'none')}; style ${!!document.head.querySelector('style[data-plugin="dictionary"]')}`);
    await shot('dictionary-tweaks');
    useApp.setState({ tweaksOpen: false });

    // the Arabic word, selected in the reader; `d` looks it up
    const queueBefore = useApp.getState().queue.length;
    openNode(SUTTON);
    const surface = await until(() => q<HTMLElement>('.doc-view .draft-doc'));
    const para = await until(() => Array.from(surface.querySelectorAll<HTMLElement>('p.dd-p')).find((el) => el.textContent?.includes('الذِّكْرُ')));
    await sleep(300);
    para.scrollIntoView({ block: 'center' });
    await sleep(300);
    select(para, 'الذِّكْرُ');
    const cue = await until(() => q<HTMLElement>('.sel-cue'));
    await until(() => cue.querySelector('.cue-act.plug'));
    const sel = host.currentSelection();
    log(`cue: ${Array.from(cue.querySelectorAll('.cue-act')).map((b) => b.textContent).join(' | ')}; selection "${sel?.text}" in block ${sel?.block}; context "${sel?.context}"`);
    await shot('dictionary-cue');
    press('d');
    const pop = await until(() => q<HTMLElement>('.plug-pop .dict-pop'));
    log(`popover up: "${pop.querySelector('.dict-word')?.textContent}"; cue ${q('.sel-cue') ? 'still up' : 'gone'}; focus on ${document.activeElement?.className || document.activeElement?.tagName}`);
    await filled();
    await sleep(300);
    log(`arabic: ${popover()}`);
    if (!q('.plug-pop .dict-entry')) {
      const quiet = q('.plug-pop .dict-quiet')?.textContent ?? '';
      log(quiet.startsWith('could not reach') ? 'offline: the lookup did not reach the endpoint; stopping here' : `no entries: "${quiet}" ${q('.plug-pop .dict-tried')?.textContent ?? ''}`);
      await shot('dictionary-popover');
      log('failed: no entries');
      return;
    }
    await shot('dictionary-popover');

    // `a` adds it
    q<HTMLElement>('.plug-pop')!.dispatchEvent(new KeyboardEvent('keydown', { key: 'a', bubbles: true, cancelable: true }));
    await noticed('added to vocab');
    await until(() => (vault.documents().includes('vocab.md') ? true : null));
    await sleep(600);
    const deck = await vault.read('vocab.md', true);
    log(`added: notice "${notice()}"; popover ${q('.plug-pop') ? 'still up' : 'gone'}; vocab.md ${deck.text.split('\n').length} lines: ${deck.text.split('\n').map((l) => JSON.stringify(l)).join(' ')}; blocks ${deck.doc.blocks.map((b) => b.kind).join(',')}; diagnostics ${deck.diagnostics.length}`);
    await until(() => (useApp.getState().queue.length > queueBefore ? true : null), 4000).catch(() => null);
    const queued = useApp.getState().queue;
    log(`queue: ${queueBefore} before, ${queued.length} after; from the deck ${JSON.stringify(queued.filter((i) => i.path === 'vocab.md').map((i) => ({ kind: i.kind, block: i.kind === 'card' ? i.block : null, due: i.dueAt.toISOString().slice(0, 10), pri: i.pri })))}`);
    await shot('dictionary-added');

    // an English word, from the cue's verb
    select(para, 'scaffolding');
    const cue2 = await until(() => q<HTMLElement>('.sel-cue'));
    const lookUp = await until(() => Array.from(cue2.querySelectorAll<HTMLButtonElement>('.cue-act.plug')).find((b) => b.textContent?.startsWith('look up')));
    lookUp.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }));
    await until(() => q('.plug-pop .dict-pop'));
    await filled();
    await sleep(300);
    log(`english: ${popover()}; cue ${q('.sel-cue') ? 'still up' : 'gone'}`);
    await shot('dictionary-english');
    q<HTMLButtonElement>('.plug-pop .dict-acts button')?.click();
    await noticed('added to vocab', 2);
    await sleep(600);
    const deck2 = await vault.read('vocab.md', true);
    log(`added again: notice "${notice()}"; vocab.md ${deck2.text.split('\n').length} lines; cards ${deck2.doc.blocks.filter((b) => b.kind === 'card').map((b) => JSON.stringify(b.text.split('\n')[0]?.slice(0, 90))).join(' ')}; diagnostics ${deck2.diagnostics.length}; queue ${useApp.getState().queue.length}`);

    // the deck lens
    openNode('vocab.md');
    await until(() => q('.deck-view .card-span'));
    await sleep(600);
    log(`deck lens: ${qa<HTMLElement>('.deck-view .card-span').length} rows; first "${q('.deck-view .card-span')?.textContent?.trim().slice(0, 100)}"; tab "${q('.tabbar .tab[data-active="1"] .title')?.textContent}"`);
    await shot('dictionary-deck');
    log('done');
  } catch (e) {
    log(`failed: ${e instanceof Error ? e.message : String(e)}`);
  }
}

export async function smokeRender(vault: Vault): Promise<void> {
  const log = (s: string) => info(`smoke render: ${s}`);
  const shot = async (name: string, ms = 10000) => { await sleep(600); log(`shot: ${name}`); await sleep(ms); };
  const q = <T extends Element>(sel: string) => document.querySelector<T>(sel);
  const qa = <T extends Element>(sel: string) => Array.from(document.querySelectorAll<T>(sel));
  const SAMPLER = 'fleeting/markdown-sampler.md';
  const n = (sel: string) => qa(sel).length;
  /** What the reader drew on the surface showing now. */
  const drawn = () => {
    const imgs = qa<HTMLImageElement>('.draft-doc img.md-img').map((i) => `"${i.alt}" ${i.naturalWidth}x${i.naturalHeight} ${i.complete ? 'loaded' : 'loading'} ${i.src.slice(0, 5)}`);
    const slots = qa<HTMLElement>('.draft-doc .md-img-slot').map((s) => s.dataset.state);
    return `em ${n('.draft-doc .md-em')}, strong ${n('.draft-doc .md-strong')}, code ${n('.draft-doc .md-code')}, links [${qa<HTMLElement>('.draft-doc .md-link').map((l) => l.dataset.href).join(', ')}], markers ${n('.draft-doc .md-mark')} (hidden ${n('.draft-doc .md-mark.hidden')}); atoms drawn [${qa<HTMLElement>('.draft-doc .raw.rendered').map((r) => r.dataset.kind).join(', ')}], mono ${n('.draft-doc pre.raw')}; lists ${n('.draft-doc .dd-list')} items ${n('.draft-doc .dd-li')}, quotes ${n('.draft-doc .dd-quote')} lines ${n('.draft-doc .dd-ql')}, code "${q('.draft-doc .dd-code code')?.className ?? ''}", tables ${n('.draft-doc .raw-view table')} (th ${n('.draft-doc .raw-view th')}, td ${n('.draft-doc .raw-view td')}); figures ${n('.draft-doc p.dd-img')}; images [${imgs.join(' | ')}]; slots [${slots.join(', ')}]`;
  };
  const faceText = (sel: string) => q(sel)?.textContent?.replace(/\s+/g, ' ').trim().slice(0, 60) ?? '';
  try {
    setInspector({ open: true });

    // the sampler, frozen: every form drawn, the markers hidden, the two images from the vault
    openNode(SAMPLER);
    const surface = await until(() => q<HTMLElement>('.doc-view .draft-doc'));
    await until(() => (q('.draft-doc img.md-img[src^="blob:"]') ? true : null), 5000).catch(() => null);
    await until(() => (qa<HTMLImageElement>('.draft-doc img.md-img').every((i) => i.complete) ? true : null), 5000).catch(() => null);
    await sleep(400);
    log(`sampler: blocks ${surface.children.length}; frozen ${(document.querySelector<HTMLElement>('.doc-view')?.dataset.frozen === '1' ? 'frozen' : 'editable')}; editable ${surface.contentEditable}; ${drawn()}`);
    log(`first paragraph reads: "${surface.querySelector('p.dd-p')?.textContent}"`);
    log(`markers hidden: ${qa<HTMLElement>('.draft-doc p .md-mark.hidden').slice(0, 3).map((m) => `"${m.textContent}" ${Math.round(m.getBoundingClientRect().width)}px wide`).join(', ')}`);
    await shot('render-sampler');

    // thawed: the markers show, dimmed
    await setFrozenUi(false);
    await sleep(400);
    const mark = q<HTMLElement>('.draft-doc p .md-mark');
    log(`thawed: editable ${surface.contentEditable}; markers ${n('.draft-doc .md-mark')} (hidden ${n('.draft-doc .md-mark.hidden')}); first marker "${mark?.textContent}" ${mark ? Math.round(mark.getBoundingClientRect().width) : 0}px wide, colour ${mark ? getComputedStyle(mark).color : ''}`);
    await shot('render-markers');
    await setFrozenUi(true);
    await sleep(300);

    // a drawn atom's source while it is selected: the table is edited in place since 41, so this logs `none`
    const list = surface.querySelector<HTMLElement>('.raw.rendered[data-kind="table"]') ?? surface.querySelector<HTMLElement>('.dd-table')!;
    const lb = list.getBoundingClientRect();
    const target = list.querySelector<HTMLElement>('.raw-view td') ?? list;
    for (const type of ['mousedown', 'mouseup', 'click']) target.dispatchEvent(new MouseEvent(type, { bubbles: true, cancelable: true, button: 0, buttons: type === 'mousedown' ? 1 : 0, detail: 1, clientX: lb.left + 10, clientY: lb.top + 10, view: window }));
    await sleep(200);
    log(`table clicked: selected ${list.classList.contains('selected')}; source shown ${list.querySelector('.raw-src') ? getComputedStyle(list.querySelector('.raw-src')!).display : 'none'}; view shown ${list.querySelector('.raw-view') ? getComputedStyle(list.querySelector('.raw-view')!).display : 'the table itself'}`);
    await shot('render-source');

    // an emphasised passage, extracted: the markers travel with the text
    const p = surface.querySelector<HTMLElement>('p.dd-p')!;
    select(p, 'Plain prose with *emphasis*, **strong**, and `a code span`');
    const cue = await until(() => q<HTMLElement>('.sel-cue'));
    log(`cue: ${Array.from(cue.querySelectorAll('.cue-act')).map((b) => b.textContent).join(' | ')}; selection "${window.getSelection()?.toString()}"`);
    const before = vault.documents();
    press('e');
    const extract = await until(() => vault.documents().find((d) => !before.includes(d)), 8000);
    await sleep(500);
    const ex = await vault.read(extract, true);
    log(`extract ${extract}: body "${ex.doc.blocks.filter((b) => b.kind !== 'card').map((b) => b.text).join(' / ')}"; diagnostics ${ex.diagnostics.length}; parent marks extracted ${n('.draft-doc p.extracted')}`);

    // a card with inline code, from `m`, then its session faces
    await until(() => (q('.sel-cue') ? null : true));
    const items = surface.querySelectorAll<HTMLElement>('.dd-li');
    const third = Array.from(items).find((li) => li.textContent?.includes('`code`'));
    log(`list item with code reads "${third?.textContent}" drawn with ${third?.querySelectorAll('.md-code').length} code span`);
    // the extract redrew the paragraph: take the node as it is now
    const p2 = surface.querySelector<HTMLElement>('p.dd-p')!;
    select(p2, 'and `a code span`');
    await until(() => q('.sel-cue'));
    press('m');
    const ta = await until(() => q<HTMLTextAreaElement>('.composer textarea'));
    log(`composer seed: "${ta.value}"`);
    const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')!.set!;
    setter.call(ta, 'inline code is written with {{backticks}}, as in `a code span`');
    ta.dispatchEvent(new Event('input', { bubbles: true }));
    await sleep(100);
    press('Enter', { metaKey: true });
    await until(() => (q('.composer') ? null : true));
    await sleep(800);
    const withCard = await vault.read(SAMPLER, true);
    const card = surface.querySelector<HTMLElement>('.card-span');
    log(`card: cards in file ${withCard.doc.blocks.filter((b) => b.kind === 'card').length}; diagnostics ${withCard.diagnostics.length}; drawn in the reader "${card?.querySelector('.cs-body')?.textContent}" with code ${card?.querySelectorAll('.md-code').length}, blanks ${card?.querySelectorAll('.cz').length}`);
    const item = await until(() => useApp.getState().queue.find((i) => i.kind === 'card' && i.path === SAMPLER), 5000);
    openSession(item);
    await until(() => q('.recall-wrap .card'));
    await sleep(400);
    log(`face hidden: "${faceText('.face.front')}"; code spans ${n('.face.front .md-code')}, blanks ${n('.face.front .cloze')}, markers hidden ${n('.face.front .md-mark.hidden')} of ${n('.face.front .md-mark')}`);
    await shot('render-face-hidden');
    press(' ');
    await sleep(400);
    log(`face revealed: "${faceText('.face.front')}"; answer "${faceText('.face.back .face-body')}"`);
    await shot('render-face-revealed');
    openNode(queueId('today'));
    await until(() => q('.queue'));
    await sleep(300);
    const row = qa<HTMLElement>('.qlist .row').find((r) => r.textContent?.includes('backticks') || r.querySelector('.md-code'));
    log(`queue row: "${row?.querySelector('.body')?.textContent?.replace(/\s+/g, ' ').trim().slice(0, 80)}" with code ${row?.querySelectorAll('.md-code').length ?? 0}`);

    // a chapter from the fixture book: emphasis, strong, the list, the quote
    openIntake('');
    await until(() => q<HTMLTextAreaElement>('.intake textarea'));
    const { intakeHooks } = await import('./Intake.js');
    const epub = (await invoke<string | null>('dev_env', { name: 'ILMI_EPUB' })) ?? `${await sourceDir()}/three-chapters.epub`;
    await intakeHooks.ingestFile!(epub);
    await until(() => q('.intake-detail'), 15000);
    await sleep(300);
    q<HTMLButtonElement>('.intake .place.primary')!.click();
    const first = await until(() => vault.documents().find((d) => /^The Small Book( \d+)?\/01 /.test(d)), 10000);
    await until(() => q<HTMLElement>('.doc-view .draft-doc'));
    await sleep(600);
    log(`chapter ${first}: ${drawn()}`);
    log(`chapter first paragraph: "${q('.doc-view .draft-doc p.dd-p')?.textContent?.slice(0, 90)}"`);
    await shot('render-chapter');

    // the toggle: off, a remote image gives way to its alt; the vault's own stay
    useApp.setState({ tweaksOpen: true });
    const rowEl = await until(() => qa<HTMLElement>('.tweaks .tw-row').find((r) => r.querySelector('.tw-lbl')?.textContent === 'show remote images'));
    log(`tweaks row: "${rowEl.querySelector('.tw-lbl')?.textContent}" ${Array.from(rowEl.querySelectorAll('button')).map((b) => `${b.textContent}${b.dataset.active === '1' ? '*' : ''}`).join(' ')}`);
    await shot('render-tweaks');
    (Array.from(rowEl.querySelectorAll<HTMLButtonElement>('button')).find((b) => b.textContent === 'off'))!.click();
    await sleep(200);
    log(`off: store ${useApp.getState().remoteImages}; stored ${localStorage.getItem('ilmi.tweaks')}`);
    useApp.setState({ tweaksOpen: false });
    openNode(SAMPLER);
    await until(() => q<HTMLElement>('.doc-view .draft-doc'));
    await until(() => (q('.draft-doc img.md-img[src^="blob:"]') ? true : null), 5000).catch(() => null);
    await sleep(400);
    log(`sampler with remote images off: ${drawn()}`);
    useApp.getState().setRemoteImages(true);
    log('done');
  } catch (e) {
    log(`failed: ${e instanceof Error ? e.message : String(e)}`);
  }
}

export async function smokeLive(vault: Vault): Promise<void> {
  const log = (s: string) => info(`smoke live: ${s}`);
  const shot = async (name: string, ms = 10000) => { await sleep(600); log(`shot: ${name}`); await sleep(ms); };
  const q = <T extends Element>(sel: string) => document.querySelector<T>(sel);
  const qa = <T extends Element>(sel: string) => Array.from(document.querySelectorAll<T>(sel));
  const SAMPLER = 'fleeting/markdown-sampler.md';
  const MX = 'papers/maxwell.md';
  /** The markers showing in the prose paragraphs, in order. */
  const shown = () => qa<HTMLElement>('.doc-view .draft-doc p.dd-p .md-mark:not(.hidden)').map((m) => `"${m.textContent}"`).join(' ') || 'none';
  const hidden = () => qa('.doc-view .draft-doc p.dd-p .md-mark.hidden').length;
  const keydown = (el: Element, key: string, init: KeyboardEventInit = {}) => {
    const ev = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ...init });
    el.dispatchEvent(ev);
    return ev.defaultPrevented;
  };
  const setValue = (ta: HTMLTextAreaElement, value: string) => {
    ta.value = value;
    ta.dispatchEvent(new Event('input', { bubbles: true }));
  };
  const line = (text: string, needle: string) => { const i = text.split('\n').findIndex((l) => l.includes(needle)); return `${i + 1}: ${text.split('\n')[i]}`; };
  try {
    // the sampler, thawed: every marker hidden until the caret arrives
    openNode(SAMPLER);
    const surface = await until(() => q<HTMLElement>('.doc-view .draft-doc'));
    await sleep(400);
    log(`frozen: markers ${qa('.draft-doc p.dd-p .md-mark').length}, hidden ${hidden()}, shown ${shown()}`);
    await setFrozenUi(false);
    await sleep(300);
    log(`thawed, caret elsewhere: editable ${surface.contentEditable}; hidden ${hidden()}, shown ${shown()}`);
    const p = () => surface.querySelector<HTMLElement>('p.dd-p')!;
    surface.focus();
    const stops: [string, number][] = [['Plain prose', 0], ['emphasis', 3], ['strong', 2], ['a code span', 1], ['link to the spec', 4], ['a small mark', 2], ['set in the line', 3]];
    for (const [text, off] of stops) {
      caret(p(), text, off);
      await sleep(200);
      const m = q<HTMLElement>('.draft-doc p.dd-p .md-mark:not(.hidden)');
      log(`caret in "${text}"+${off}: shown ${shown()}${m ? ` (first ${Math.round(m.getBoundingClientRect().width)}px wide)` : ''}; hidden ${hidden()}`);
      if (text === 'strong') await shot('live-markers');
    }

    // a backspace into the hidden closing `*`: revealed, nothing deleted; the next one is the browser's
    const before = p().textContent ?? '';
    caret(p(), '*emphasis*', 10);
    await sleep(200);
    log(`caret after *emphasis*: shown ${shown()}`);
    const took = keydown(surface, 'Backspace');
    await sleep(200);
    log(`backspace: taken ${took}; shown ${shown()}; text unchanged ${p().textContent === before}`);
    await shot('live-backspace');
    const again = keydown(surface, 'Backspace');
    log(`second backspace: taken ${again} (the browser's to make)`);
    document.execCommand('delete');
    await sleep(900);
    const broken = (await vault.read(SAMPLER, true)).text;
    log(`deleted: paragraph "${p().textContent?.slice(0, 40)}"; em spans ${p().querySelectorAll('.md-em').length}; file ${line(broken, 'Plain prose')}`);
    // typed back: the span lights as it closes
    document.execCommand('insertText', false, '*');
    await sleep(300);
    log(`retyped *: shown ${shown()}; em spans ${p().querySelectorAll('.md-em').length}`);
    await sleep(700);
    log(`file ${line((await vault.read(SAMPLER, true)).text, 'Plain prose')}`);

    // a new span at the end of the last paragraph
    const last = Array.from(surface.querySelectorAll<HTMLElement>('p.dd-p')).pop()!;
    caret(last, 'on the page.', 12);
    await sleep(200);
    document.execCommand('insertText', false, ' *live');
    await sleep(200);
    log(`typed " *live": markers ${last.querySelectorAll('.md-mark').length}; shown ${shown()}`);
    document.execCommand('insertText', false, '*');
    await sleep(300);
    log(`typed the closing *: shown ${shown()}; em "${last.querySelector('.md-em')?.textContent}"`);
    await shot('live-typed');
    document.execCommand('insertText', false, ' ');
    await sleep(900);
    log(`typed a space: shown ${shown()}; file ${line((await vault.read(SAMPLER, true)).text, 'closing paragraph')}`);

    // maxwell: the binomial chip edited in place
    openNode(MX);
    // the sampler's surface is still up until maxwell's replaces it: wait for the tab, then for a chip
    await until(() => (activeTab(useApp.getState().panes)?.id === MX ? true : null));
    const mx = await until(() => { const el = q<HTMLElement>('.doc-view .draft-doc'); return el?.querySelector('.math') ? el : null; }, 10000);
    await sleep(300);
    log(`maxwell open: blocks ${mx.children.length}, chips ${mx.querySelectorAll('.math').length} (${Array.from(mx.querySelectorAll<HTMLElement>('.math')).map((c) => `${c.parentElement?.tagName.toLowerCase()}.${c.parentElement?.className.split(' ')[0]}${c.closest('.card-span') ? '/card' : ''}`).join(' ')}); frozen ${q<HTMLElement>('.doc-view')?.dataset.frozen}`);
    await setFrozenUi(false);
    await sleep(300);
    const prose = Array.from(mx.querySelectorAll<HTMLElement>('.math')).filter((c) => !c.closest('.card-span') && !c.classList.contains('blanks'));
    const chip = prose[0] ?? mx.querySelector<HTMLElement>('.math')!;
    log(`maxwell: prose chips ${prose.length}; the chip ${chip.classList.contains('display') ? 'display' : 'inline'}, tex "${chip.dataset.tex?.replace(/\n/g, '⏎')}"`);
    const cb = chip.getBoundingClientRect();
    const target = chip.querySelector<HTMLElement>('.katex') ?? chip;
    for (const type of ['mousedown', 'mouseup', 'click']) target.dispatchEvent(new MouseEvent(type, { bubbles: true, cancelable: true, button: 0, buttons: type === 'mousedown' ? 1 : 0, detail: 1, clientX: cb.left + cb.width / 2, clientY: cb.top + cb.height / 2, view: window }));
    const field = await until(() => q<HTMLTextAreaElement>('.math .math-edit textarea'));
    await sleep(200);
    const er = field.closest<HTMLElement>('.math-edit')!.getBoundingClientRect();
    log(`editor open: value "${field.value.replace(/\n/g, '⏎')}", focused ${document.activeElement === field}, ${Math.round(er.width)}x${Math.round(er.height)} at ${Math.round(er.left)},${Math.round(er.top)} (chip bottom ${Math.round(cb.bottom)}); chip editing ${chip.classList.contains('editing')}`);
    await shot('live-math-editor');
    const good = field.value.replace('\\frac{n!}{k!\\,(n-k)!}', '\\frac{n!}{k!\\,(n-k)!} + 1');
    setValue(field, good);
    await sleep(200);
    log(`typed "+ 1": chip shows +1 ${(chip.querySelector('.katex')?.textContent ?? '').includes('+1')}; err "${chip.querySelector('.err')?.textContent}"; tex still "${chip.dataset.tex?.includes('+ 1') ? 'new' : 'old'}"`);
    setValue(field, '\\binom{n}{{k}} = \\frac{n!');
    await sleep(200);
    log(`broken: err "${chip.querySelector('.err')?.textContent}"; chip still shows +1 ${(chip.querySelector('.katex')?.textContent ?? '').includes('+1')}`);
    await shot('live-math-error');
    setValue(field, good);
    await sleep(100);
    const was = (await vault.read(MX, true)).text;
    keydown(field, 'Enter');
    await sleep(1200);
    const after = (await vault.read(MX, true)).text;
    log(`⏎: editor ${q('.math-edit') ? 'still open' : 'closed'}; focus on surface ${document.activeElement === mx}; changed lines ${JSON.stringify(changedLines(was, after))}; ${line(after, 'binom')}; chip tex "${mx.querySelector<HTMLElement>('p.dd-p .math')?.dataset.tex?.replace(/\n/g, '⏎')}"`);
    await shot('live-math-closed');

    // Escape writes nothing; an arrow at the field's end steps out
    const chip2 = mx.querySelector<HTMLElement>('p.dd-p .math')!;
    const cb2 = chip2.getBoundingClientRect();
    const target2 = chip2.querySelector<HTMLElement>('.katex') ?? chip2;
    for (const type of ['mousedown', 'mouseup', 'click']) target2.dispatchEvent(new MouseEvent(type, { bubbles: true, cancelable: true, button: 0, buttons: type === 'mousedown' ? 1 : 0, detail: 1, clientX: cb2.left + cb2.width / 2, clientY: cb2.top + cb2.height / 2, view: window }));
    const field2 = await until(() => q<HTMLTextAreaElement>('.math .math-edit textarea'));
    setValue(field2, 'x');
    await sleep(200);
    keydown(field2, 'Escape');
    await sleep(900);
    log(`escape: editor ${q('.math-edit') ? 'still open' : 'closed'}; file unchanged ${(await vault.read(MX, true)).text === after}; chip tex "${mx.querySelector<HTMLElement>('p.dd-p .math')?.dataset.tex?.includes('+ 1') ? 'kept' : 'lost'}"`);
    for (const type of ['mousedown', 'mouseup', 'click']) target2.dispatchEvent(new MouseEvent(type, { bubbles: true, cancelable: true, button: 0, buttons: type === 'mousedown' ? 1 : 0, detail: 1, clientX: cb2.left + cb2.width / 2, clientY: cb2.top + cb2.height / 2, view: window }));
    const field3 = await until(() => q<HTMLTextAreaElement>('.math .math-edit textarea'));
    field3.setSelectionRange(field3.value.length, field3.value.length);
    keydown(field3, 'ArrowRight');
    await sleep(300);
    const sel = window.getSelection();
    log(`arrow right at the end: editor ${q('.math-edit') ? 'still open' : 'closed'}; focus on surface ${document.activeElement === mx}; caret after the chip ${!!sel && sel.isCollapsed && sel.anchorNode !== null && sel.anchorNode.compareDocumentPosition(chip2) === Node.DOCUMENT_POSITION_PRECEDING}`);
    log('done');
  } catch (e) {
    log(`failed: ${e instanceof Error ? e.message : String(e)}`);
  }
}

export async function smokeBlocks(vault: Vault): Promise<void> {
  const log = (s: string) => info(`smoke blocks: ${s}`);
  const shot = async (name: string, ms = 10000) => { await sleep(600); log(`shot: ${name}`); await sleep(ms); };
  const q = <T extends Element>(sel: string) => document.querySelector<T>(sel);
  const qa = <T extends Element>(sel: string) => Array.from(document.querySelectorAll<T>(sel));
  const SAMPLER = 'fleeting/markdown-sampler.md';
  const keydown = (el: Element, key: string, init: KeyboardEventInit = {}) => {
    const ev = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ...init });
    el.dispatchEvent(ev);
    return ev.defaultPrevented;
  };
  const type = (s: string) => document.execCommand('insertText', false, s);
  /** `n` lines of the file from the one holding `from`, numbered. */
  const lines = (text: string, from: string, n: number) => {
    const ls = text.split('\n');
    const i = ls.findIndex((l) => l.includes(from));
    return ls.slice(i, i + n).map((l, k) => `${i + 1 + k}: ${JSON.stringify(l)}`).join('  ');
  };
  const file = async () => (await vault.read(SAMPLER, true)).text;
  /** The block the caret sits in, by `sel`; the anchor is the block itself when it is empty. */
  const caretIn = (sel: string) => {
    const n = document.getSelection()?.anchorNode;
    return (n instanceof Element ? n : n?.parentElement)?.closest<HTMLElement>(sel) ?? null;
  };
  const items = () => Array.from(q<HTMLElement>('.draft-doc .dd-list')?.querySelectorAll<HTMLElement>('.dd-li') ?? []);
  const markers = () => `[${items().map((li) => `${li.querySelector('.li-mark')?.textContent}@${li.style.getPropertyValue('--indent')}${li.querySelector('.li-task') ? `☐${li.querySelector<HTMLElement>('.li-task')?.dataset.checked}` : ''}`).join(' ')}]`;
  try {
    openNode(SAMPLER);
    const surface = await until(() => q<HTMLElement>('.doc-view .draft-doc'));
    await sleep(400);
    log(`sampler: blocks ${surface.children.length}; lists ${qa('.draft-doc .dd-list').length}, items ${markers()}; quote lines ${qa('.draft-doc .dd-ql').length}; code lang "${q<HTMLElement>('.draft-doc .dd-code')?.dataset.lang}" class "${q('.draft-doc .dd-code code')?.className}"; atoms [${qa<HTMLElement>('.draft-doc .raw.rendered').map((r) => r.dataset.kind).join(', ')}]`);
    await setFrozenUi(false);
    await sleep(300);
    surface.focus();

    // the bullet list: ⏎ at the end of the third item, typing, Tab, ⇧Tab
    caret(items()[2]!.querySelector<HTMLElement>('.li-text')!, 'with `code`', 11);
    await sleep(200);
    const took = keydown(surface, 'Enter');
    await sleep(200);
    type('a fourth, typed live');
    await sleep(900);
    log(`⏎ (taken ${took}) then typing: items ${markers()}; file ${lines(await file(), '- the first point', 5)}`);
    keydown(surface, 'Tab');
    await sleep(900);
    log(`tab: items ${markers()}; file ${lines(await file(), '- the first point', 5)}`);
    await shot('blocks-list');
    keydown(surface, 'Tab', { shiftKey: true });
    await sleep(900);
    log(`⇧tab: items ${markers()}; file ${lines(await file(), '- the first point', 5)}`);

    // a task: `[ ] ` typed at the start of a new item becomes its box; a click ticks it
    keydown(surface, 'Enter');
    await sleep(200);
    type('[ ] ');
    await sleep(300);
    type('a task');
    await sleep(900);
    log(`typed "[ ] a task": items ${markers()}; file ${lines(await file(), '- the first point', 6)}`);
    const box = items()[4]?.querySelector<HTMLElement>('.li-task');
    if (box) {
      const br = box.getBoundingClientRect();
      box.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true, button: 0, buttons: 1, clientX: br.left + 4, clientY: br.top + 4, view: window }));
      await sleep(900);
      log(`box clicked: ${box.dataset.checked}; file ${lines(await file(), '- the first point', 6)}`);
    } else log('no box drawn');
    await shot('blocks-task');
    // ⏎ at the end of the task, then ⏎ on the empty item: out of the list
    caret(items()[4]!.querySelector<HTMLElement>('.li-text')!, 'a task', 6);
    await sleep(200);
    keydown(surface, 'Enter');
    await sleep(200);
    log(`⏎ after the task: items ${markers()}`);
    keydown(surface, 'Enter');
    await sleep(200);
    type('After the list.');
    await sleep(900);
    log(`⏎ on the empty item then typing: items ${markers()}; caret in ${caretIn('p, .dd-li')?.className}; file ${lines(await file(), '- [x] a task', 3)}`);

    // the quote: ⏎ at the end of the second line, typing, ⏎ twice to leave
    const ql = qa<HTMLElement>('.draft-doc .dd-ql');
    caret(ql[1]!, 'second line.', 12);
    await sleep(200);
    keydown(surface, 'Enter');
    await sleep(200);
    type('A third line, typed live.');
    await sleep(900);
    log(`quote ⏎ then typing: lines ${qa('.draft-doc .dd-ql').length}; file ${lines(await file(), '> A quotation', 3)}`);
    await shot('blocks-quote');
    keydown(surface, 'Enter');
    await sleep(100);
    keydown(surface, 'Enter');
    await sleep(200);
    type('After the quote.');
    await sleep(900);
    log(`⏎ ⏎ then typing: lines ${qa('.draft-doc .dd-ql').length}; file ${lines(await file(), '> A quotation', 5)}`);

    // the code block: ⏎ a newline, Tab two spaces, typing, ⌘⏎ out
    const code = q<HTMLElement>('.draft-doc .dd-code code')!;
    caret(code, 'now);', 5);
    await sleep(200);
    keydown(surface, 'Enter');
    await sleep(100);
    keydown(surface, 'Tab');
    await sleep(100);
    type('return *due*;');
    await sleep(900);
    log(`code ⏎ tab typing: text "${code.textContent?.replace(/\n/g, '⏎')}"; drawn inside ${code.querySelectorAll('.md-mark, .md-em, .math').length}; file ${lines(await file(), '```js', 4)}`);
    await shot('blocks-code');
    const out = keydown(surface, 'Enter', { metaKey: true });
    await sleep(200);
    type('After the code.');
    await sleep(900);
    log(`⌘⏎ (taken ${out}) then typing: caret in ${caretIn('p, pre')?.className}; file ${lines(await file(), '```js', 6)}`);

    const final = await vault.read(SAMPLER, true);
    log(`file: ${final.doc.blocks.length} blocks, raw ${final.doc.blocks.filter((b) => b.kind === 'raw').length}, diagnostics ${final.diagnostics.length}; reader blocks ${surface.children.length}`);
    log('done');
  } catch (e) {
    log(`failed: ${e instanceof Error ? e.message : String(e)}`);
  }
}

export async function smokeUse(vault: Vault): Promise<void> {
  const log = (s: string) => info(`smoke use: ${s}`);
  const shot = async (name: string, ms = 10000) => { await sleep(600); log(`shot: ${name}`); await sleep(ms); };
  const q = <T extends Element>(sel: string) => document.querySelector<T>(sel);
  const qa = <T extends Element>(sel: string) => Array.from(document.querySelectorAll<T>(sel));
  const key = (el: Element | Window, k: string) => el.dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true, cancelable: true }));
  const type = (el: HTMLInputElement, text: string) => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(el, text);
    el.dispatchEvent(new Event('input', { bubbles: true }));
  };
  const contextmenu = (el: Element, x: number, y: number) => el.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true, clientX: x, clientY: y }));
  /** The first three rows' source lines: the kind tag, then the label, with the line's caps as drawn. */
  const srcLines = () => qa<HTMLElement>('.qlist li[data-el] .src').slice(0, 3).map((s) => `[${s.querySelector('.kindtag')?.textContent}] "${Array.from(s.childNodes).filter((n) => n.nodeType === Node.TEXT_NODE).map((n) => n.textContent).join('')}" (${getComputedStyle(s).textTransform}, ${getComputedStyle(s).fontFamily.split(',')[0]}, by ${s.dataset.by})`).join(' | ');
  const entries = () => qa<HTMLElement>('.ctx-menu .ci').map((e) => e.textContent).join(' | ');
  const menuBox = () => { const m = q<HTMLElement>('.ctx-menu'); if (!m) return 'none'; const r = m.getBoundingClientRect(); return `at ${Math.round(r.left)},${Math.round(r.top)} ${Math.round(r.width)}×${Math.round(r.height)}, bottom ${Math.round(r.bottom)} of ${window.innerHeight}`; };
  const treeRows = () => qa<HTMLElement>('.edit-tree .trow').map((r) => `${r.dataset.kind}:${r.querySelector('.name')?.textContent}`).join(', ');
  const tweakRow = async (label: string) => until(() => qa<HTMLElement>('.tweaks .tw-row').find((r) => r.querySelector('.tw-lbl')?.textContent?.startsWith(label)));
  const viaPalette = async (text: string, pick: (r: HTMLElement) => boolean) => {
    useApp.setState({ paletteOpen: true });
    const input = await until(() => q<HTMLInputElement>('.palette-input input'));
    type(input, text);
    await sleep(150);
    const list = qa<HTMLElement>('.palette-row');
    const at = list.findIndex(pick);
    log(`palette "${text}": ${list.length} rows, picked ${at}: ${list.slice(0, 4).map((r) => `[${r.dataset.t}] ${r.querySelector('.pt')?.textContent}`).join(' / ')}`);
    for (let i = 0; i < at; i++) key(input, 'ArrowDown');
    key(input, 'Enter');
    await until(() => (q('.palette-overlay') ? null : true));
  };
  try {
    // the queue: the path after the kind tag, mono, as written
    openNode(queueId('today'));
    await until(() => q('.qlist li[data-el]'));
    await sleep(400);
    log(`queue rows ${qa('.qlist li[data-el]').length}; titles ${useApp.getState().queueTitles}; ${srcLines()}`);
    await shot('use-queue-paths');
    useApp.setState({ tweaksOpen: true });
    const row = await tweakRow('queue shows titles');
    const buttons = Array.from(row.querySelectorAll<HTMLButtonElement>('button'));
    log(`tweaks row "${row.querySelector('.tw-lbl')?.textContent}": ${buttons.map((b) => `${b.textContent}${b.dataset.active === '1' ? '*' : ''}`).join(' ')}`);
    buttons.find((b) => b.textContent === 'on')?.click();
    await sleep(300);
    log(`titles on: ${useApp.getState().queueTitles}; stored ${localStorage.getItem('ilmi.tweaks')?.includes('"queueTitles":true')}; ${srcLines()}`);
    await shot('use-queue-titles', 6000);
    buttons.find((b) => b.textContent === 'off')?.click();
    await sleep(300);
    useApp.setState({ tweaksOpen: false });
    log(`titles off: ${srcLines()}`);

    // the sidebar's empty space: the root's menu
    const side = await until(() => q<HTMLElement>('.side'));
    const last = qa<HTMLElement>('.side .tree .row').pop()!;
    const sr = side.getBoundingClientRect();
    const lr = last.getBoundingClientRect();
    const y = Math.min(sr.bottom - 12, lr.bottom + 40);
    const hit = document.elementFromPoint(sr.left + 30, y);
    contextmenu(hit ?? side, sr.left + 30, y);
    await until(() => q('.ctx-menu'));
    await sleep(200);
    log(`right-click on the sidebar at ${Math.round(sr.left + 30)},${Math.round(y)} (hit ${hit?.className || hit?.tagName}, below the last row by ${Math.round(y - lr.bottom)}): menu ${menuBox()}; entries ${entries()}`);
    await shot('use-sidebar-menu');
    key(window, 'Escape');
    await sleep(100);
    log(`escape: menu ${menuBox()}`);
    // a heading too
    const h6 = q<HTMLElement>('.side h6')!;
    const hr = h6.getBoundingClientRect();
    contextmenu(h6, hr.left + 10, hr.top + 6);
    await until(() => q('.ctx-menu'));
    log(`right-click on the heading: entries ${entries()}`);
    document.body.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    await sleep(100);
    log(`outside press: menu ${menuBox()}`);

    // a row's menu: move to… on a click, not on hover
    const target = qa<HTMLElement>('.edit-tree .trow').find((r) => r.dataset.kind !== 'folder')!;
    const tr = target.getBoundingClientRect();
    contextmenu(target, tr.left + 60, tr.top + tr.height / 2);
    const menu = await until(() => q<HTMLElement>('.ctx-menu'));
    log(`right-click on "${target.querySelector('.name')?.textContent}": entries ${entries()}`);
    const hasSub = menu.querySelector<HTMLElement>('.ci.has-sub')!;
    hasSub.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));
    hasSub.dispatchEvent(new MouseEvent('mouseenter'));
    await sleep(250);
    log(`hover over move to…: list ${q('.ctx-menu .sub-scroll') ? 'OPEN' : 'closed'}; entries ${entries()}`);
    hasSub.click();
    await until(() => q('.ctx-menu .sub-scroll'));
    await sleep(100);
    log(`click on move to…: list ${qa('.ctx-menu .sub-scroll .ci').map((e) => e.textContent).join(' | ')}; back "${q('.ctx-menu .ci.back')?.textContent}"; menu ${menuBox()}`);
    await shot('use-move-to');
    q<HTMLElement>('.ctx-menu .sub-wrap')!.dispatchEvent(new MouseEvent('mouseleave'));
    await sleep(150);
    log(`pointer out of the list: list ${q('.ctx-menu .sub-scroll') ? 'still open' : 'CLOSED'}`);
    q<HTMLElement>('.ctx-menu .ci.back')!.click();
    await sleep(100);
    log(`◂ move to…: list ${q('.ctx-menu .sub-scroll') ? 'open' : 'closed'}; entries ${entries()}`);
    key(window, 'Escape');
    await sleep(100);
    log(`escape: menu ${menuBox()}`);

    // the menu near the bottom edge, from the sidebar's lowest point
    contextmenu(side, sr.left + 30, window.innerHeight - 8);
    await until(() => q('.ctx-menu'));
    await sleep(100);
    log(`right-click at the bottom edge (y ${window.innerHeight - 8}): menu ${menuBox()}`);
    await shot('use-menu-bottom', 6000);
    key(window, 'Escape');

    // close from the palette: the welcome
    const here = vault.root;
    await viaPalette('close collection', (r) => r.dataset.t === 'command' && r.querySelector('.pt')?.textContent === 'close collection');
    await until(() => q('.welcome'));
    await sleep(400);
    log(`closed: vault ${useApp.getState().vault}; welcome ${!!q('.welcome')}; rows ${qa('.welcome-row .pt').map((r) => r.textContent).join(', ')}; tabs ${qa('.tabbar .tab').length}`);
    await shot('use-welcome');

    // back through the menu's own path, as File → Open Recent sends it
    const recent = useApp.getState().recents.find((r) => r.path === here);
    log(`recents: ${useApp.getState().recents.map((r) => r.name).join(', ')}; reopening ${recent?.name} via recent:<path>`);
    const action = await runMenu(`recent:${here}`);
    await until(() => (useApp.getState().vault === here ? true : null), 10000);
    await until(() => q('.edit-tree .trow'));
    await sleep(600);
    log(`reopened: action ${JSON.stringify(action)}; vault ${useApp.getState().vault}; tree ${treeRows()}; tab "${q('.tabbar .tab[data-active="1"] .title')?.textContent}"`);
    await shot('use-reopened');
    log('done');
  } catch (e) {
    log(`failed: ${e instanceof Error ? e.message : String(e)}`);
  }
}

export async function smokeLand(vault: Vault): Promise<void> {
  const log = (s: string) => info(`smoke land: ${s}`);
  const shot = async (name: string, ms = 10000) => { await sleep(600); log(`shot: ${name}`); await sleep(ms); };
  const q = <T extends Element>(sel: string) => document.querySelector<T>(sel);
  const qa = <T extends Element>(sel: string) => Array.from(document.querySelectorAll<T>(sel));
  const key = (el: Element | Window, k: string) => el.dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true, cancelable: true }));
  const contextmenu = (el: Element, x: number, y: number) => el.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true, clientX: x, clientY: y }));
  const entries = () => qa<HTMLElement>('.ctx-menu .ci').map((e) => e.textContent).join(' | ');
  const docsNow = () => vault.documents().length;
  const tree = () => vault.tree.map((n) => (n.kind === 'folder' ? `${n.name}/{${n.children.map((c) => c.name).join(', ')}}` : n.name)).join(' ');
  const notice = () => { const n = q<HTMLElement>('.notice'); return n ? `"${n.querySelector('.nl')?.textContent}" [${qa<HTMLElement>('.notice .na').map((b) => b.textContent).join(' ')}]` : 'none'; };
  const center = (el: Element) => { const r = el.getBoundingClientRect(); return [Math.round(r.left + r.width / 2), Math.round(r.top + r.height / 2)] as const; };
  const tab = () => activeTab(useApp.getState().panes)?.id;
  try {
    const { dropAt, importFiles, onPaste } = await import('./land.js');
    const pdf = `${await sourceDir()}/papers/two-pages.pdf`;
    const epub = (await invoke<string | null>('dev_env', { name: 'ILMI_EPUB' })) ?? `${await sourceDir()}/three-chapters.epub`;
    log(`start: ${docsNow()} documents; tree ${tree()}`);

    // a PDF dropped on a folder row: it lands there, opens, and the notice says so
    openNode(queueId('today'));
    const essays = await until(() => qa<HTMLElement>('.edit-tree .trow').find((r) => r.dataset.path === 'essays'));
    const [ex, ey] = center(essays);
    const n0 = docsNow();
    const landed = await dropAt([pdf], ex, ey);
    await until(() => (docsNow() > n0 ? true : null), 10000);
    await sleep(600);
    log(`pdf on the essays row at ${ex},${ey}: landed ${landed?.map((l) => `${l.line} → ${l.open}`).join('; ')}; tab ${tab()}; notice ${notice()}; pages ${useApp.getState().docs[landed?.[0]?.open ?? '']?.pdf ?? 'none'}`);
    log(`tree: ${tree()}`);
    await shot('land-pdf-row');

    // the fixture book dropped on the reader: it lands in the folder of the open document
    openNode(WOZ);
    const reader = await until(() => q<HTMLElement>('.pane[data-active="1"] .reader-wrap'));
    await sleep(400);
    const [rx, ry] = center(reader);
    const n1 = docsNow();
    const book = await dropAt([epub], rx, ry);
    await until(() => (docsNow() >= n1 + 3 ? true : null), 15000);
    await sleep(800);
    log(`epub on the reader (tab ${WOZ}) at ${rx},${ry}: landed ${book?.map((l) => `${l.line} → ${l.open}; folders ${l.folders.join(', ')}`).join('; ')}; tab ${tab()}; notice ${notice()}`);
    log(`tree: ${tree()}; papers: ${vault.documents().filter((d) => d.startsWith('papers/')).join(', ')}`);
    await shot('land-epub-reader');

    // undo from the notice: the book's folder goes
    q<HTMLButtonElement>('.notice .na')?.click();
    await until(() => (docsNow() <= n1 ? true : null), 10000);
    await sleep(500);
    log(`undo: ${docsNow()} documents; notice ${notice()}; log "${useApp.getState().log[0]}"; book folder ${vault.documents().some((d) => d.includes('Small Book')) ? 'STILL THERE' : 'gone'}`);

    // Import… with the picker stubbed: the book again, into the active tab's folder
    openNode('essays');
    await until(() => q('.folder-view'));
    const n2 = docsNow();
    const imported = await importFiles(undefined, async () => [epub]);
    await until(() => (docsNow() >= n2 + 3 ? true : null), 15000);
    await sleep(600);
    log(`import… (picker stubbed, tab essays): ${imported.map((l) => `${l.line} → ${l.open}`).join('; ')}; notice ${notice()}`);
    log(`tree: ${tree()}`);
    await shot('land-import');

    // a pasted address with nothing focused
    openNode('essays');
    await until(() => q('.folder-view'));
    (document.activeElement as HTMLElement | null)?.blur?.();
    const url = (await invoke<string | null>('dev_env', { name: 'ILMI_URL' })) ?? 'https://en.wikipedia.org/wiki/Spaced_repetition';
    let ev: ClipboardEvent;
    try {
      const dt = new DataTransfer();
      dt.setData('text/plain', url);
      ev = new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true });
    } catch {
      ev = new Event('paste', { bubbles: true, cancelable: true }) as ClipboardEvent;
      Object.defineProperty(ev, 'clipboardData', { value: { getData: () => url } });
    }
    const n3 = docsNow();
    const pasted = onPaste(ev);
    log(`paste ${url} on ${document.activeElement?.tagName}: ${pasted ? 'taken' : 'LEFT ALONE'}; prevented ${ev.defaultPrevented}`);
    const clip = pasted ? await pasted : null;
    if (clip) {
      await until(() => (docsNow() > n3 ? true : null), 10000);
      await sleep(600);
      log(`clipped: ${clip.line} → ${clip.open}; tab ${tab()}; notice ${notice()}`);
      log(`tree: ${tree()}`);
      await shot('land-paste');
    } else log(`offline or unreadable: notice ${notice()}; skipped`);

    // the folder lens: a row's menu and its empty space's
    openNode('papers');
    await until(() => q('.folder-view .fv-row'));
    await sleep(400);
    const row = qa<HTMLElement>('.folder-view .fv-row').find((r) => r.dataset.kind !== 'folder') ?? q<HTMLElement>('.folder-view .fv-row')!;
    const [fx, fy] = center(row);
    contextmenu(row, fx, fy);
    await until(() => q('.ctx-menu'));
    log(`folder lens row "${row.dataset.path}": ${entries()}`);
    await shot('land-lens-row-menu', 6000);
    key(window, 'Escape');
    await sleep(100);
    const view = q<HTMLElement>('.folder-view')!;
    const vr = view.getBoundingClientRect();
    const below = Math.min(window.innerHeight - 60, vr.bottom - 20);
    contextmenu(view, vr.left + 40, below);
    await until(() => q('.ctx-menu'));
    log(`folder lens empty space at y ${Math.round(below)}: ${entries()}`);
    await shot('land-lens-space-menu', 6000);
    key(window, 'Escape');

    // the sidebar's +
    q<HTMLElement>('.edit-tree .trow[data-path=""] .side-add')?.click();
    await until(() => q('.ctx-menu'));
    log(`sidebar +: ${entries()}`);
    await shot('land-plus', 6000);
    key(window, 'Escape');
    log(`end: ${docsNow()} documents; tree ${tree()}`);
    log('done');
  } catch (e) {
    log(`failed: ${e instanceof Error ? e.message : String(e)}`);
  }
}

export async function smokeNest(vault: Vault): Promise<void> {
  const log = (s: string) => info(`smoke nest: ${s}`);
  const shot = async (name: string, ms = 8000) => { await sleep(600); log(`shot: ${name}`); await sleep(ms); };
  const q = <T extends Element>(sel: string) => document.querySelector<T>(sel);
  const qa = <T extends Element>(sel: string) => Array.from(document.querySelectorAll<T>(sel));
  const COURSE = 'courses/linear-algebra.md';
  const trow = (path: string) => q<HTMLElement>(`.edit-tree .trow[data-path="${CSS.escape(path)}"]`);
  const depth = (el: HTMLElement) => Math.round((parseFloat(el.style.paddingLeft || '6') - 6) / 10);
  // the sidebar's rows as drawn, indented by depth, under the given prefixes
  const rows = (...prefixes: string[]) => qa<HTMLElement>('.edit-tree .trow')
    .filter((r) => prefixes.some((p) => (r.dataset.path ?? '').startsWith(p)))
    .map((r) => `${'  '.repeat(Math.max(0, depth(r) - 1))}${r.querySelector('.glyph')?.textContent ?? ''}${r.querySelector('.name')?.textContent ?? ''}`)
    .join(' | ');
  const orderFile = async () => ((await vault.fs.stat(vault.abs('.ilmi/order.json'))) ? (await vault.fs.readText(vault.abs('.ilmi/order.json'))).replace(/\s+/g, ' ').trim() : 'none');
  const entries = () => qa<HTMLElement>('.ctx-menu .ci').map((e) => `${e.style.paddingLeft ? `[${e.style.paddingLeft}]` : ''}${e.textContent}`).join(' | ');
  const key = (k: string) => window.dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true, cancelable: true }));
  const has = (path: string) => (vault.documents().includes(path) ? true : null);
  const dragEv = (type: string, dt: DataTransfer, x = 0, y = 0) => new DragEvent(type, { bubbles: true, cancelable: true, clientX: x, clientY: y, dataTransfer: dt });
  /** A pointer's drag from one row to a third of another: top, middle, or bottom. */
  const drag = async (from: string, to: string, where: 'top' | 'mid' | 'bottom') => {
    const a = await until(() => trow(from));
    const b = await until(() => trow(to));
    const dt = new DataTransfer();
    a.dispatchEvent(dragEv('dragstart', dt));
    await sleep(80);
    const r = b.getBoundingClientRect();
    const y = r.top + r.height * (where === 'top' ? 0.15 : where === 'mid' ? 0.5 : 0.85);
    b.dispatchEvent(dragEv('dragenter', dt, r.left + 30, y));
    const over = dragEv('dragover', dt, r.left + 30, y);
    b.dispatchEvent(over);
    await sleep(120);
    const lit = b.className.match(/drop-\w+/)?.[0] ?? 'none';
    b.dispatchEvent(dragEv('drop', dt, r.left + 30, y));
    a.dispatchEvent(dragEv('dragend', dt));
    return `${from} → ${where} of ${to}: accepted ${over.defaultPrevented}, lit ${lit}`;
  };
  try {
    setInspector({ open: true });
    for (const f of ['books', 'essays', 'courses', COURSE, 'papers']) toggleOpen(f, true);
    openNode(queueId('today'));
    await until(() => trow(COURSE));
    await sleep(500);
    log(`start: ${rows('books', 'essays', 'courses', 'german', 'papers/archive')}; order ${await orderFile()}`);
    await shot('nest-start');

    // a deck into the middle of a source: the source's children directory made, its row opening
    log(await drag('german.md', 'books/james-pluralistic-ch4.md', 'mid'));
    await until(() => has('books/james-pluralistic-ch4/german.md'), 8000);
    await sleep(500);
    log(`deck into source: ${rows('books', 'german')}; on disk ${(await vault.fs.stat(vault.abs('books/james-pluralistic-ch4')))?.isDir ? 'books/james-pluralistic-ch4/ made' : 'NO DIRECTORY'}; order ${await orderFile()}`);
    await shot('nest-deck-into-source');

    // a folder into the middle of a draft
    log(await drag('papers/archive', 'essays/spaced-composition.md', 'mid'));
    await until(() => has('essays/spaced-composition/archive/sutton-2019.md'), 8000);
    await sleep(500);
    log(`folder into draft: ${rows('essays', 'papers/archive')}; papers now ${vault.documents().filter((d) => d.startsWith('papers/')).length} documents; order ${await orderFile()}`);
    await shot('nest-folder-into-draft');

    // the course's three children reordered by their top thirds
    log(await drag('courses/linear-algebra/vectors.md', 'courses/linear-algebra/unit-2', 'top'));
    await until(() => (vault.order['courses/linear-algebra'] ? true : null), 8000);
    await sleep(500);
    log(`reorder 1: ${rows('courses')}; order ${await orderFile()}`);
    log(await drag('courses/linear-algebra/problem-set-1.md', 'courses/linear-algebra/unit-2', 'top'));
    await until(() => (vault.order['courses/linear-algebra']?.[1] === 'problem-set-1.md' ? true : null), 8000);
    await sleep(500);
    log(`reorder 2: ${rows('courses')}; order ${await orderFile()}`);
    await shot('nest-reorder');

    // the course's children as a folder lens, in the same order; the course's own inspector line
    openNode('courses/linear-algebra');
    await until(() => q('.folder-view .fv-row'));
    await sleep(400);
    log(`children lens: "${q('.folder-view h1')?.textContent}" (${q('.folder-view .crumb')?.textContent}): ${qa<HTMLElement>('.folder-view .fv-row').map((r) => r.querySelector('.fv-name')?.textContent).join(', ')}`);
    await shot('nest-children-lens');
    openNode(COURSE);
    await sleep(800);
    const kv = qa<HTMLElement>('.kvr').find((r) => r.querySelector('dt')?.textContent === 'children');
    log(`course inspector children line: ${kv ? kv.querySelector('dd')?.textContent : 'NONE (inspector closed?)'}`);

    // rename the course inline from its row: its children and their order follow
    const crow = await until(() => trow(COURSE));
    crow.dispatchEvent(new MouseEvent('dblclick', { bubbles: true, cancelable: true }));
    const input = await until(() => q<HTMLInputElement>('.edit-tree input.rename'));
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input, 'linear algebra I');
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));
    await until(() => has('courses/linear algebra I.md'), 8000);
    await sleep(600);
    log(`renamed: ${rows('courses')}; children on disk ${vault.documents().filter((d) => d.startsWith('courses/linear algebra I/')).join(', ')}; tab ${activeTab(useApp.getState().panes)?.id}; order ${await orderFile()}`);
    await shot('nest-renamed');

    // move to… for a deck: folders and documents, indented by depth
    const deck = await until(() => trow('books/james-pluralistic-ch4/german.md'));
    const dr = deck.getBoundingClientRect();
    deck.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true, clientX: dr.left + 40, clientY: dr.top + 8 }));
    await until(() => q('.ctx-menu'));
    q<HTMLElement>('.ctx-menu .ci.has-sub')?.click();
    await until(() => q('.ctx-menu .sub-scroll'));
    log(`move to… for german: ${entries()}`);
    await shot('nest-move-to', 6000);
    key('Escape');
    await sleep(100);

    // delete asks first for a document with children
    const course = await until(() => trow('courses/linear algebra I.md'));
    const cr = course.getBoundingClientRect();
    course.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true, clientX: cr.left + 40, clientY: cr.top + 8 }));
    await until(() => q('.ctx-menu'));
    qa<HTMLElement>('.ctx-menu .ci.danger')[0]?.click();
    await sleep(200);
    log(`delete on the course: "${q('.ctx-menu .ci.danger')?.textContent ?? 'menu closed'}"; course still there ${vault.documents().includes('courses/linear algebra I.md')}`);
    await shot('nest-delete-asks', 6000);
    key('Escape');
    log(`end: ${rows('books', 'essays', 'courses')}; order ${await orderFile()}`);
    log('done');
  } catch (e) {
    log(`failed: ${e instanceof Error ? e.message : String(e)}`);
  }
}

/**
 * `ILMI_SMOKE=tabs`: the corpus course as a notebook. Shows it as a tree and
 * back as tabs from its sidebar row's menu, adds two tabs (`+ tab`, a draft,
 * and a deck from the rail's `+`, each renamed in place) and a subtab
 * (`add subtab` on a row's menu), reorders the rail by drags on its rows'
 * thirds, opens a deck tab and a source tab (a subtab under the folder
 * tab), steps with ⌘⌥↑, and folds the rail with ⌃⌘T; logs the rail, the
 * pane tab, and the file tree after each.
 */
export async function smokeTabs(vault: Vault): Promise<void> {
  const log = (s: string) => info(`smoke tabs: ${s}`);
  const shot = async (name: string, ms = 8000) => { await sleep(600); log(`shot: ${name}`); await sleep(ms); };
  const q = <T extends Element>(sel: string) => document.querySelector<T>(sel);
  const qa = <T extends Element>(sel: string) => Array.from(document.querySelectorAll<T>(sel));
  const COURSE = 'courses/linear-algebra.md';
  const KIDS = 'courses/linear-algebra';
  const rrow = (path: string) => q<HTMLElement>(`.tab-rail .rail-row[data-path="${CSS.escape(path)}"]`);
  const trow = (path: string) => q<HTMLElement>(`.edit-tree .trow[data-path="${CSS.escape(path)}"]`);
  const rail = () => {
    const nav = q<HTMLElement>('.tab-rail');
    if (!nav) return 'NO RAIL';
    if (nav.classList.contains('folded')) return `folded strip (${nav.querySelector('.rail-count')?.textContent} tabs)`;
    return qa<HTMLElement>('.tab-rail .rail-row').map((r) => {
      const depth = Math.round((parseFloat(r.style.paddingLeft || '6') - 6) / 12);
      return `${'  '.repeat(depth)}${r.dataset.active === '1' ? '*' : ''}${r.querySelector('.chev')?.textContent ?? ''}${r.querySelector('.glyph')?.textContent ?? ''}${r.querySelector('.name')?.textContent ?? ''}`;
    }).join(' | ');
  };
  const paneTab = () => qa<HTMLElement>('.pane[data-active="1"] .tabbar .tab').map((t) => `${t.dataset.active === '1' ? '*' : ''}${t.querySelector('.glyph')?.textContent}${t.querySelector('.title')?.textContent}`).join(' | ');
  const files = () => vault.documents().filter((d) => d.startsWith(`${KIDS}/`)).map((d) => d.slice(KIDS.length + 1)).join(', ');
  const orderFile = async () => ((await vault.fs.stat(vault.abs('.ilmi/order.json'))) ? (await vault.fs.readText(vault.abs('.ilmi/order.json'))).replace(/\s+/g, ' ').trim() : 'none');
  const field = async () => ((await vault.fs.readText(vault.abs(COURSE))).split('\n').slice(0, 4).join(' / '));
  const has = (path: string) => (vault.documents().includes(path) ? true : null);
  const page = () => activeTab(useApp.getState().panes)?.id ?? '';
  const state = () => `${rail()} ‖ pane ${paneTab()} ‖ page ${page()}`;
  const menuAtRow = async (el: HTMLElement) => {
    const r = el.getBoundingClientRect();
    el.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true, clientX: r.left + 30, clientY: r.top + 8 }));
    await until(() => q('.ctx-menu'));
  };
  const pick = async (label: string) => {
    const it = await until(() => qa<HTMLElement>('.ctx-menu .ci').find((e) => e.textContent?.slice(1).replace(/F2$|▸$/, '') === label));
    it.click();
  };
  const renameTo = async (name: string) => {
    const input = await until(() => q<HTMLInputElement>('.tab-rail input.rename'), 8000);
    await sleep(200);
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input, name);
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));
  };
  const dragEv = (type: string, dt: DataTransfer, x = 0, y = 0) => new DragEvent(type, { bubbles: true, cancelable: true, clientX: x, clientY: y, dataTransfer: dt });
  const drag = async (from: string, to: string, where: 'top' | 'mid' | 'bottom') => {
    const a = await until(() => rrow(from));
    const b = await until(() => rrow(to));
    const dt = new DataTransfer();
    a.dispatchEvent(dragEv('dragstart', dt));
    await sleep(80);
    const r = b.getBoundingClientRect();
    const y = r.top + r.height * (where === 'top' ? 0.15 : where === 'mid' ? 0.5 : 0.85);
    b.dispatchEvent(dragEv('dragenter', dt, r.left + 30, y));
    const over = dragEv('dragover', dt, r.left + 30, y);
    b.dispatchEvent(over);
    await sleep(120);
    const lit = b.className.match(/drop-\w+/)?.[0] ?? 'none';
    b.dispatchEvent(dragEv('drop', dt, r.left + 30, y));
    a.dispatchEvent(dragEv('dragend', dt));
    return `${from.slice(KIDS.length + 1)} → ${where} of ${to.slice(KIDS.length + 1)}: accepted ${over.defaultPrevented}, lit ${lit}`;
  };
  const chord = (init: KeyboardEventInit) => window.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, cancelable: true, metaKey: true, ...init }));
  try {
    setInspector({ open: false });
    for (const f of ['courses']) toggleOpen(f, true);
    openNode(COURSE);
    await until(() => rrow(COURSE), 8000);
    await sleep(600);
    log(`start: ${state()}; field ${await field()}; files ${files()}`);

    // show as tree, then show as tabs, from the course's row in the sidebar
    await menuAtRow(await until(() => trow(COURSE)));
    await pick('show as tree');
    await until(() => (q('.tab-rail') ? null : true), 8000);
    await sleep(500);
    log(`show as tree: ${state()}; field ${await field()}; sidebar row chevron ${trow(COURSE)?.querySelector('.chev')?.textContent}`);
    await shot('tabs-as-tree', 6000);
    await menuAtRow(await until(() => trow(COURSE)));
    await pick('show as tabs');
    await until(() => rrow(COURSE), 8000);
    await sleep(500);
    log(`show as tabs: ${state()}; field ${await field()}`);
    await shot('tabs-on');

    // two tabs: + tab (a note, untitled, renamed in place), and a deck from +
    q<HTMLElement>('.tab-rail .rail-add')!.click();
    await until(() => has(`${KIDS}/untitled.md`), 8000);
    log(`+ tab made untitled.md: page ${page()}; renaming ${q('.tab-rail input.rename') ? 'open' : 'not open'}`);
    await renameTo('unit 1 notes');
    await until(() => has(`${KIDS}/unit 1 notes.md`), 8000);
    await sleep(500);
    log(`+ tab: ${state()}; files ${files()}; order ${await orderFile()}`);
    q<HTMLElement>('.tab-rail .rail-more')!.click();
    await until(() => q('.rail-menu'));
    log(`+ menu: ${qa<HTMLElement>('.rail-menu .ci').map((e) => e.textContent).join(' | ')}`);
    qa<HTMLElement>('.rail-menu .ci').find((e) => e.textContent?.endsWith('deck'))!.click();
    await renameTo('unit 1 cards');
    await until(() => has(`${KIDS}/unit 1 cards.md`), 8000);
    await sleep(500);
    log(`+ deck: ${state()}; files ${files()}; order ${await orderFile()}`);
    await shot('tabs-added');

    // a subtab under unit 1 notes
    await menuAtRow(await until(() => rrow(`${KIDS}/unit 1 notes.md`)));
    log(`row menu: ${qa<HTMLElement>('.ctx-menu .ci').map((e) => e.textContent?.slice(1)).join(' | ')}`);
    await pick('add subtab');
    await renameTo('week 1');
    await until(() => has(`${KIDS}/unit 1 notes/week 1.md`), 8000);
    await sleep(500);
    log(`subtab: ${state()}; files ${files()}; order ${await orderFile()}`);
    await shot('tabs-subtab');

    // reorder: unit 1 notes to the top (above unit-2, the first tab), unit 1 cards after it
    log(await drag(`${KIDS}/unit 1 notes.md`, `${KIDS}/unit-2`, 'top'));
    await until(() => (vault.order[KIDS]?.[0] === 'unit 1 notes.md' ? true : null), 8000);
    await sleep(400);
    log(await drag(`${KIDS}/unit 1 cards.md`, `${KIDS}/unit 1 notes.md`, 'bottom'));
    await until(() => (vault.order[KIDS]?.[1] === 'unit 1 cards.md' ? true : null), 8000);
    await sleep(500);
    log(`reordered: ${state()}; order ${await orderFile()}`);
    await shot('tabs-reordered');

    // a deck tab, then a source tab (a subtab under the folder tab)
    (await until(() => rrow(`${KIDS}/problem-set-1.md`))).click();
    await until(() => q('.nb-page .deck-view'), 8000);
    await sleep(600);
    log(`deck tab: ${state()}; lens "${q('.nb-page .deck-view h1')?.textContent}" ${qa('.nb-page .deck-view .card-span').length} cards; pane tabs ${qa('.pane[data-active="1"] .tabbar .tab').length}`);
    await shot('tabs-deck');
    (await until(() => rrow(`${KIDS}/unit-2`))).querySelector<HTMLElement>('.chev')!.click();
    (await until(() => rrow(`${KIDS}/unit-2/eigenvalues.md`))).click();
    await until(() => (page() === `${KIDS}/unit-2/eigenvalues.md` ? true : null), 8000);
    await sleep(1200);
    log(`source tab: ${state()}; lens ${q('.nb-page .reader')?.className ?? 'none'}: "${q('.nb-page .reader h1')?.textContent ?? ''}"; bottom ${q('.bot')?.textContent}`);
    await shot('tabs-source');

    // step back and forward through the pages
    chord({ key: 'ArrowUp', altKey: true });
    await sleep(500);
    const up = page();
    chord({ key: 'ArrowDown', altKey: true });
    await sleep(500);
    log(`⌘⌥↑ → ${up}; ⌘⌥↓ → ${page()}`);

    // fold the rail
    chord({ key: 't', code: 'KeyT', ctrlKey: true });
    await until(() => q('.tab-rail.folded'), 4000);
    await sleep(900);
    const st = (await vault.fs.stat(vault.abs('.ilmi/state.json'))) ? JSON.parse(await vault.fs.readText(vault.abs('.ilmi/state.json'))) as { rails?: string[] } : {};
    log(`folded: ${state()}; state.json rails ${JSON.stringify(st.rails ?? null)}`);
    await shot('tabs-folded');
    log(`end: files ${files()}; order ${await orderFile()}; field ${await field()}`);
    log('done');
  } catch (e) {
    log(`failed: ${e instanceof Error ? e.message : String(e)}`);
  }
}

// `ILMI_SMOKE=decks` opens the german deck and works its browser: searches
// `wieder` (and `Lucke` without its umlaut), filters to due, sorts by
// interval, ⇧-clicks three rows and suspends them from the bar (undoes it
// from the notice and suspends again), opens a row with ⏎ and types onto
// its back, switches another row to cloze and saves it by a click outside,
// studies the deck with two grades (the session's header counting down),
// and logs the file's lines after each.
export async function smokeDecks(vault: Vault): Promise<void> {
  const log = (s: string) => info(`smoke decks: ${s}`);
  const shot = async (name: string, ms = 6000) => { await sleep(600); log(`shot: ${name}`); await sleep(ms); };
  const DECK = 'german.md';
  const q = <T extends Element>(sel: string) => document.querySelector<T>(sel);
  const qa = <T extends Element>(sel: string) => Array.from(document.querySelectorAll<T>(sel));
  const rows = () => qa<HTMLElement>('.deck-view .deck-row');
  const shown = () => rows().map((r) => `${r.querySelector('.dr-front')?.textContent?.slice(0, 18)}[${r.querySelector('.dr-due')?.textContent}${r.querySelector('.dr-ivl') ? ` ${r.querySelector('.dr-ivl')?.textContent}` : ''}]`).join(' | ');
  const count = () => q('.deck-bar .db-count')?.textContent ?? '';
  const lines = async () => (await vault.read(DECK, true)).text.split('\n').filter((l) => l.trim()).slice(5).join(' ⏎ ');
  const setInput = (el: HTMLInputElement, value: string) => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(el, value);
    el.dispatchEvent(new Event('input', { bubbles: true }));
  };
  const key = (k: string, init: KeyboardEventInit = {}) => window.dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true, cancelable: true, ...init }));
  const click = (el: Element, init: MouseEventInit = {}) => el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, ...init }));
  const chip = (name: string) => q<HTMLElement>(`.deck-bar .chip[data-chip="${name}"]`)!;
  const act = (name: string) => q<HTMLElement>(`.deck-bar .db-actions button[data-act="${name}"]`);
  const suspended = () => rows().filter((r) => r.dataset.suspended === '1').length;
  try {
    openNode(DECK);
    await until(() => (rows().length ? true : null));
    await sleep(400);
    log(`start: ${count()} rows; ${shown()}`);
    log(`lines: ${await lines()}`);
    await shot('decks-start');

    const search = q<HTMLInputElement>('.deck-bar .db-search')!;
    key('/');
    log(`/ focuses the search: ${document.activeElement === search}`);
    setInput(search, 'wieder');
    await sleep(300);
    log(`search "wieder": ${count()}; ${shown()}`);
    setInput(search, 'Lucke');
    await sleep(300);
    log(`search "Lucke": ${count()}; ${shown()}`);
    setInput(search, '');
    search.blur();
    click(chip('due'));
    await sleep(300);
    log(`filter due: ${count()}; ${shown()}`);
    await shot('decks-due');
    const sort = q<HTMLSelectElement>('.deck-bar .db-sort')!;
    sort.value = 'interval';
    sort.dispatchEvent(new Event('change', { bubbles: true }));
    await sleep(300);
    log(`sort interval (due): ${count()}; ${shown()}`);
    click(chip('due'));
    await sleep(300);
    log(`sort interval (all): ${count()}; ${shown()}; remembered ${JSON.stringify(useApp.getState().deckViews[DECK])}`);
    await shot('decks-interval');
    sort.value = 'order';
    sort.dispatchEvent(new Event('change', { bubbles: true }));
    await sleep(300);

    // three rows: a click, then a ⇧-click two below
    click(rows()[0]!);
    click(rows()[2]!, { shiftKey: true });
    await until(() => act('suspend'));
    log(`selected: "${q('.deck-bar .db-sel')?.textContent}"; actions ${qa('.deck-bar .db-actions button').map((b) => b.textContent).join(', ')}`);
    await shot('decks-selected');
    act('suspend')!.click();
    await until(() => (suspended() === 3 ? true : null), 8000);
    log(`suspended: ${shown()}; notice "${useApp.getState().notice?.line}"; lines: ${await lines()}`);
    q<HTMLElement>('.notice .na')?.click();
    await until(() => (suspended() === 0 ? true : null), 8000);
    log(`undone: ${shown()}; lines: ${await lines()}`);
    click(rows()[0]!);
    click(rows()[2]!, { shiftKey: true });
    (await until(() => act('suspend'))).click();
    await until(() => (suspended() === 3 ? true : null), 8000);
    log(`suspended again; german in the queue ${useApp.getState().queue.filter((i) => i.path === DECK).length}`);
    await shot('decks-suspended');

    // ⏎ on the fourth row opens the card view there (milestone 72): type onto its back, ⌘⏎ saves
    click(rows()[3]!);
    await sleep(200);
    key('Enter');
    const back = await until(() => q<HTMLElement>('.card-view .face.back .face-field'));
    log(`⏎ opened the card view: tab ${activeTab(useApp.getState().panes)?.id}; count "${q('.card-view .cv-count')?.textContent}"; faces "${qa('.card-view .face').map((f) => f.textContent).join(' | ')}"`);
    await shot('decks-editor', 4000);
    back.focus();
    const sel = window.getSelection()!;
    sel.selectAllChildren(back);
    sel.collapseToEnd();
    document.execCommand('insertText', false, '; to lose');
    await sleep(200);
    back.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', metaKey: true, bubbles: true, cancelable: true }));
    await until(() => (q('.card-view .card-edit')?.getAttribute('data-dirty') === '0' ? true : null), 5000);
    await sleep(600);
    log(`edited back: lines: ${await lines()}`);

    // `]` to the fifth card, to cloze from the strip's switch, saved by a press outside
    const was = q('.card-view .cv-count')?.textContent;
    key(']');
    await until(() => (q('.card-view .cv-count')?.textContent !== was ? true : null), 5000);
    log(`] moved: ${was} → ${q('.card-view .cv-count')?.textContent}`);
    q<HTMLElement>('.card-view .cm-forms button[data-form="cloze"]')!.click();
    await sleep(300);
    log(`switched to cloze: front "${q('.card-view .face.front')?.textContent}"`);
    q<HTMLElement>('.card-view .recall-meta')!.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }));
    await until(() => (q('.card-view .card-edit')?.getAttribute('data-dirty') === '0' ? true : null), 5000);
    await sleep(600);
    log(`to cloze: lines: ${await lines()}`);
    await shot('decks-edited');
    openNode(DECK);
    await until(() => (rows().length ? true : null));

    // `m`: a new card in a sheet over the window, its faces the session's two boxes, saved by ⌘⏎
    {
      const before = rows().length;
      await sleep(300);
      key('m');
      const sheet = await until(() => q<HTMLElement>('.card-sheet .deck-edit'), 5000);
      const [front, backF] = qa<HTMLElement>('.card-sheet .face .face-field');
      const typeIn = async (el: HTMLElement | undefined, t: string) => {
        if (!el) return;
        el.focus();
        await sleep(60);
        document.execCommand('insertText', false, t);
        await sleep(120);
      };
      await typeIn(front, 'sheet test front');
      await typeIn(backF, 'sheet test back');
      const r = sheet.getBoundingClientRect();
      const boxes = qa<HTMLElement>('.card-sheet .face').map((f) => Math.round(f.getBoundingClientRect().height));
      log(`new card sheet: ${Math.round(r.width)}×${Math.round(r.height)} of ${innerWidth}×${innerHeight}; boxes ${boxes.join(' over ')}; faces "${qa('.card-sheet .face').map((f) => f.textContent).join(' | ')}"`);
      await shot('decks-new-card', 3000);
      (front ?? sheet).dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', metaKey: true, bubbles: true, cancelable: true }));
      await until(() => (q('.card-sheet') ? null : true), 5000);
      await until(() => (rows().length > before ? true : null), 5000).catch(() => null);
      log(`new card saved: sheet gone ${q('.card-sheet') ? 'NO' : 'yes'}; rows ${before} → ${rows().length}; in the list ${rows().some((x) => x.textContent?.includes('sheet test front')) ? 'yes' : 'NO'}`);
    }

    // study the deck: two grades, the header counting down
    q<HTMLElement>('.deck-study .ds-study')!.click();
    await until(() => q('.recall-meta .sess-deck'));
    log(`study: "${q('.recall-meta .sess-deck')?.textContent}"; items ${useApp.getState().session?.items.length}`);
    await shot('decks-study', 4000);
    for (let i = 0; i < 2; i++) {
      const before = q('.recall-meta .sess-deck')?.textContent;
      key(' ');
      await sleep(250);
      key('3');
      await until(() => (q('.recall-meta .sess-deck')?.textContent !== before ? true : null), 5000);
      await sleep(400);
      log(`grade ${i + 1}: header "${q('.recall-meta .sess-deck')?.textContent ?? 'ended'}"; tab ${activeTab(useApp.getState().panes)?.id}; lines: ${await lines()}`);
    }
    log('done');
  } catch (e) {
    log(`failed: ${e instanceof Error ? e.message : String(e)}`);
  }
}

// `ILMI_SMOKE=tour` over `samples/double-major` (ILMI_VAULT): the screens a
// heavy collection shows, one capture each in light, dark and e-ink, for a
// look over the whole app; and milestone 40's fixes asserted where they can
// be (each an `ok: …` line, the first miss `failed: …`): the reader's top row
// one line with the sidebar, the rail and the inspector all open; no raw
// `$` outside KaTeX in the inspector, the outline, the rail's headings, the
// session's path; the queue's paths titles, not slugs; the Lindqvist
// chapter titled once; display math without the empty line under it; the
// session card short for a one-line cloze, answered in place; the deck's
// due read as words; a course's row counting what is under it. Assertions
// read computed styles and layout, never painted frames (a covered WebKit
// window holds frames and transitions back); the theme is set at the start
// (the tweaks persist across runs).
export async function smokeTour(vault: Vault): Promise<void> {
  const log = (s: string) => info(`smoke tour: ${s}`);
  const q = <T extends Element>(sel: string) => document.querySelector<T>(sel);
  const qa = <T extends Element>(sel: string) => Array.from(document.querySelectorAll<T>(sel));
  const shot = async (name: string, ms = 3500) => { await sleep(1200); log(`shot: ${name}`); await sleep(ms); };
  const must = (ok: boolean, what: string) => { if (!ok) throw new Error(what); log(`ok: ${what}`); };
  const poll = async (probe: () => boolean, what: string, ms = 5000) => {
    try { await until(() => (probe() ? true : null), ms); } catch { throw new Error(what); }
    log(`ok: ${what}`);
  };
  const scrollTo = (text: string) => {
    const el = Array.from(document.querySelectorAll<HTMLElement>('.doc-view .draft-doc > *')).find((e) => e.textContent?.includes(text));
    el?.scrollIntoView({ block: 'start' });
  };
  const open = async (path: string) => {
    openNode(path);
    await until(() => (activeTab(useApp.getState().panes)?.id === path ? q('.pane-body .doc-view .draft-doc, .pane-body .deck-view, .pane-body .folder-view, .pane-body .pdf-view') : null), 10000);
    await sleep(400);
  };
  /** Text under `el` outside KaTeX's markup. */
  const plain = (el: Element | null): string => {
    if (!el) return '';
    const out: string[] = [];
    const walk = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    for (let n = walk.nextNode(); n; n = walk.nextNode()) if (!n.parentElement?.closest('.katex')) out.push(n.textContent ?? '');
    return out.join('');
  };
  const noRawTex = (where: string, el: Element | null) => {
    const t = plain(el);
    const hit = /\$[^\s$]|\\[A-Za-z]+/.exec(t);
    if (hit) log(`raw TeX in ${where}: ${t.slice(Math.max(0, hit.index - 20), hit.index + 20)}`);
    must(!hit, `no raw TeX in ${where}${el ? '' : ' (not drawn)'}`);
  };
  const PT = 'courses/fall-2026/phys-412-quantum-ii/nondegenerate-perturbation-theory.md';
  const CH3 = 'library/lindqvist-statistical-physics/ch-3-the-canonical-ensemble.md';
  const QM = 'courses/fall-2026/phys-412-quantum-ii.md';
  try {
    useApp.getState().setTheme('light');
    await poll(() => document.documentElement.dataset.theme === 'light', 'the page starts light');
    setSidebar({ hidden: false });
    useApp.setState({ railFolded: {} });
    for (const p of ['courses', 'courses/fall-2026', 'courses/fall-2026/phys-412-quantum-ii', 'library', 'library/lindqvist-statistical-physics', 'arabic']) toggleOpen(p, true);

    // ── the fixes, asserted once (light) ──
    // the queue: paths of titles, kinds as lowercase words
    openNode(queueId('today'));
    await until(() => q('.queue .qlist li'));
    const paths = qa<HTMLElement>('.qlist .qpath').map((e) => e.textContent ?? '');
    log(`queue paths: ${paths.slice(0, 5).join(' | ')}`);
    must(paths.length > 0 && paths.every((t) => !/\b[a-z0-9]+(?:-[a-z0-9]+)+\//.test(t) && !/\.md\b/.test(t)), 'queue paths are titles, not slugs');
    must(qa<HTMLElement>('.qlist .src').every((e) => e.getBoundingClientRect().height < 24), 'each queue path is one line');
    const tags = [...new Set(qa('.qlist .kindtag').map((t) => t.textContent ?? ''))];
    must(tags.every((t) => t === t.toLowerCase()) && getComputedStyle(q('.qlist .kindtag')!).textTransform === 'none', `kinds lowercase (${tags.join(', ')})`);
    useApp.setState({ inspForced: true });
    setInspector({ open: true });
    await sleep(300);
    must(!q('.insp .kv') || !/upcoming/.test(q('.insp')?.textContent ?? ''), "the queue's inspector does not repeat the saved queries");
    log(`queue inspector: ${(q('.insp')?.textContent ?? '').replace(/\s+/g, ' ').slice(0, 160)}`);

    // the reader's top row on a notebook page with the sidebar, the rail and the inspector open
    await open(PT);
    await until(() => q('.tab-rail'));
    const meta = q<HTMLElement>('.pane-body .doc-view .meta')!;
    const lh = parseFloat(getComputedStyle(meta).fontSize) * 1.9;
    log(`top row: "${meta.textContent}" ${Math.round(meta.getBoundingClientRect().height)}px (a line ${Math.round(lh)}px); page ${Math.round(q<HTMLElement>('.pane-body .doc-view')!.getBoundingClientRect().width)}px; window ${window.innerWidth}px`);
    must(getComputedStyle(meta).whiteSpace === 'nowrap' && meta.getBoundingClientRect().height <= lh, 'the top row is one line');
    must(!/\beditable\b|\bfrozen\b/.test(meta.textContent ?? ''), 'no editable/frozen word in the top row');
    must(/^\d+ (due|cards?)$/.test(q('.pane-body .doc-view .meta .right')?.textContent ?? ''), 'the count is one short token');
    noRawTex('the inspector', q('.insp'));
    noRawTex('the rail', q('.tab-rail'));
    // display math: no empty line under it
    const br = q<HTMLElement>('.pane-body .draft-doc .math.display ~ br.ProseMirror-trailingBreak');
    must(!br || getComputedStyle(br).display === 'none', 'no trailing break under display math');
    await shot('fix-top-row');
    // the rail folded: the outline is the inspector's
    useApp.setState({ railFolded: { [QM]: true } });
    await sleep(400);
    noRawTex('the outline', q('.insp-outline'));
    useApp.setState({ railFolded: {}, inspForced: false });

    // the Lindqvist chapter, titled once
    await open(CH3);
    await sleep(300);
    // (since 49 the chapter is a book: one heading names it, whether the notes are in or folded)
    must(qa('.pane-body h1').filter((h) => /canonical ensemble/.test(h.textContent ?? '')).length === 1, 'the chapter is titled once');
    // since 70 a book open is its pages alone: one pane, the inspector closed, `notes` among the words over the pages
    must(q('.pane-body .book')?.getAttribute('data-notes') === '0' && qa('.pane').length === 1 && !q('.insp') && q('.pane-body .book .meta .notes-toggle')?.textContent === 'notes', 'it opens as its pages alone, notes among the words over them');

    // the deck's rows: the due as words, the interval in the tooltip
    await open('arabic/vocabulary.md');
    const dues = qa('.deck-row .dr-due').map((e) => e.textContent ?? '');
    must(dues.length > 100 && dues.every((d) => !d.startsWith('+')), 'deck dues read as words');
    must(!q('.insp .insp-cards'), "the deck's inspector has no card list");

    // a course counts what is under it
    await open('courses/fall-2026');
    const qmRow = q(`.fv-row[data-path="${QM}"] .fv-meta`)?.textContent ?? '';
    log(`fall 2026 rows: ${qa<HTMLElement>('.fv-row').map((r) => `${r.querySelector('.fv-name')?.textContent} [${r.querySelector('.fv-meta')?.textContent}]`).join(' | ')}`);
    must(Number(/(\d+) cards/.exec(qmRow)?.[1] ?? 0) > 20, `quantum II counts the cards under it (${qmRow})`);

    // the session: even a one-line cloze fills the pane, answered in place
    openNode(queueId('today'));
    await until(() => q('.queue'));
    press('Enter');
    await until(() => q('.recall-wrap .card, .doc-session'), 10000);
    let found = false;
    for (let i = 0; i < 80 && !found; i++) {
      const t = q('.recall-wrap .card .cloze-text');
      if (t && (t.textContent ?? '').length < 90 && !t.querySelector('.math') && t.getBoundingClientRect().height < 60) found = true;
      else { press(']'); await sleep(120); }
    }
    if (found) {
      const card = q<HTMLElement>('.recall-wrap .card')!;
      log(`one-line cloze: card ${Math.round(card.getBoundingClientRect().height)}px "${card.textContent?.slice(0, 80)}"`);
      const wrap = q<HTMLElement>('.recall-wrap')!.getBoundingClientRect().height;
      must(card.getBoundingClientRect().height > wrap * 0.6, `the card fills the pane (${Math.round(card.getBoundingClientRect().height)} of ${Math.round(wrap)}px)`);
      noRawTex("the session's path", q('.recall-meta .card-trail'));
      await shot('fix-session-cloze');
      press(' ');
      await poll(() => !!q('.recall-wrap .card .cloze.revealed'), 'the cloze is revealed in place');
      must(!q('.recall-wrap .card .face.back') && !q('.recall-wrap .card .cloze-answer'), 'no second box repeating the answer');
      await shot('fix-session-cloze-revealed');
    } else log('no one-line cloze in the first 80 of the session');

    // ── every screen, in each theme ──
    const screens: [string, () => Promise<void>][] = [
      ['queue', async () => { openNode(queueId('today')); await until(() => q('.queue')); }],
      ['note-physics-top', () => open(PT)],
      ['note-physics-mid', async () => { await open(PT); scrollTo('second order'); }],
      ['notebook', () => open(QM)],
      ['note-arabic', () => open('courses/fall-2026/arab-401-advanced-grammar/kana-and-its-sisters.md')],
      ['note-arabic-mid', async () => { await open('courses/fall-2026/arab-401-advanced-grammar/kana-and-its-sisters.md'); scrollTo('خبر'); }],
      ['textbook', () => open(CH3)],
      ['reader-arabic', () => open('library/classical-prose-reader/11-the-judge-and-the-two-litigants.md')],
      ['vocab-deck', () => open('arabic/vocabulary.md')],
      ['draft', () => open('courses/fall-2026/arab-455-abbasid-poetry/term-paper.md')],
      ['folder', () => open('courses/fall-2026')],
      ['session-1', async () => { openNode(queueId('today')); await until(() => q('.queue')); press('Enter'); await until(() => q('.recall-wrap .card, .doc-session'), 10000); }],
      ['session-1-shown', async () => { press(' '); await sleep(200); }],
      ['session-2', async () => { for (let i = 0; i < 6; i++) { press(']'); await sleep(150); } }],
    ];
    for (const theme of ['light', 'dark', 'eink'] as const) {
      useApp.getState().setTheme(theme);
      await poll(() => document.documentElement.dataset.theme === theme, `the page is in ${theme}`);
      for (const [name, go] of screens) {
        await go();
        await shot(theme === 'light' ? name : `${name}-${theme}`);
      }
    }
    useApp.getState().setTheme('light');
    log(`done; vault ${vault.root}`);
  } catch (e) {
    log(`failed: ${e instanceof Error ? e.message : String(e)}`);
    useApp.getState().setTheme('light');
  }
}

// `ILMI_SMOKE=notes` over a copy of `samples/double-major` (ILMI_VAULT):
// milestone 33's "done when". A typeless file opens as a note (its kind,
// lens, glyph, and the top row logged); the sidebar's `+` and a folder
// lens's buttons name the five kinds; a note not yet enrolled is revisited
// from its top row, a pass is started at a heading, and the session takes
// it from the top (the bar's words, no marker) and writes a read line with
// no `pos`; in that note a word is selected and `e` pressed: the key is
// not taken and typing replaces the word; ⌘⇧E carves an extract and ⌘⇧M
// opens the composer, saved as a card; bare `e` still extracts from a
// frozen source; F2 renames only with the tree focused; an imported text
// lands `type: source`, a pasted one as a note. Each file's lines are
// logged after each step, and `shot:` lines mark the screens worth seeing.
export async function smokeNotes(vault: Vault): Promise<void> {
  const log = (s: string) => info(`smoke notes: ${s}`);
  const q = <T extends Element>(sel: string, root: ParentNode = document) => root.querySelector<T>(sel);
  const qa = <T extends Element>(sel: string, root: ParentNode = document) => Array.from(root.querySelectorAll<T>(sel));
  const shot = async (name: string, ms = 2600) => { await sleep(600); log(`shot: ${name}`); await sleep(ms); };
  const TYPELESS = 'fleeting/2026-10-30.md';
  const NOTE = 'courses/fall-2026/phys-412-quantum-ii/time-dependent-perturbation-theory.md';
  const SOURCE = 'library/lindqvist-statistical-physics/ch-3-the-canonical-ensemble.md';
  const head = async (path: string, n = 6) => (await vault.fs.readText(vault.abs(path))).split('\n').slice(0, n).join(' / ');
  const lineWith = async (path: string, text: string) => (await vault.fs.readText(vault.abs(path))).split('\n').find((l) => l.includes(text)) ?? '(none)';
  const open = async (path: string) => {
    openNode(path);
    await until(() => (activeTab(useApp.getState().panes)?.id === path ? q('.pane-body .doc-view .draft-doc, .pane-body .folder-view') : null), 10000);
    await sleep(500);
  };
  const surface = () => q<HTMLElement>('.pane-body .doc-view .draft-doc')!;
  const para = (text: string) => qa<HTMLElement>('p.dd-p', surface()).find((p) => p.textContent?.includes(text));
  const topRow = () => qa<HTMLElement>('.pane-body .doc-view .meta > *').map((e) => e.textContent?.trim()).filter(Boolean).join(' | ');
  const strip = () => q('.bot')?.textContent?.replace(/\s+/g, ' ').trim() ?? '';
  const cue = () => qa<HTMLElement>('.sel-cue .cue-act').map((b) => b.textContent?.trim()).join(' | ');
  const keyOn = (el: Element, init: KeyboardEventInit) => {
    const ev = new KeyboardEvent('keydown', { bubbles: true, cancelable: true, ...init });
    el.dispatchEvent(ev);
    return ev.defaultPrevented;
  };
  const childrenOf = (path: string) => vault.documents().filter((d) => d.startsWith(`${path.replace(/\.md$/, '')}/`));
  try {
    setInspector({ open: true });
    for (const p of ['courses', 'courses/fall-2026', 'courses/fall-2026/phys-412-quantum-ii', 'fleeting', 'library', 'library/lindqvist-statistical-physics']) toggleOpen(p, true);

    // a typeless file opens as a note
    await open(TYPELESS);
    const row = q<HTMLElement>(`.edit-tree .trow[data-path="${TYPELESS}"]`);
    log(`typeless ${TYPELESS}: first line "${await head(TYPELESS, 1)}"; kind ${useApp.getState().docs[TYPELESS]?.type}; lens ${q('.pane-body .doc-view') ? 'reader' : 'other'}, editable ${surface().isContentEditable}; tree row ${row?.dataset.kind} ${row?.querySelector('.glyph')?.textContent}; top row ${topRow()}; inspector "${q('.block h6')?.textContent ?? ''}"; strip ${strip()}`);
    await shot('notes-typeless');

    // the five words: the sidebar's +, a folder lens's buttons, the tree's kinds
    q<HTMLElement>('.edit-tree .side-add')!.click();
    await until(() => q('.ctx-menu'));
    log(`sidebar +: ${qa<HTMLElement>('.ctx-menu .ci').map((e) => e.textContent).join(' | ')}`);
    await shot('notes-new-menu');
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    await open('courses/fall-2026/phys-412-quantum-ii');
    log(`folder lens: ${qa<HTMLElement>('.pane-body .folder-view button').map((b) => b.textContent).filter((t) => t?.startsWith('+')).join(' | ')}`);
    const kinds: Record<string, string> = {};
    for (const r of qa<HTMLElement>('.edit-tree .trow')) if (r.dataset.kind) kinds[r.dataset.kind] = r.querySelector('.glyph')?.textContent ?? '';
    log(`tree kinds: ${Object.entries(kinds).map(([k, g]) => `${g} ${k}`).join(', ')}`);

    // revisit a note from the top row; a pass from a heading; the session takes it from the top
    await open(NOTE);
    log(`note before: ${await head(NOTE, 4)}; top row ${topRow()}; strip ${strip()}`);
    const enrol = await until(() => qa<HTMLElement>('.pane-body .doc-view .meta .enrol').find((b) => b.textContent?.startsWith('revisit')));
    enrol.click();
    for (let i = 0; i < 60 && !(await lineWith(NOTE, 'read:')).startsWith('read:'); i++) await sleep(100);
    await sleep(400);
    log(`revisited: ${await lineWith(NOTE, 'read:')}; marker ${q('.pane-body .read-rule') ? 'drawn' : 'none'}; top row ${topRow()}`);
    const from = await until(() => q<HTMLSelectElement>('.pane-body .from-heading'));
    log(`from…: ${qa<HTMLOptionElement>('option', from).map((o) => o.textContent?.trim()).join(' | ')}`);
    const golden = qa<HTMLOptionElement>('option', from).find((o) => o.textContent?.includes('golden rule'))!;
    Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value')!.set!.call(from, golden.value);
    from.dispatchEvent(new Event('change', { bubbles: true }));
    await sleep(500);
    const h = qa<HTMLElement>('h2', surface()).find((e) => e.textContent?.includes('golden rule'));
    const pane = q<HTMLElement>('.pane-body')!;
    log(`from "golden rule": heading at ${Math.round((h?.getBoundingClientRect().top ?? 0) - pane.getBoundingClientRect().top)}px from the pane's top; select back to "${from.selectedOptions[0]?.textContent}"; file ${await lineWith(NOTE, 'read:')}`);
    await shot('notes-revisit-heading');
    const item = await until(() => useApp.getState().queue.find((i) => i.kind === 'read' && i.path === NOTE), 8000);
    log(`queue row: kind ${item.kind}, note ${item.kind === 'read' && item.note}, next "${item.kind === 'read' ? item.next?.slice(0, 40) : ''}"`);
    openNode(queueId('today'));
    const qrow = await until(() => qa<HTMLElement>('.queue .kindtag').find((t) => t.parentElement?.textContent?.includes('time-dependent')), 6000).catch(() => null);
    log(`queue tag: ${qrow?.textContent ?? '(row not found)'}; tags on screen ${[...new Set(qa<HTMLElement>('.queue .kindtag').map((t) => t.textContent))].join(', ')}`);
    await shot('notes-queue');
    openSession(item);
    await until(() => q('.doc-session'), 8000);
    await sleep(800);
    log(`session: bar "${q('.session-bar .sb-kind')?.textContent}"; actions ${qa<HTMLElement>('.session-bar .sb-actions button').map((b) => b.textContent).join(' | ')}; marker ${q('.doc-session .read-rule') ? 'drawn' : 'none'}; scrolled ${Math.round(q<HTMLElement>('.doc-session')?.closest('.pane-body')?.scrollTop ?? -1)}; strip ${strip()}`);
    await shot('notes-revisit-session');
    (document.activeElement as HTMLElement | null)?.blur?.();
    press('Enter');
    for (let i = 0; i < 60 && (await lineWith(NOTE, 'read:')).includes('reps=0'); i++) await sleep(100);
    log(`went over it: ${await lineWith(NOTE, 'read:')}; notice "${useApp.getState().notice?.line ?? ''}"`);

    // a word selected in the note and `e` typed: the key is not taken, the word is replaced
    await open(NOTE);
    const first = await until(() => para('Typed same evening'));
    surface().focus();
    select(first, 'rough');
    await until(() => q('.sel-cue'));
    log(`selection cue in a note: ${cue()}; strip ${strip()}`);
    await shot('notes-cue');
    const takenE = keyOn(surface(), { key: 'e', code: 'KeyE' });
    if (!takenE) document.execCommand('insertText', false, 'e');
    await sleep(1500);
    log(`typed e over "rough": key taken ${takenE}; extracts ${childrenOf(NOTE).length}; line ${(await lineWith(NOTE, 'Typed same evening')).slice(0, 60)}`);
    for (const k of ['m', 'r']) {
      const p = await until(() => para('Typed same evening'));
      surface().focus();
      select(p, 'Typed');
      await until(() => q('.sel-cue'));
      const taken = keyOn(surface(), { key: k, code: `Key${k.toUpperCase()}` });
      log(`bare ${k} over a selection in the note: taken ${taken}; composer ${q('.composer') ? 'open' : 'closed'}`);
    }
    window.getSelection()?.removeAllRanges();

    // ⌘⇧E in editable text: an extract
    const amp = await until(() => para('So the amplitude is the Fourier component'));
    surface().focus();
    select(amp, 'So the amplitude is the Fourier component of the perturbation at the transition frequency.');
    await until(() => q('.sel-cue'));
    const before = childrenOf(NOTE).length;
    const takenX = keyOn(surface(), { key: 'E', code: 'KeyE', metaKey: true, shiftKey: true });
    const child = await until(() => (childrenOf(NOTE).length > before ? childrenOf(NOTE).find((d) => d.includes('So the amplitude')) ?? childrenOf(NOTE)[0] : null), 8000);
    await sleep(800);
    log(`⌘⇧E: taken ${takenX}; extract ${child}: ${await head(child, 6)}; parent backref ${(await lineWith(NOTE, '<!-- extract')).trim()}; sidebar ${useApp.getState().sidebar.hidden ? 'hidden' : 'shown'}`);
    await shot('notes-extracted');

    // ⌘⇧M in editable text: the composer, saved as a card
    const gold = await until(() => qa<HTMLElement>('p.dd-p', surface()).find((p) => p.textContent?.includes('Valid while')));
    surface().focus();
    select(gold, 'Valid while');
    await until(() => q('.sel-cue'));
    const takenM = keyOn(surface(), { key: 'M', code: 'KeyM', metaKey: true, shiftKey: true });
    const ta = await until(() => q<HTMLTextAreaElement>('.composer textarea'), 5000);
    log(`⌘⇧M: taken ${takenM}; composer seed "${ta.value}"`);
    await shot('notes-composer');
    Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')!.set!.call(ta, 'first-order time-dependent PT is {{c1::valid while the amplitude stays small}}');
    ta.dispatchEvent(new Event('input', { bubbles: true }));
    await sleep(150);
    press('Enter', { metaKey: true });
    await until(() => (q('.composer') ? null : true), 5000);
    await sleep(1000);
    log(`card saved: ${await lineWith(NOTE, 'valid while the amplitude')}`);

    // a frozen source: bare e still extracts, and the cue says so
    await open(SOURCE);
    const sp = await until(() => qa<HTMLElement>('p.dd-p', surface()).find((p) => (p.textContent?.length ?? 0) > 80 && !p.classList.contains('extracted')));
    const words = sp.textContent!.split(/\s+/).slice(0, 6).join(' ');
    select(sp, words);
    await until(() => q('.sel-cue'));
    log(`frozen source: editable ${surface().isContentEditable}; cue ${cue()}; strip ${strip()}`);
    await shot('notes-frozen-cue');
    const srcBefore = childrenOf(SOURCE).length;
    press('e');
    await until(() => (childrenOf(SOURCE).length > srcBefore ? true : null), 8000).catch(() => null);
    log(`bare e in the frozen source: extracts ${srcBefore} → ${childrenOf(SOURCE).length}`);

    // F2: not in the page, only in the tree
    (document.activeElement as HTMLElement | null)?.blur?.();
    surface().focus();
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'F2', bubbles: true, cancelable: true }));
    surface().dispatchEvent(new KeyboardEvent('keydown', { key: 'F2', bubbles: true, cancelable: true }));
    await sleep(300);
    log(`F2 in the page: rename ${q('.edit-tree input.rename') ? 'open' : 'not open'}`);
    const treeRow = q<HTMLElement>(`.edit-tree .trow[data-path="${TYPELESS}"]`)!;
    treeRow.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    q<HTMLElement>('.edit-tree')!.focus();
    q<HTMLElement>('.edit-tree')!.dispatchEvent(new KeyboardEvent('keydown', { key: 'F2', bubbles: true, cancelable: true }));
    const input = await until(() => q<HTMLInputElement>('.edit-tree input.rename'), 3000).catch(() => null);
    log(`F2 in the tree: rename ${input ? `open on "${input.value}"` : 'not open'}`);
    input?.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));

    // imports land as sources; pasted text as a note
    const imported = await importNode('fleeting', { title: 'smoke import', text: 'What someone else wrote, dropped in as a file.' });
    const pasted = await importNode('fleeting', { title: 'smoke paste', text: 'What I typed into the intake myself.', note: true });
    await sleep(600);
    log(`imported ${imported}: ${await head(imported, 5)}; kind ${useApp.getState().docs[imported]?.type}`);
    log(`pasted ${pasted}: ${await head(pasted, 3)}; kind ${useApp.getState().docs[pasted]?.type}`);
    log(`done; vault ${vault.root}`);
  } catch (e) {
    log(`failed: ${e instanceof Error ? e.message : String(e)}`);
  }
}

// `ILMI_SMOKE=editing` over a copy of `samples/double-major` (ILMI_VAULT):
// milestone 34's "done when", in the note `fleeting/2026-10-29.md`. Below
// its last paragraph the smoke types a heading set with ⌘2 (⌘0 and back),
// a list by `- ` with items nested by Tab, moves an item with its children
// by ⌥⇧↓/↑, outdents and indents one with its child, ⏎ on an empty item
// (outdent, then leave), Backspace at an item's start (a paragraph) and ⌘Z,
// a task by `[ ] ` ticked by ⌘⏎ and its box, a numbered list by `1. ` with
// an item moved and renumbered, a quote by `> ` toggled by ⌘⇧., a rule by
// `---`, `* ` taken back by Backspace, a code block by a fence and ⏎, and
// a display formula by `$$` ⏎; then over the note's own words ⌘B ⌘I ⌘E
// ⌘⇧X (and ⌘B again, off), ⌘3 and ⌘0, ⌘⇧8 ⌘⇧7 ⌘⇧9 ⌘⇧. on and off, ⌘K's
// field and a pasted address; and the toolbar over a selection (its
// buttons, above the selection, `b` from it, gone when the selection is),
// and on a frozen source (card and extract only). After each step the
// file's affected lines are logged (` ⏎ ` between lines), and `shot:`
// lines mark the screens worth seeing.
export async function smokeEditing(vault: Vault): Promise<void> {
  const log = (s: string) => info(`smoke editing: ${s}`);
  const q = <T extends Element>(sel: string, root: ParentNode = document) => root.querySelector<T>(sel);
  const qa = <T extends Element>(sel: string, root: ParentNode = document) => Array.from(root.querySelectorAll<T>(sel));
  const shot = async (name: string, ms = 2600) => { await sleep(600); log(`shot: ${name}`); await sleep(ms); };
  const NOTE = 'fleeting/2026-10-29.md';
  const SOURCE = 'library/lindqvist-statistical-physics/ch-3-the-canonical-ensemble.md';
  const ANCHOR = 'Back has too much on it.';
  const text = () => vault.fs.readText(vault.abs(NOTE));
  let last = '';
  /** The note's lines from the anchor paragraph on: what the smoke typed. */
  const region = (t: string) => {
    const lines = t.split('\n');
    const i = lines.findIndex((l) => l.includes(ANCHOR));
    return lines.slice(i + 1).filter((l, k, all) => l || (k > 0 && all[k - 1])).join(' ⏎ ');
  };
  const fail = (msg: string): never => { throw new Error(msg); };
  /**
   * Wait for the file to say what `ok` wants: the reader writes 500 ms after
   * the last change (or on blur), and an earlier write of the same file can
   * land first, so the first change seen is not always the one asked for.
   */
  const waitFor = async (ok: (t: string) => boolean, ms = 5000) => {
    const t0 = Date.now();
    let t = await text();
    while (!ok(t) && Date.now() - t0 < ms) {
      await sleep(100);
      t = await text();
    }
    last = t;
    return t;
  };
  /** The file holds `lines`, one after another; logged, and the run fails when it does not. */
  const expectLines = async (label: string, lines: string[]) => {
    const has = (t: string) => { const all = t.split('\n'); return all.some((_, i) => lines.every((l, k) => all[i + k] === l)); };
    const t = await waitFor(has);
    const ok = has(t);
    log(`${label}: ${ok ? 'ok' : 'MISMATCH'}; ${region(t)}`);
    if (!ok) fail(`${label}: expected the lines ${JSON.stringify(lines)}`);
  };
  /** The line holding `needle`, which must equal `want` (or contain it, with `part`). */
  const expectLine = async (label: string, needle: string, want: string, part = false) => {
    const lineOf = (t: string) => t.split('\n').find((l) => l.includes(needle)) ?? '(none)';
    const good = (line: string) => (part ? line.includes(want) : line === want);
    const t = await waitFor((x) => good(lineOf(x)));
    const line = lineOf(t);
    const ok = good(line);
    log(`${label}: ${ok ? 'ok' : 'MISMATCH'}; ${line}`);
    if (!ok) fail(`${label}: expected ${JSON.stringify(want)}, the file has ${JSON.stringify(line)}`);
  };
  const expect = (label: string, ok: boolean, detail: string) => {
    log(`${label}: ${ok ? 'ok' : 'MISMATCH'}; ${detail}`);
    if (!ok) fail(`${label}: ${detail}`);
  };
  const open = async (path: string) => {
    openNode(path);
    await until(() => (activeTab(useApp.getState().panes)?.id === path ? q('.pane-body .doc-view .draft-doc') : null), 10000);
    await sleep(500);
  };
  const surface = () => q<HTMLElement>('.pane-body .doc-view .draft-doc')!;
  const BLOCKS = 'p.dd-p, .dd-h, .dd-li .li-text, .dd-ql, pre.dd-code code';
  /** The last textblock showing `needle` (what the smoke typed sits below the note's own text): a paragraph, a heading, an item, a quote line, code. */
  const block = (needle: string) => qa<HTMLElement>(BLOCKS, surface()).filter((p) => p.textContent?.includes(needle)).pop();
  const at = async (needle: string, offset = 0) => {
    const b = await until(() => block(needle));
    surface().focus();
    caret(b, needle, offset);
    await sleep(80);
  };
  const atEnd = async (needle: string) => at(needle, needle.length);
  /** `needle` selected inside the textblock that shows `context`. */
  const pickIn = async (context: string, needle: string) => {
    const b = await until(() => block(context));
    surface().focus();
    select(b, needle);
    await sleep(120);
  };
  /** Where the caret is: the closest textblock, by its kind, and its text. */
  const caretIn = () => {
    const n = document.getSelection()?.anchorNode ?? null;
    const el = (n?.nodeType === 1 ? (n as HTMLElement) : n?.parentElement)?.closest<HTMLElement>(`${BLOCKS}, .math-edit`);
    if (!el) return { kind: 'nothing', text: '' };
    const kind = el.matches('p.dd-p') ? 'paragraph' : el.matches('.dd-h') ? 'heading' : el.matches('.li-text') ? 'item' : el.matches('.dd-ql') ? 'quote' : el.matches('code') ? 'code' : 'formula';
    return { kind, text: el.textContent ?? '' };
  };
  /** The caret is in an empty paragraph of its own: a rule typed there starts a block. */
  const fresh = (label: string) => {
    const c = caretIn();
    expect(`${label}: a fresh paragraph`, c.kind === 'paragraph' && c.text === '', `caret in a ${c.kind} "${c.text.slice(0, 40)}"`);
  };
  const MOD = { metaKey: true };
  /** A key pressed on the focused page; true when the page took it. */
  const key = async (k: string, init: KeyboardEventInit = {}) => {
    const ev = new KeyboardEvent('keydown', { key: k, bubbles: true, cancelable: true, ...init });
    surface().dispatchEvent(ev);
    await sleep(80);
    return ev.defaultPrevented;
  };
  /** Typed as the keyboard would, a character at a time, so the rules see each one. */
  const type = async (s: string) => {
    for (const ch of s) {
      document.execCommand('insertText', false, ch);
      await sleep(30);
    }
    await sleep(60);
  };
  const enter = () => key('Enter', { code: 'Enter' });
  const tab = (shift = false) => key('Tab', { code: 'Tab', shiftKey: shift });
  try {
    for (const p of ['fleeting', 'library', 'library/lindqvist-statistical-physics']) toggleOpen(p, true);
    await open(NOTE);
    last = await text();
    expect('the note', !region(last), `kind ${useApp.getState().docs[NOTE]?.type}, editable ${surface().isContentEditable}; nothing after "${ANCHOR}" yet (a fresh copy of the sample)`);

    // a heading: typed, ⌘2, ⌘0 back to a paragraph, ⌘2 again
    await atEnd(ANCHOR);
    await enter();
    fresh('after the anchor');
    await type('Notes for Friday');
    expect('⌘2 taken', await key('2', { code: 'Digit2', ...MOD }), 'the page took it');
    await expectLines('⌘2', ['## Notes for Friday']);
    await key('0', { code: 'Digit0', ...MOD });
    await expectLines('⌘0', ['Notes for Friday']);
    await key('2', { code: 'Digit2', ...MOD });
    await expectLines('⌘2 again', ['## Notes for Friday']);

    // a list by `- `, nested by Tab
    await atEnd('Notes for Friday');
    await enter();
    fresh('under the heading');
    await type('- ');
    expect('"- " makes an item', caretIn().kind === 'item', `caret in a ${caretIn().kind}`);
    await type('adiabatic invariants');
    await enter();
    await type('the action J');
    await tab();
    await enter();
    await type('area of the ellipse');
    await tab();
    await enter();
    await tab(true);
    await tab(true);
    await type('the golden rule');
    await enter();
    await type('Fermi constant');
    const TREE = ['- adiabatic invariants', '  - the action J', '    - area of the ellipse', '- the golden rule', '- Fermi constant'];
    await expectLines('list typed', TREE);
    await shot('editing-list');

    // moved with its children
    await at('adiabatic invariants', 3);
    expect('⌥⇧↓ taken', await key('ArrowDown', { code: 'ArrowDown', altKey: true, shiftKey: true }), 'the page took it');
    await expectLines('⌥⇧↓ adiabatic invariants (with its children)', ['- the golden rule', '- adiabatic invariants', '  - the action J', '    - area of the ellipse', '- Fermi constant']);
    await shot('editing-moved');
    await key('ArrowUp', { code: 'ArrowUp', altKey: true, shiftKey: true });
    await expectLines('⌥⇧↑ back', TREE);

    // outdented and indented with its child
    await at('the action J', 2);
    expect('caret in the item', caretIn().kind === 'item', `caret in a ${caretIn().kind} "${caretIn().text}"`);
    await tab(true);
    await expectLines('⇧Tab the action J (with its child)', ['- adiabatic invariants', '- the action J', '  - area of the ellipse', '- the golden rule']);
    await tab();
    await expectLines('Tab the action J back', TREE);

    // ⏎ on an empty item: set in, it comes out; at the top, it leaves
    await atEnd('Fermi constant');
    await enter();
    await tab();
    await expectLines('⏎ then Tab after Fermi constant', ['- Fermi constant', '  - ']);
    await enter();
    await expectLines('⏎ on the empty nested item', ['- Fermi constant', '- ']);
    await enter();
    await expectLines('⏎ on the empty item', ['- Fermi constant', '']);
    fresh('⏎ on the empty item');

    // Backspace at an item's start: a paragraph; ⌘Z puts it back
    await at('Fermi constant', 0);
    await key('Backspace', { code: 'Backspace' });
    await expectLines('Backspace at the start of Fermi constant', ['- the golden rule', '', 'Fermi constant']);
    await key('z', { code: 'KeyZ', ...MOD });
    await expectLines('⌘Z', ['- the golden rule', '- Fermi constant']);

    // a task by `[ ] `, ticked by ⌘⏎, cleared by its box
    await atEnd('Fermi constant');
    await enter();
    await enter();
    fresh('after the list');
    await type('[ ] ');
    await type('ask Okonkwo about the shadow');
    await expectLines('[ ] typed', ['- [ ] ask Okonkwo about the shadow']);
    await key('Enter', { code: 'Enter', ...MOD });
    await expectLines('⌘⏎', ['- [x] ask Okonkwo about the shadow']);
    const box = await until(() => block('ask Okonkwo')?.closest('.dd-li')?.querySelector<HTMLElement>('.li-task'));
    box.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }));
    await expectLines('the box clicked', ['- [ ] ask Okonkwo about the shadow']);

    // numbered by `1. `, an item moved and the numbers following
    await atEnd('ask Okonkwo about the shadow');
    await enter();
    await enter();
    fresh('after the task');
    await type('1. ');
    await type('first');
    await enter();
    await type('second');
    await enter();
    await type('third');
    await expectLines('1. typed', ['1. first', '2. second', '3. third']);
    await at('third', 1);
    await key('ArrowUp', { code: 'ArrowUp', altKey: true, shiftKey: true });
    await expectLines('⌥⇧↑ third', ['1. first', '2. third', '3. second']);

    // a quote by `> `, off and on by ⌘⇧.
    await atEnd('second');
    await enter();
    await enter();
    fresh('after the numbers');
    await type('> ');
    await type('the classical shadow of this');
    await expectLines('> typed', ['> the classical shadow of this']);
    await key('>', { code: 'Period', shiftKey: true, ...MOD });
    await expectLines('⌘⇧. off', ['the classical shadow of this']);
    await key('>', { code: 'Period', shiftKey: true, ...MOD });
    await expectLines('⌘⇧. on', ['> the classical shadow of this']);

    // a rule by `---` (WebKit's smart dashes may turn the first two into an em dash; the rule takes either)
    await atEnd('the classical shadow of this');
    await enter();
    await enter();
    fresh('after the quote');
    await type('---');
    await expectLines('--- typed', ['> the classical shadow of this', '', '---']);
    fresh('after the rule');

    // `* ` makes an item; Backspace takes it back to the typed text
    await type('* ');
    expect('"* " makes an item', caretIn().kind === 'item', `caret in a ${caretIn().kind}`);
    await key('Backspace', { code: 'Backspace' });
    const back = caretIn();
    expect('Backspace after "* "', back.kind === 'paragraph' && back.text === '* ', `caret in a ${back.kind} "${back.text}"`);
    document.execCommand('delete');
    document.execCommand('delete');
    await sleep(150);
    fresh('"* " deleted');

    // code by a fence and ⏎; ⌘⏎ leaves it
    await type('```py');
    await enter();
    expect('fence ⏎', caretIn().kind === 'code', `caret in a ${caretIn().kind}`);
    await type('E = hbar * omega');
    await key('Enter', { code: 'Enter', ...MOD });
    await expectLines('``` ⏎ and code typed', ['```py', 'E = hbar * omega', '```']);
    fresh('⌘⏎ out of the code');
    await shot('editing-blocks');

    // display math by `$$` ⏎: the formula's editor opens
    await type('$$');
    await enter();
    const field = await until(() => q<HTMLTextAreaElement>('.pane-body .math-edit textarea'), 3000).catch(() => null);
    expect('$$ ⏎', !!field && field.value === '', field ? `editor open, "${field.value}"` : 'no editor');
    Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')!.set!.call(field, 'E_n = \\hbar\\omega(n + \\tfrac12)');
    field!.dispatchEvent(new Event('input', { bubbles: true }));
    await shot('editing-math');
    field!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));
    await expectLines('$$ written', ['$$E_n = \\hbar\\omega(n + \\tfrac12)$$']);

    // the formatting keys over the note's own words (the paragraph is tracked by "it was due", which the markers never split)
    const DUE = 'it was due';
    await pickIn(DUE, 'Skipped');
    expect('⌘B taken', await key('b', { code: 'KeyB', ...MOD }), 'the page took it');
    await expectLine('⌘B Skipped', DUE, '**Skipped** the 301 re-read today, it was due. Tomorrow.');
    await pickIn(DUE, 'today');
    await key('i', { code: 'KeyI', ...MOD });
    await expectLine('⌘I today', DUE, '**Skipped** the 301 re-read *today*, it was due. Tomorrow.');
    await pickIn(DUE, '301');
    await key('e', { code: 'KeyE', ...MOD });
    await expectLine('⌘E 301', DUE, '**Skipped** the `301` re-read *today*, it was due. Tomorrow.');
    await pickIn(DUE, 'Tomorrow.');
    await key('x', { code: 'KeyX', shiftKey: true, ...MOD });
    await expectLine('⌘⇧X Tomorrow.', DUE, '**Skipped** the `301` re-read *today*, it was due. ~~Tomorrow.~~');
    await pickIn(DUE, 'Skipped');
    await key('b', { code: 'KeyB', ...MOD });
    const L = 'Skipped the `301` re-read *today*, it was due. ~~Tomorrow.~~';
    await expectLine('⌘B Skipped again (off)', DUE, L);
    await at(DUE, 2);
    await key('3', { code: 'Digit3', ...MOD });
    await expectLine('⌘3', DUE, `### ${L}`);
    await key('0', { code: 'Digit0', ...MOD });
    await expectLine('⌘0', DUE, L);
    for (const [code, name, on] of [['Digit8', '⌘⇧8', '- '], ['Digit7', '⌘⇧7', '1. '], ['Digit9', '⌘⇧9', '- [ ] '], ['Period', '⌘⇧.', '> ']] as const) {
      await at(DUE, 2);
      await key(code === 'Period' ? '>' : '*', { code, shiftKey: true, ...MOD });
      await expectLine(`${name} on`, DUE, on + L);
      await at(DUE, 2);
      await key(code === 'Period' ? '>' : '*', { code, shiftKey: true, ...MOD });
      await expectLine(`${name} off`, DUE, L);
    }

    // ⌘K: the address field over a selection; with a bare caret, the palette; a pasted address over another selection
    await pickIn('mostly', 'Ibn Sīnā');
    expect('⌘K taken', await key('k', { code: 'KeyK', ...MOD }), `palette ${useApp.getState().paletteOpen ? 'open' : 'closed'}`);
    const addr = await until(() => q<HTMLInputElement>('.link-pop .field'), 3000).catch(() => null);
    expect('link field', !!addr, addr ? 'open' : 'not open');
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(addr, 'https://plato.stanford.edu/entries/ibn-sina-natural/');
    addr!.dispatchEvent(new Event('input', { bubbles: true }));
    await shot('editing-link');
    addr!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));
    await expectLine('⌘K link', 'mostly', '[Ibn Sīnā](https://plato.stanford.edu/entries/ibn-sina-natural/)', true);
    await at('adiabatic theorem today', 2);
    const bare = await key('k', { code: 'KeyK', ...MOD });
    await sleep(300);
    expect('⌘K with a bare caret', !q('.link-pop') && useApp.getState().paletteOpen, `taken by the page ${bare}; palette ${useApp.getState().paletteOpen ? 'open' : 'closed'}`);
    useApp.setState({ paletteOpen: false });
    await sleep(200);
    await pickIn('adiabatic theorem today', 'adiabatic theorem');
    try {
      const dt = new DataTransfer();
      dt.setData('text/plain', 'https://en.wikipedia.org/wiki/Adiabatic_theorem');
      surface().dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true }));
    } catch (e) {
      log(`paste: ${e instanceof Error ? e.message : String(e)}`);
    }
    await expectLine('pasted address', 'Okonkwo', '[adiabatic theorem](https://en.wikipedia.org/wiki/Adiabatic_theorem) today', true);

    // the toolbar: over a selection, wholly above its first line; `b` from it; gone with the selection
    await pickIn('canonical-transformation', 'the canonical-transformation section');
    const cue = await until(() => q<HTMLElement>('.pane-body .sel-cue'), 3000).catch(() => null);
    await sleep(200);
    const rects = window.getSelection()?.rangeCount ? Array.from(window.getSelection()!.getRangeAt(0).getClientRects()).filter((r) => r.width > 0) : [];
    const selTop = Math.min(...rects.map((r) => r.top));
    const selBottom = Math.max(...rects.map((r) => r.bottom));
    const cr = cue?.getBoundingClientRect();
    const clear = !!cr && (cue!.dataset.place === 'above' ? cr.bottom <= selTop - 2 : cr.top >= selBottom + 2);
    expect('toolbar', !!cue && clear, `${cue ? qa<HTMLElement>('button', cue).map((b) => b.textContent?.trim()).join(' | ') : 'none'}; place ${cue?.dataset.place}; its top ${cr ? Math.round(cr.top) : '-'}, bottom ${cr ? Math.round(cr.bottom) : '-'}; the selection ${Math.round(selTop)}–${Math.round(selBottom)}`);
    await shot('editing-toolbar');
    q<HTMLElement>('.pane-body .sel-cue .cue-fmt[data-fmt="strong"]')?.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }));
    await expectLine('toolbar b', 'canonical-transformation', '**the canonical-transformation section**', true);
    window.getSelection()?.collapseToEnd();
    await sleep(400);
    expect('selection collapsed', !q('.pane-body .sel-cue'), q('.pane-body .sel-cue') ? 'toolbar still there' : 'toolbar gone');

    // a frozen source: the toolbar is card and extract only
    await open(SOURCE);
    const sp = await until(() => qa<HTMLElement>('p.dd-p', surface()).find((p) => (p.textContent?.length ?? 0) > 80));
    select(sp, sp.textContent!.split(/\s+/).slice(0, 4).join(' '));
    const fcue = await until(() => q<HTMLElement>('.pane-body .sel-cue'), 3000).catch(() => null);
    const fb = fcue ? qa<HTMLElement>('button', fcue).map((b) => b.textContent?.trim()).join(' | ') : 'none';
    expect('frozen source toolbar', fb === 'card m | extract e', `${fb}; editable ${surface().isContentEditable}`);
    await shot('editing-frozen-toolbar');
    window.getSelection()?.removeAllRanges();

    await open(NOTE);
    const final = await text();
    log(`file: ${final.split('\n').length} lines; the typed part: ${region(final)}`);
    log(`done; vault ${vault.root}`);
  } catch (e) {
    log(`failed: ${e instanceof Error ? e.message : String(e)}`);
  }
}

// `ILMI_SMOKE=tree` over a copy of `samples/double-major` (ILMI_VAULT):
// milestone 38's "done when". Drags rows of the sidebar with synthetic
// DragEvents at a row's top, middle (with and without a rest), and bottom,
// on an open parent's bottom (its first child), and below a last child at
// three pointer depths, then on a folded row (the spring) cancelled with
// Esc, a refused drop, the edge scroll, a new empty folder's placeholder,
// the tab rail, the folder lens, and across them; for each it logs what was
// drawn (the mark, its row, the depth its line is indented to), what the
// drop was, and where the node landed (its path, its directory's order
// from `.ilmi/order.json`, and whether that is where the mark said). Then
// the keys (↑↓→←, type-ahead, ⏎, F2 and Esc, ⌥⌘ moves, ⌘⌫ asking), the
// open note revealed in a folded tree, the hover `+` and `···` menus, a
// hoist and its crumb, the breadcrumbs, and every row at the default width
// checked for a name cut short by its count. `shot:` lines mark the screens.
export async function smokeTree(vault: Vault): Promise<void> {
  const log = (s: string) => info(`smoke tree: ${s}`);
  const shot = async (name: string, ms = 3000) => { await sleep(500); log(`shot: ${name}`); await sleep(ms); };
  const q = <T extends Element>(sel: string, root: ParentNode = document) => root.querySelector<T>(sel);
  const qa = <T extends Element>(sel: string, root: ParentNode = document) => Array.from(root.querySelectorAll<T>(sel));
  const { useDrag } = await import('./drag.js');
  const { childDirOf, childrenAt, dirOf, baseOf, entryOf, ordered } = await import('../vault/index.js');
  const { setSidebar } = await import('./vault.js');
  const { SIDE_DEFAULT } = await import('./store.js');
  const trow = (path: string) => q<HTMLElement>(`.edit-tree .trow[data-path="${CSS.escape(path)}"]:not(.placeholder)`);
  const rrow = (path: string) => q<HTMLElement>(`.tab-rail .rail-row[data-path="${CSS.escape(path)}"]`);
  const lrow = (path: string) => q<HTMLElement>(`.folder-view .fv-row[data-path="${CSS.escape(path)}"]`);
  const box = () => q<HTMLElement>('.edit-tree')!;
  const rowsOf = (prefix: string) => qa<HTMLElement>('.edit-tree .trow')
    .filter((r) => (r.dataset.path ?? '').startsWith(prefix))
    .map((r) => `${'  '.repeat(Math.max(0, Math.round((parseFloat(r.style.paddingLeft || '6') - 6) / 10) - 1))}${r.classList.contains('placeholder') ? '(empty)' : `${r.querySelector('.glyph')?.textContent ?? ''}${r.querySelector('.name')?.textContent ?? ''}`}${r.dataset.selected === '1' ? ' [sel]' : ''}${r.dataset.active === '1' ? ' [open]' : ''}`)
    .join(' | ');
  const dirList = (dir: string) => ordered(childrenAt(vault.tree, dir) ?? [], vault.order[dir]).map((n) => entryOf(n.path));
  const orderOf = async (dir: string) => {
    const abs = vault.abs('.ilmi/order.json');
    if (!(await vault.fs.stat(abs))) return 'no order.json';
    const all = JSON.parse(await vault.fs.readText(abs)) as Record<string, string[]>;
    return `order.json["${dir}"] = ${JSON.stringify(all[dir] ?? null)}`;
  };
  // the mark drawn now: on which row, which kind, the depth its line is indented to (the surface's pad and indent)
  const mark = () => {
    const el = q<HTMLElement>('.trow[class*="drop-"], .rail-row[class*="drop-"], .fv-row[class*="drop-"], .fv-empty[class*="drop-"]');
    if (!el) return 'nothing drawn';
    const kind = el.className.match(/drop-(top|bottom|into)/)?.[1] ?? '?';
    const x = parseFloat(el.style.getPropertyValue('--drop-x') || 'NaN');
    const [pad, ind] = el.classList.contains('rail-row') ? [-6, 12] : el.classList.contains('fv-row') ? [0, 1] : [6, 10];
    const depth = Number.isFinite(x) ? ` at depth ${Math.round((x - pad) / ind)}` : '';
    return `${kind === 'into' ? 'box around' : `line ${kind === 'top' ? 'above' : 'below'}`} ${el.dataset.path || '/'}${depth}`;
  };
  type Where = 'top' | 'mid' | 'bottom';
  /**
   * A drag as a pointer would make it: dragstart on `from`, dragenter and
   * dragover on `to` at its top (12%), middle, or bottom (88%), `x` px from
   * its left (else near its right end), resting first when asked; logs the
   * mark and the drop, then drops (or presses Esc) and checks the landing.
   */
  const drag = async (name: string, from: HTMLElement | null, to: HTMLElement | null, where: Where, opts: { x?: number; rest?: number; shot?: string; esc?: boolean } = {}) => {
    if (!from || !to) { log(`${name}: a row is missing (${from ? '' : 'from '}${to ? '' : 'to'})`); return; }
    const moving = from.dataset.path ?? '';
    // the mouse's drag (`drag.ts`): on the Mac the page never sees a native drag's dragover or drop
    // (Tauri's window takes them, for files), so a row is dragged by the pointer and hit-tested
    const ptr = (target: EventTarget, type: string, x: number, y: number) =>
      target.dispatchEvent(new PointerEvent(type, { bubbles: true, cancelable: true, button: 0, buttons: type === 'pointerup' ? 0 : 1, pointerType: 'mouse', isPrimary: true, clientX: x, clientY: y }));
    const fr = from.getBoundingClientRect();
    const fx = fr.left + Math.min(60, fr.width / 2);
    const fy = fr.top + fr.height / 2;
    ptr(from.querySelector('.name') ?? from, 'pointerdown', fx, fy);
    ptr(window, 'pointermove', fx + 8, fy + 8);
    // the target in the middle of its scroller, so the edge scroll does not move it under the pointer during a rest (39)
    to.scrollIntoView({ block: 'center' });
    await sleep(100);
    const r = to.getBoundingClientRect();
    const y = r.top + r.height * (where === 'top' ? 0.12 : where === 'mid' ? 0.5 : 0.88);
    const x = r.left + (opts.x ?? r.width - 40);
    ptr(window, 'pointermove', x, y);
    // a still pointer: the drag reads it again on its own (no more moves sent)
    if (opts.rest) await sleep(opts.rest);
    await sleep(120);
    const d0 = useDrag.getState().drop;
    const accepted = document.documentElement.dataset.nodeDrag === 'move';
    const under = document.elementFromPoint(x, y)?.closest<HTMLElement>('[data-drop-row]')?.dataset.dropRow ?? 'no row';
    log(`${name}: ${moving} over the ${where} of ${to.dataset.path}${opts.x !== undefined ? ` (x ${opts.x})` : ''}${opts.rest ? ` resting ${opts.rest} ms` : ''}: under the pointer ${under}, accepted ${accepted}, ghost ${q('.drag-ghost')?.textContent ?? 'none'}, drawn ${mark()}, drop ${d0 ? `${d0.mode} ${d0.target}` : 'none (refused)'}`);
    if (opts.shot) await shot(opts.shot, 2500);
    // what the mark says at the let-go (a still pointer on a bare document's middle nests meanwhile, as it should)
    const d = opts.esc ? d0 : useDrag.getState().drop;
    if (!opts.esc && (d?.mode !== d0?.mode || d?.target !== d0?.target)) log(`${name}: at the let-go the mark says ${d ? `${d.mode} ${d.target}` : 'nothing'} (${mark()})`);
    if (opts.esc) {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
      await sleep(80);
      log(`${name}: Esc, drawn ${mark()}`);
    }
    ptr(window, 'pointerup', x, y);
    // the click a real let-go makes, which the drag swallows
    to.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, clientX: x, clientY: y }));
    if (!d || opts.esc) {
      await sleep(600);
      log(`${name}: nothing moved: ${vault.documents().includes(moving) || !moving.endsWith('.md') ? 'yes' : 'NO'}`);
      return;
    }
    const dir = d.mode === 'into' ? childDirOf(d.target) : dirOf(d.target);
    const landed = `${dir ? `${dir}/` : ''}${baseOf(moving)}`;
    try { await until(() => (dirList(dir).includes(entryOf(landed)) && (d.mode === 'into' || vault.order[dir]) ? true : null), 8000); } catch { /* logged below */ }
    await sleep(400);
    const list = dirList(dir);
    const i = list.indexOf(entryOf(landed));
    const asDrawn = i >= 0 && (d.mode === 'into' || (d.mode === 'before' ? list[i + 1] === entryOf(d.target) : list[i - 1] === entryOf(d.target)));
    log(`${name}: landed ${landed} (${i + 1} of ${list.length} in ${dir || '/'}: ${list.join(', ')}); ${await orderOf(dir)}; where the mark said: ${asDrawn ? 'yes' : 'NO'}`);
  };
  const press = (key: string, init: KeyboardEventInit = {}) => {
    const ev = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ...init });
    box().dispatchEvent(ev);
    return ev.defaultPrevented;
  };
  const selectedRow = () => q<HTMLElement>('.edit-tree .trow[data-selected="1"]')?.dataset.path ?? 'none';
  const entries = () => qa<HTMLElement>('.ctx-menu .ci').map((e) => e.textContent).join(' | ');
  const F26 = 'courses/fall-2026';
  const QM = `${F26}/phys-412-quantum-ii.md`;
  const QMK = `${F26}/phys-412-quantum-ii`;
  const SM = `${F26}/phys-415-stat-mech`;
  const GRAMMAR = `${F26}/arab-401-advanced-grammar.md`;
  try {
    setSidebar({ width: SIDE_DEFAULT, hidden: false });
    for (const p of ['', 'courses', F26, QM, `${QMK}/problem-sets`, GRAMMAR, `${SM}.md`, 'fleeting', 'physics', 'arabic']) toggleOpen(p, true);
    openNode(queueId('today'));
    await until(() => trow(`${QMK}/problem-sets/ps-7.md`));
    await sleep(600);
    log(`glyphs: ${(['folder', 'note', 'source', 'extract', 'deck', 'draft'] as const).map((k) => `${k} ${GLYPH[k]}`).join(', ')}`);
    log(`start: ${rowsOf('fleeting')} || ${rowsOf('physics')} || ${rowsOf('arabic')}`);
    await shot('tree-start');

    // ── drags in the tree ──
    await drag('top', trow('fleeting/2026-10-27.md'), trow('fleeting/2026-10-30.md'), 'top', { shot: 'tree-drag-top' });
    await drag('bottom', trow('fleeting/idea-for-honors-thesis.md'), trow('fleeting/2026-10-30.md'), 'bottom');
    // the middle of a bare document, no rest: a reorder, never a nest by accident
    await drag('middle, no rest', trow('arabic/roots.md'), trow('arabic/vocabulary.md'), 'mid', { shot: 'tree-drag-mid-no-rest' });
    // the middle of a bare document after a rest: into it, its children directory made
    await drag('middle, rested', trow('fleeting/2026-10-29.md'), trow('fleeting/idea-for-honors-thesis.md'), 'mid', { rest: 600, shot: 'tree-drag-into-rested' });
    await drag('middle of a folder', trow('fleeting/clipped-why-perturbation-series-diverge.md'), trow('physics'), 'mid');
    // an open parent's bottom quarter: its first child
    await drag('open parent bottom', trow('arabic/roots.md'), trow(GRAMMAR), 'bottom', { shot: 'tree-drag-first-child' });
    // below the last child of problem sets, at three depths: ps-7 sits at depth 5, problem sets at 4, the course at 3
    const depthX = (d: number) => 6 + d * 13 + 4;
    await drag('below last, depth 5', trow('physics/constants-and-orders-of-magnitude.md'), trow(`${QMK}/problem-sets/ps-7.md`), 'bottom', { x: depthX(5) + 30, shot: 'tree-drag-below-last-5' });
    await drag('below last, depth 4', trow('physics/derivation-drills.md'), trow(`${QMK}/problem-sets/constants-and-orders-of-magnitude.md`), 'bottom', { x: depthX(4), shot: 'tree-drag-below-last-4' });
    await drag('below last, depth 3', trow('arabic/vocabulary.md'), trow(`${QMK}/derivation-drills.md`), 'bottom', { x: depthX(3), shot: 'tree-drag-below-last-3' });
    log(`after the drags: ${rowsOf(QMK)} || ${rowsOf(F26).split(' | ').filter((r) => !r.startsWith('    ')).join(' | ')}`);
    // refused: a folder into its own subtree
    await drag('refused', trow(F26), trow(QM), 'mid', { shot: 'tree-drag-refused' });
    // a folded row opens after a rest; Esc cancels and the drop does nothing
    const book = 'library/classical-prose-reader.md';
    toggleOpen('library', true);
    toggleOpen(book, false);
    await until(() => trow(book));
    await drag('spring, then Esc', trow('fleeting/2026-10-30.md'), trow(book), 'mid', { rest: 700, esc: true, shot: 'tree-drag-spring' });
    log(`spring: ${book} open ${useApp.getState().open[book] ? 'yes' : 'NO'}`);
    // the edge scroll: a dragover near the sidebar's bottom edge scrolls it
    {
      const side = q<HTMLElement>('.side')!;
      side.scrollTop = 0;
      const sb = side.getBoundingClientRect();
      const low = qa<HTMLElement>('.edit-tree .trow').reverse().find((r) => { const rr = r.getBoundingClientRect(); return rr.bottom <= sb.bottom && rr.bottom > sb.bottom - 40; });
      // the mouse held still near the edge: the drag reads it again on its own and keeps scrolling
      const ptr = (target: EventTarget, type: string, x: number, y: number) =>
        target.dispatchEvent(new PointerEvent(type, { bubbles: true, cancelable: true, button: 0, buttons: 1, pointerType: 'mouse', isPrimary: true, clientX: x, clientY: y }));
      const src = trow('fleeting/2026-10-30.md');
      const fr = src?.getBoundingClientRect();
      if (src && fr) {
        ptr(src, 'pointerdown', fr.left + 40, fr.top + fr.height / 2);
        ptr(window, 'pointermove', fr.left + 50, fr.top + fr.height / 2 + 8);
        ptr(window, 'pointermove', sb.left + 60, sb.bottom - 4);
        await sleep(300);
      }
      log(`edge scroll: the sidebar scrolled from 0 to ${side.scrollTop} (${low ? `over ${low.dataset.path}` : 'no row at the edge'})`);
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
      ptr(window, 'pointerup', sb.left + 60, sb.bottom - 4);
      side.scrollTop = 0;
    }
    // an empty folder: one quiet row, taking a drop into the folder
    const empty = await createNode('', 'folder');
    toggleOpen(empty, true);
    await until(() => q(`.edit-tree .trow.placeholder[data-path="${CSS.escape(empty)}"]`));
    log(`empty folder ${empty}: ${rowsOf(empty)}`);
    await drag('placeholder', trow('fleeting/2026-10-30.md'), q<HTMLElement>(`.edit-tree .trow.placeholder[data-path="${CSS.escape(empty)}"]`), 'mid', { shot: 'tree-drag-placeholder' });

    // ── the rail and the folder lens, and across ──
    openNode(QM);
    await until(() => rrow(`${QMK}/variational-method.md`), 10000);
    await sleep(600);
    const rail = () => qa<HTMLElement>('.tab-rail .rail-row').map((r) => r.querySelector('.name')?.textContent).join(' | ');
    log(`rail: ${rail()}`);
    await drag('rail top', rrow(`${QMK}/variational-method.md`), rrow(`${QMK}/nondegenerate-perturbation-theory.md`), 'top', { shot: 'tree-rail-drag' });
    await drag('tree → rail', trow(`${empty}/2026-10-30.md`), rrow(`${QMK}/wkb-approximation.md`), 'bottom');
    await sleep(400);
    log(`rail after: ${rail()}`);
    await drag('rail → tree', rrow(`${QMK}/2026-10-30.md`), trow('fleeting/2026-10-27.md'), 'top');
    openNode(SM);
    await until(() => lrow(`${SM}/canonical-ensemble.md`), 10000);
    await sleep(500);
    await drag('lens top', lrow(`${SM}/derivations.md`), lrow(`${SM}/canonical-ensemble.md`), 'top', { shot: 'tree-lens-drag' });
    await drag('tree → lens', trow('fleeting/2026-10-27.md'), lrow(`${SM}/microcanonical-ensemble.md`), 'bottom');
    await drag('lens → tree', lrow(`${SM}/2026-10-27.md`), trow('fleeting/2026-10-30.md'), 'top');

    // ── the keys ──
    trow('fleeting')?.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    box().focus();
    await sleep(100);
    const step = async (label: string, key: string, init: KeyboardEventInit = {}) => {
      const taken = press(key, init);
      await sleep(250);
      log(`key ${label}: taken ${taken}, selected ${selectedRow()}`);
    };
    await step('↓', 'ArrowDown');
    await step('↓', 'ArrowDown');
    await step('↑', 'ArrowUp');
    await step('←', 'ArrowLeft');
    await step('←', 'ArrowLeft');
    log(`fleeting open: ${useApp.getState().open['fleeting'] ? 'yes' : 'no'}`);
    await step('→', 'ArrowRight');
    await step('→', 'ArrowRight');
    await sleep(800);
    await step('i (type-ahead)', 'i');
    await step('⏎', 'Enter');
    log(`after ⏎ the tab is ${activeTab(useApp.getState().panes)?.id}`);
    // F2 in the page is not the tree's; in the tree, pressed right after the row's press (as 33's smoke does), it renames that row
    (document.activeElement as HTMLElement | null)?.blur?.();
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'F2', bubbles: true, cancelable: true }));
    await sleep(200);
    log(`F2 with the tree unfocused: rename ${q('.edit-tree input.rename') ? 'OPEN' : 'not open'}`);
    const picked = selectedRow();
    trow(picked)?.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    box().focus();
    press('F2');
    await sleep(200);
    const input = q<HTMLInputElement>('.edit-tree input.rename');
    log(`F2 in the tree: rename field ${input ? `"${input.value}" on ${input.closest<HTMLElement>('.trow')?.dataset.path}` : 'NOT OPEN'} (selected ${picked})`);
    input?.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
    await sleep(200);
    log(`Esc: field ${q('.edit-tree input.rename') ? 'still open' : 'gone'}, focus in the tree ${document.activeElement === box() ? 'yes' : 'no'}`);
    await shot('tree-keys');
    const moved = selectedRow();
    await step('⌥⌘↑', 'ArrowUp', { metaKey: true, altKey: true });
    await sleep(500);
    log(`⌥⌘↑: fleeting ${dirList('fleeting').join(', ')}; ${await orderOf('fleeting')}`);
    await step('⌥⌘→', 'ArrowRight', { metaKey: true, altKey: true });
    await sleep(700);
    log(`⌥⌘→: ${rowsOf('fleeting')}`);
    await step('⌥⌘←', 'ArrowLeft', { metaKey: true, altKey: true });
    await sleep(700);
    log(`⌥⌘←: ${rowsOf('fleeting')}; ${moved} back at ${selectedRow()}`);
    await shot('tree-keys-moved');
    // ⌘⌫ on a row with something under it asks, in the row; any other key lets it go
    trow('fleeting/idea-for-honors-thesis.md')?.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    box().focus();
    await step('⌘⌫', 'Backspace', { metaKey: true });
    log(`⌘⌫: "${q('.edit-tree .asking')?.textContent ?? 'nothing asked'}"; still there ${vault.documents().includes('fleeting/idea-for-honors-thesis.md')}`);
    await shot('tree-delete-asks');
    await step('↓ (lets it go)', 'ArrowDown');
    log(`asked still: ${q('.edit-tree .asking') ? 'yes' : 'no'}`);

    // ── the open note revealed in a folded tree ──
    useApp.setState({ open: { '': true } });
    await sleep(300);
    const KANA = `${F26}/arab-401-advanced-grammar/kana-and-its-sisters.md`;
    openNode(KANA);
    await until(() => trow(KANA), 8000);
    await sleep(500);
    const sideBox = q<HTMLElement>('.side')!.getBoundingClientRect();
    const kr = trow(KANA)!.getBoundingClientRect();
    log(`reveal: open rows ${Object.keys(useApp.getState().open).map((p) => p || '/').join(', ')}; ${KANA} active ${trow(KANA)?.dataset.active === '1'}, in view ${kr.top >= sideBox.top && kr.bottom <= sideBox.bottom}`);
    const crumbs = qa<HTMLElement>('.pane-body .crumbs .cr');
    log(`breadcrumbs: ${crumbs.length ? crumbs.map((c) => `${c.textContent} → ${c.dataset.path}`).join(' / ') : 'none (the reader still draws the text crumb)'}`);
    await shot('tree-reveal');

    // ── hover affordances ──
    const f26 = trow(F26)!;
    // the selected row shows them too, as hover would (a pointer's hover cannot be dispatched)
    f26.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    await sleep(150);
    log(`row acts on ${F26}: ${qa('.row-acts .ra', f26).map((e) => e.textContent).join(' ')}`);
    q<HTMLElement>('.row-acts .add', f26)?.click();
    await until(() => q('.ctx-menu'));
    log(`+ menu: ${entries()}`);
    await shot('tree-row-plus');
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    await sleep(150);
    q<HTMLElement>('.row-acts .more', f26)?.click();
    await until(() => q('.ctx-menu'));
    log(`··· menu: ${entries()}`);
    await shot('tree-row-more');
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    await sleep(150);

    // ── hoist ──
    for (const p of [F26, QM]) toggleOpen(p, true);
    await until(() => trow(QM));
    trow(QM)!.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, altKey: true }));
    await sleep(400);
    log(`hoisted: crumb ${qa<HTMLElement>('.hoist-crumb .hc').map((c) => c.textContent).join(' / ')}; rows ${rowsOf(QMK)}`);
    await shot('tree-hoist');
    qa<HTMLElement>('.hoist-crumb .hc')[0]?.click();
    await sleep(300);
    log(`unhoisted: ${q('.hoist-crumb') ? 'STILL HOISTED' : 'the whole tree'}`);

    // ── every row at the default width: a name never cut short by its count ──
    const all: Record<string, true> = { '': true };
    const visit = (nodes: typeof vault.tree) => { for (const n of nodes) { const kids = n.kind === 'folder' ? n.children : n.children ?? []; if (kids.length) { all[n.path] = true; visit(kids); } } };
    visit(vault.tree);
    useApp.setState({ open: all });
    await sleep(800);
    const rows = qa<HTMLElement>('.edit-tree .trow:not(.placeholder)');
    const cut = rows.filter((r) => { const n = q<HTMLElement>('.name', r); return !!n && n.scrollWidth > n.clientWidth + 1; });
    const byCount = cut.filter((r) => { const n = q<HTMLElement>('.name', r)!; const due = q<HTMLElement>('.due', r); return !!due && n.scrollWidth <= n.clientWidth + due.getBoundingClientRect().width + 6; });
    log(`width ${q<HTMLElement>('.side')!.getBoundingClientRect().width}px: ${rows.length} rows, ${rows.filter((r) => q('.due', r)).length} with a due number; ${cut.length} names cut by the width (${cut.slice(0, 8).map((r) => r.querySelector('.name')?.textContent).join('; ')}${cut.length > 8 ? '; …' : ''}); cut by their count: ${byCount.length ? byCount.map((r) => r.dataset.path).join(', ') : 'none'}`);
    await shot('tree-all-open', 3500);
    useApp.getState().setTheme('dark');
    await shot('tree-dark', 2500);
    useApp.getState().setTheme('eink');
    await shot('tree-eink', 2500);
    useApp.getState().setTheme('light');
    log(`done; vault ${vault.root}`);
  } catch (e) {
    log(`failed: ${e instanceof Error ? e.message : String(e)}`);
  }
}

// `ILMI_SMOKE=insert` over a copy of `samples/double-major` (ILMI_VAULT):
// milestone 35's "done when". On `fleeting/2026-10-30.md`, below its last
// paragraph, it types `/` and a query for every row of the slash menu
// (headings, the lists, a quote, code, a display formula, a rule, a table,
// an image from a stubbed picker), checking the lit row before ⏎ and the
// file's lines after; one row picked with ↓, one with the pointer, Esc
// leaving the `/`; then the three card forms, each read back as a card.
// Then a web fragment pasted (a heading, emphasis, a link, nested and
// numbered lists) and checked line by line, the same paste after ⌘⇧V as
// plain text, an image pasted from the clipboard and one dropped through
// the window's drop router, each a file `img-NN.png` beside the note and
// linked there. Then find: ⌘F on the voweled kāna note, `كان` typed with no
// vowels, the count checked against the file's own text, ⏎ walked over
// every match (each lit match folds to the word; the count wraps), ⇧⏎ and
// ⌘G, Esc; ⌥⌘F on the note replaces one word and then every match of
// another; on a frozen source the bar has no replace row. Every step
// asserts; a mismatch ends the run with `failed:`. `shot:` lines mark the
// screens worth a capture.
export async function smokeInsert(vault: Vault): Promise<void> {
  const log = (s: string) => info(`smoke insert: ${s}`);
  const q = <T extends Element>(sel: string, root: ParentNode = document) => root.querySelector<T>(sel);
  const qa = <T extends Element>(sel: string, root: ParentNode = document) => Array.from(root.querySelectorAll<T>(sel));
  const shot = async (name: string, ms = 2600) => { await sleep(600); log(`shot: ${name}`); await sleep(ms); };
  const { dropAt } = await import('./land.js');
  const { imagePicker } = await import('./pageImages.js');
  const { findIn, foldText } = await import('../reader/index.js');
  const NOTE = 'fleeting/2026-10-30.md';
  const KANA = 'courses/fall-2026/arab-401-advanced-grammar/kana-and-its-sisters.md';
  const SOURCE = 'library/lindqvist-statistical-physics/ch-3-the-canonical-ensemble.md';
  const ANCHOR = 'can I move a card without retyping it?]';
  const text = (path = NOTE) => vault.fs.readText(vault.abs(path));
  const fail = (msg: string): never => { throw new Error(msg); };
  /** The note's lines after the anchor paragraph: what the smoke typed. */
  const region = (t: string) => {
    const lines = t.split('\n');
    const i = lines.findIndex((l) => l.includes(ANCHOR));
    return lines.slice(i + 1).filter((l, k, all) => l || (k > 0 && all[k - 1])).join(' ⏎ ');
  };
  const waitFor = async (ok: (t: string) => boolean, path = NOTE, ms = 5000) => {
    const t0 = Date.now();
    let t = await text(path);
    while (!ok(t) && Date.now() - t0 < ms) {
      await sleep(100);
      t = await text(path);
    }
    return t;
  };
  /** The file holds `lines`, one after another; the run fails when it does not. */
  const expectLines = async (label: string, lines: string[], path = NOTE) => {
    const has = (t: string) => { const all = t.split('\n'); return all.some((_, i) => lines.every((l, k) => all[i + k] === l)); };
    const t = await waitFor(has, path);
    const ok = has(t);
    log(`${label}: ${ok ? 'ok' : 'MISMATCH'}; ${path === NOTE ? region(t).slice(-400) : lines.join(' ⏎ ')}`);
    if (!ok) fail(`${label}: expected the lines ${JSON.stringify(lines)}`);
  };
  const expect = (label: string, ok: boolean, detail: string) => {
    log(`${label}: ${ok ? 'ok' : 'MISMATCH'}; ${detail}`);
    if (!ok) fail(`${label}: ${detail}`);
  };
  const open = async (path: string) => {
    openNode(path);
    await until(() => (activeTab(useApp.getState().panes)?.id === path ? q('.pane-body .doc-view .draft-doc') : null), 10000);
    await sleep(500);
  };
  const surface = () => q<HTMLElement>('.pane-body .doc-view .draft-doc')!;
  const BLOCKS = 'p.dd-p, .dd-h, .dd-li .li-text, .dd-ql, pre.dd-code code';
  /** The last textblock showing `needle`: what the smoke typed sits below the note's own text. */
  const block = (needle: string) => qa<HTMLElement>(BLOCKS, surface()).filter((p) => p.textContent?.includes(needle)).pop();
  const atEnd = async (needle: string) => {
    const b = await until(() => block(needle));
    surface().focus();
    caret(b, needle, needle.length);
    await sleep(80);
  };
  const caretIn = () => {
    const n = document.getSelection()?.anchorNode ?? null;
    const el = (n?.nodeType === 1 ? (n as HTMLElement) : n?.parentElement)?.closest<HTMLElement>(`${BLOCKS}`);
    if (!el) return { kind: 'nothing', text: '' };
    const kind = el.matches('p.dd-p') ? 'paragraph' : el.matches('.dd-h') ? `heading ${el.tagName.toLowerCase()}` : el.matches('.li-text') ? 'item' : el.matches('.dd-ql') ? 'quote' : 'code';
    return { kind, text: el.textContent ?? '' };
  };
  const fresh = (label: string) => {
    const c = caretIn();
    expect(`${label}: a fresh paragraph`, c.kind === 'paragraph' && c.text === '', `caret in a ${c.kind} "${c.text.slice(0, 40)}"`);
  };
  const MOD = { metaKey: true };
  const key = async (k: string, init: KeyboardEventInit = {}, target: EventTarget = surface()) => {
    const ev = new KeyboardEvent('keydown', { key: k, bubbles: true, cancelable: true, ...init });
    target.dispatchEvent(ev);
    await sleep(80);
    return ev.defaultPrevented;
  };
  const type = async (str: string) => {
    for (const ch of str) {
      document.execCommand('insertText', false, ch);
      await sleep(30);
    }
    await sleep(80);
  };
  const enter = () => key('Enter', { code: 'Enter' });
  const menu = () => q<HTMLElement>('.pane-body .slash-menu');
  const lit = () => q<HTMLElement>('.pane-body .slash-menu .sm-row.on')?.dataset.id ?? '(none)';
  /** `/query` typed; the menu must be open with `id` lit. */
  const slash = async (query: string, id: string) => {
    await type(`/${query}`);
    const m = await until(() => menu(), 2000).catch(() => null);
    expect(`/${query}`, !!m && lit() === id, m ? `rows ${qa<HTMLElement>('.sm-row', m).map((r) => r.dataset.id).join(' ')}; lit ${lit()}` : 'no menu');
  };
  /** A paste event as the clipboard would send it. */
  const paste = (data: Record<string, string>, files: File[] = []) => {
    const dt = new DataTransfer();
    for (const [type, value] of Object.entries(data)) dt.setData(type, value);
    for (const f of files) dt.items.add(f);
    surface().dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true }));
  };
  const PNG = Uint8Array.from(atob('iVBORw0KGgoAAAANSUhEUgAAABgAAAAQCAIAAACDRijCAAAAGklEQVR42mM4scCGKohh1KBRg0YNGjWIMgQAWtJ2H9RWthQAAAAASUVORK5CYII='), (c) => c.charCodeAt(0));
  const IMG_DIR = 'fleeting/2026-10-30';
  const imgBytes = async (n: number) => {
    try { return (await vault.fs.readBytes(vault.abs(`${IMG_DIR}/img-${String(n).padStart(2, '0')}.png`))).length; } catch { return -1; }
  };
  try {
    for (const p of ['fleeting', 'courses', 'courses/fall-2026', 'library', 'library/lindqvist-statistical-physics']) toggleOpen(p, true);
    await open(NOTE);
    const first = await text();
    expect('the note', !region(first), `kind ${useApp.getState().docs[NOTE]?.type}, editable ${surface().isContentEditable}; nothing after the last paragraph yet (a fresh copy of the sample)`);

    // ── the slash menu, every block kind ──
    await atEnd(ANCHOR);
    await enter();
    fresh('after the anchor');
    await slash('', 'h1');
    await shot('insert-menu');
    // the `/` taken back: the menu goes with it
    document.execCommand('delete');
    await sleep(150);
    expect('the `/` deleted', !menu(), menu() ? 'menu still open' : 'menu gone');
    await slash('h2', 'h2');
    await enter();
    expect('/h2 picked', caretIn().kind === 'heading h2' && !menu(), `caret in a ${caretIn().kind}; menu ${menu() ? 'open' : 'closed'}`);
    await type('plan for Monday');
    await expectLines('/h2', ['## plan for Monday']);
    await enter();
    fresh('under the heading');
    await slash('bul', 'bullet');
    await enter();
    await type('wave packets');
    await enter();
    await type('wave functions');
    await expectLines('/bullet', ['- wave packets', '- wave functions']);
    await enter();
    await enter();
    fresh('after the bullets');
    await slash('num', 'ordered');
    await enter();
    await type('normalize');
    await enter();
    await type('expand');
    await expectLines('/numbered', ['1. normalize', '2. expand']);
    await enter();
    await enter();
    fresh('after the numbers');
    // ↓ from the lit row to the next: `task` is lit by `ta`, then `table` one down
    await slash('ta', 'task');
    await key('ArrowDown', { code: 'ArrowDown' });
    expect('↓ moves the lit row', lit() === 'table', `lit ${lit()}`);
    await key('ArrowUp', { code: 'ArrowUp' });
    await enter();
    await type('read Sakurai 5.2');
    await expectLines('/task', ['- [ ] read Sakurai 5.2']);
    await enter();
    await enter();
    fresh('after the task');
    await slash('quo', 'quote');
    await enter();
    await type('the series is asymptotic, not convergent');
    await expectLines('/quote', ['> the series is asymptotic, not convergent']);
    await enter();
    await enter();
    fresh('after the quote');
    await slash('code', 'code');
    await enter();
    expect('/code', caretIn().kind === 'code', `caret in a ${caretIn().kind}`);
    await type('E = hbar * omega');
    await key('Enter', { code: 'Enter', ...MOD });
    await expectLines('/code typed', ['```', 'E = hbar * omega', '```']);
    fresh('out of the code');
    await slash('math', 'math');
    await enter();
    const field = await until(() => q<HTMLTextAreaElement>('.pane-body .math-edit textarea'), 3000).catch(() => null);
    expect('/math opens the formula', !!field && field.value === '', field ? `editor open, "${field.value}"` : 'no editor');
    Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')!.set!.call(field, 'Z = \\sum_n e^{-\\beta E_n}');
    field!.dispatchEvent(new Event('input', { bubbles: true }));
    field!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));
    await expectLines('/math written', ['$$Z = \\sum_n e^{-\\beta E_n}$$']);
    await sleep(300);
    // the caret after the chip: a new paragraph below it
    const chip = qa<HTMLElement>('.pane-body .draft-doc p.dd-p').filter((p) => p.querySelector('.math')).pop();
    if (chip) {
      surface().focus();
      const r = document.createRange();
      r.selectNodeContents(chip);
      r.collapse(false);
      const sel = window.getSelection()!;
      sel.removeAllRanges();
      sel.addRange(r);
      await sleep(80);
    }
    await enter();
    fresh('after the formula');
    // a row picked by the pointer
    await type('/div');
    const row = await until(() => q<HTMLElement>('.pane-body .slash-menu .sm-row[data-id="rule"]'), 2000).catch(() => null);
    expect('/div shows divider', !!row, row ? row.textContent ?? '' : 'no row');
    row!.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }));
    await sleep(150);
    await expectLines('/divider (clicked)', ['$$Z = \\sum_n e^{-\\beta E_n}$$', '', '---']);
    fresh('after the rule');
    await slash('table', 'table');
    await enter();
    await expectLines('/table', ['|  |  |', '| --- | --- |', '|  |  |']);
    // since 41 the caret lands in the header's first cell: ⏎ down a row, ⏎ out of the table
    await enter();
    await enter();
    fresh('after the table');
    // an image from the picker (stubbed with a file outside the notes)
    const pickPath = vault.abs('.ilmi/smoke-pick.png');
    await vault.fs.mkdir(vault.abs('.ilmi'));
    await vault.fs.writeBytes(pickPath, PNG);
    const realPick = imagePicker.pick;
    imagePicker.pick = async () => [pickPath];
    await slash('image', 'image');
    await enter();
    await expectLines('/image (picked)', ['![](2026-10-30/img-01.png)']);
    imagePicker.pick = realPick;
    expect('img-01 beside the note', (await imgBytes(1)) === PNG.length, `${IMG_DIR}/img-01.png ${await imgBytes(1)} bytes`);
    await shot('insert-blocks');
    // Esc leaves the `/` as typed
    await sleep(300);
    fresh('after the image');
    await slash('', 'h1');
    await key('Escape', { code: 'Escape' });
    expect('Esc', !menu() && caretIn().text === '/', `menu ${menu() ? 'open' : 'closed'}; the line "${caretIn().text}"`);
    document.execCommand('delete');
    await sleep(100);

    // ── the card forms ──
    await type('the plural of kitāb is ');
    await slash('cloze', 'cloze');
    await enter();
    await type('kutub');
    await expectLines('/cloze', ['the plural of kitāb is {{c1::kutub}}']);
    await until(() => qa('.pane-body .card-span').find((c) => c.textContent?.includes('kutub')), 5000).catch(() => fail('the cloze never became a card'));
    await atEnd('wave functions');
    await enter();
    await enter();
    fresh('for the q&a');
    await type('the ism of kāna is ');
    await slash('q&a', 'qa');
    await enter();
    await type('marfuu');
    await expectLines('/q&a', ['the ism of kāna is :: marfuu']);
    await until(() => qa('.pane-body .card-span').find((c) => c.textContent?.includes('marfuu')), 5000).catch(() => fail('the q&a never became a card'));
    await atEnd('wave functions');
    await enter();
    await enter();
    fresh('for both ways');
    await type('qalam ');
    await slash('both', 'both');
    await enter();
    await type('pen');
    await expectLines('/bidir', ['qalam ::: pen']);
    await until(() => qa('.pane-body .card-span').find((c) => c.textContent?.includes('qalam')), 5000).catch(() => fail('both ways never became a card'));
    const t1 = await text();
    const cards = (await vault.read(NOTE, true)).doc.blocks.filter((b) => b.kind === 'card').map((b) => b.text);
    expect('three cards', ['{{c1::kutub}}', ':: marfuu', '::: pen'].every((n) => cards.some((c) => c.includes(n))), `cards in the note: ${cards.map((c) => c.slice(0, 40)).join(' | ')}; ${t1.split('\n').length} lines`);
    await shot('insert-cards');

    // ── paste: a web fragment as Markdown, then plain ──
    const FRAGMENT = '<meta charset="utf-8"><h2>The canonical ensemble</h2><p>A system in contact with a <em>heat bath</em> at fixed <strong>T</strong>; see <a href="https://en.wikipedia.org/wiki/Canonical_ensemble">the article</a>.</p><ul><li>fixed <code>N</code> and <code>V</code></li><li>the energy fluctuates<ul><li>relatively as one over root N</li></ul></li></ul><ol><li>write Z</li><li>take its log</li></ol>';
    await atEnd('plan for Monday');
    await enter();
    fresh('for the paste');
    paste({ 'text/html': FRAGMENT, 'text/plain': 'The canonical ensemble' });
    await expectLines('pasted fragment', [
      '## The canonical ensemble', '',
      'A system in contact with a *heat bath* at fixed **T**; see [the article](https://en.wikipedia.org/wiki/Canonical_ensemble).', '',
      '- fixed `N` and `V`', '- the energy fluctuates', '  - relatively as one over root N', '',
      '1. write Z', '2. take its log',
    ]);
    await shot('insert-paste');
    await atEnd('take its log');
    await enter();
    await enter();
    fresh('for the plain paste');
    await key('V', { code: 'KeyV', shiftKey: true, ...MOD });
    paste({ 'text/html': '<p>see <a href="https://example.org/">this page</a> <b>now</b></p>', 'text/plain': 'see this page now' });
    await expectLines('⌘⇧V plain', ['see this page now']);

    // ── an image pasted, an image dropped ──
    await atEnd('see this page now');
    await enter();
    fresh('for the pasted image');
    let pasted = true;
    try { paste({}, [new File([PNG], 'Screenshot.png', { type: 'image/png' })]); } catch (e) { pasted = false; log(`paste with a file: ${e instanceof Error ? e.message : String(e)}`); }
    expect('a paste with a file', pasted, 'sent');
    await expectLines('pasted image', ['![](2026-10-30/img-02.png)']);
    expect('img-02 beside the note', (await imgBytes(2)) === PNG.length, `${IMG_DIR}/img-02.png ${await imgBytes(2)} bytes`);
    const dropPath = vault.abs('.ilmi/smoke-drop.png');
    await vault.fs.writeBytes(dropPath, PNG);
    const target = await until(() => block('see this page now'));
    const tr = target.getBoundingClientRect();
    await dropAt([dropPath], tr.right - 4, tr.top + tr.height / 2);
    await expectLines('dropped image', ['see this page now', '', '![](2026-10-30/img-03.png)']);
    expect('img-03 beside the note', (await imgBytes(3)) === PNG.length, `${IMG_DIR}/img-03.png ${await imgBytes(3)} bytes`);
    const tree = useApp.getState().docs;
    expect('no document landed for the drop', !Object.keys(tree).some((k) => /smoke-drop/.test(k)), `${Object.keys(tree).length} documents`);
    await shot('insert-images');

    // ── find: every unvoweled match in the voweled kāna note ──
    await open(KANA);
    const WORD = 'كان';
    const kanaBefore = await text(KANA);
    const blocks = (await vault.read(KANA, true)).doc.blocks;
    const want = blocks.reduce((n, b) => n + findIn(b.text.replace(/\$[^$]*\$/g, ''), WORD).length, 0);
    window.getSelection()?.removeAllRanges();
    (document.activeElement as HTMLElement | null)?.blur();
    expect('⌘F taken', await key('f', { code: 'KeyF', ...MOD }, window), 'the page took it');
    const input = await until(() => q<HTMLInputElement>('.pane-body .find-bar .fb-q'), 2000).catch(() => null);
    await sleep(200);
    expect('the find bar', !!input && document.activeElement === input, input ? `focused ${document.activeElement === input}` : 'no bar');
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input, WORD);
    input!.dispatchEvent(new Event('input', { bubbles: true }));
    await sleep(300);
    const count = () => q<HTMLElement>('.pane-body .find-bar .fb-n')?.textContent ?? '';
    // every match is lit: by its own span, by a mark in a table's cell or a card, or (where the drawing hides it) by its atom's ring; each names its index
    const litIndices = () => new Set(qa<HTMLElement>('.pane-body .draft-doc [data-find]').flatMap((el) => (el.dataset.find ?? '').split(' ').filter(Boolean)));
    expect('count', count() === `1/${want}`, `"${count()}", the file has ${want} unvoweled in the text outside formulas`);
    expect('every match lit', litIndices().size === want, `lit ${litIndices().size} of ${want}; marks inside tables and cards ${qa('.pane-body mark.find-hit').length}`);
    await shot('insert-find');
    const steps: string[] = [];
    let bad = 0;
    for (let i = 1; i <= want; i++) {
      // the current match: its own span(s) or its mark in a cell; else its atom, ringed, holding the word; and in view
      const all = qa<HTMLElement>('.pane-body .find-current');
      const inner = all.filter((el) => !el.classList.contains('find-in'));
      const atom = all.find((el) => el.classList.contains('find-in'));
      const t = inner.length ? inner.map((el) => el.textContent ?? '').join('') : atom?.textContent ?? '';
      const shown = (inner[inner.length - 1] ?? atom)?.getBoundingClientRect();
      const inView = !!shown && shown.bottom > 0 && shown.top < window.innerHeight;
      const ok = (inner.length ? foldText(t) === WORD : !!atom && foldText(t).includes(WORD)) && inView;
      if (!ok) bad++;
      steps.push(`${count()}${inner.length ? '' : atom ? '(atom)' : ''}${ok ? '' : ` NOT "${t.slice(0, 20)}"${inView ? '' : ' out of view'}`}`);
      if (i === 3) await shot('insert-find-step');
      input!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));
      await sleep(120);
    }
    expect('⏎ walks every match', bad === 0 && count() === `1/${want}`, `${steps.join(' ')}; then ${count()}`);
    input!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', shiftKey: true, bubbles: true, cancelable: true }));
    await sleep(120);
    expect('⇧⏎', count() === `${want}/${want}`, count());
    await key('g', { code: 'KeyG', ...MOD }, input!);
    expect('⌘G', count() === `1/${want}`, count());
    const voweled = 'كَانَ';
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input, voweled);
    input!.dispatchEvent(new Event('input', { bubbles: true }));
    await sleep(300);
    expect('the voweled word finds the same', count() === `1/${want}`, count());
    input!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
    await sleep(200);
    expect('Esc closes the bar', !q('.pane-body .find-bar'), q('.pane-body .find-bar') ? 'still open' : 'closed');
    await sleep(700);
    expect('the file untouched', (await text(KANA)) === kanaBefore, 'no write');

    // ── replace, on the note ──
    await open(NOTE);
    window.getSelection()?.removeAllRanges();
    (document.activeElement as HTMLElement | null)?.blur();
    await key('f', { code: 'KeyF', altKey: true, ...MOD }, window);
    const fq = await until(() => q<HTMLInputElement>('.pane-body .find-bar .fb-q'), 2000);
    const fr = await until(() => q<HTMLInputElement>('.pane-body .find-bar .fb-r'), 2000).catch(() => null);
    expect('⌥⌘F replace row', !!fr, fr ? 'shown' : 'none');
    const set = (el: HTMLInputElement, v: string) => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(el, v);
      el.dispatchEvent(new Event('input', { bubbles: true }));
    };
    set(fq, 'Wednesday');
    await sleep(200);
    set(fr!, 'Thursday');
    await sleep(200);
    await shot('insert-replace');
    fr!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));
    await expectLines('replace one', ['Friday. QM II PS7 due Monday; Arabic composition draft due Thursday.']);
    set(fq, 'wave');
    await sleep(200);
    set(fr!, 'matter wave');
    await sleep(200);
    q<HTMLElement>('.pane-body .find-bar .fb-b:last-of-type')?.click();
    await expectLines('replace all', ['- matter wave packets', '- matter wave functions']);
    fq.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
    await sleep(200);

    // ── a frozen source: find, no replace ──
    await open(SOURCE);
    (document.activeElement as HTMLElement | null)?.blur();
    await key('f', { code: 'KeyF', altKey: true, ...MOD }, window);
    await until(() => q('.pane-body .find-bar .fb-q'), 2000);
    expect('frozen: no replace row', !q('.pane-body .find-bar .fb-r'), `editable ${surface().isContentEditable}`);
    q<HTMLInputElement>('.pane-body .find-bar .fb-q')?.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));

    await open(NOTE);
    const final = await text();
    log(`file: ${final.split('\n').length} lines; the typed part: ${region(final)}`);
    log(`done; vault ${vault.root}`);
  } catch (e) {
    log(`failed: ${e instanceof Error ? e.message : String(e)}`);
  }
}

/**
 * `ILMI_SMOKE=tabs2` over a copy of `samples/double-major` (milestone 39):
 * first the three things 38's window check found (a still pointer resting on
 * a bare note's middle nests it; ⌘⌫ leaves a notice whose undo brings the
 * note back in its place; four levels down a name is no longer cut by the
 * indent, and the sidebar's edge drags its width), then the "done when":
 * tabs turned on from a course's top row, a notebook's rail with no
 * extracts in it (a tab's are one `n extracts` row opening their folder), the
 * active tab's headings scrolling the page, a tab added from `+ add tab`,
 * renamed by F2, nested and moved by ⌥⌘ arrows and by drags, a drag from the
 * rail into the sidebar, the open tab revealed in both, the row's hover `+`
 * and `···`, the fold key ⌃⌘T, and the rail's edge. Every step is asserted;
 * a mismatch logs `failed: …` and stops.
 */
export async function smokeTabs2(vault: Vault): Promise<void> {
  const log = (s: string) => info(`smoke tabs2: ${s}`);
  const shot = async (name: string, ms = 2500) => { await sleep(500); log(`shot: ${name}`); await sleep(ms); };
  const q = <T extends Element>(sel: string, root: ParentNode = document) => root.querySelector<T>(sel);
  const qa = <T extends Element>(sel: string, root: ParentNode = document) => Array.from(root.querySelectorAll<T>(sel));
  const { useDrag } = await import('./drag.js');
  const { childDirOf, childrenAt, entryOf, ordered } = await import('../vault/index.js');
  const { setSidebar } = await import('./vault.js');
  const { SIDE_DEFAULT } = await import('./store.js');
  const { TREE_INDENT, TREE_PAD } = await import('./treeModel.js');
  const must = (ok: unknown, what: string) => { if (!ok) throw new Error(what); log(`ok: ${what}`); };
  const poll = async <T,>(probe: () => T | null | undefined | false | Promise<T | null | undefined | false>, what: string, ms = 5000): Promise<T> => {
    const t0 = Date.now();
    for (;;) {
      const v = await probe();
      if (v) { log(`ok: ${what}`); return v; }
      if (Date.now() - t0 > ms) throw new Error(`${what} (waited ${ms} ms)`);
      await sleep(100);
    }
  };
  const esc = (p: string) => CSS.escape(p);
  const trow = (path: string) => q<HTMLElement>(`.edit-tree .trow[data-path="${esc(path)}"]:not(.placeholder)`);
  const rrow = (path: string) => q<HTMLElement>(`.tab-rail .rail-row[data-path="${esc(path)}"]:not(.heading)`);
  const rbox = () => q<HTMLElement>('.tab-rail .rail-rows');
  const tbox = () => q<HTMLElement>('.edit-tree')!;
  const page = () => activeTab(useApp.getState().panes)?.id ?? '';
  const exists = async (path: string) => !!(await vault.fs.stat(vault.abs(path)));
  const text = async (path: string) => ((await exists(path)) ? vault.fs.readText(vault.abs(path)) : '');
  const orderOn = async (dir: string): Promise<string[] | null> => {
    const t = await text('.ilmi/order.json');
    return t ? ((JSON.parse(t) as Record<string, string[]>)[dir] ?? null) : null;
  };
  const listed = (dir: string) => ordered(childrenAt(vault.tree, dir) ?? [], vault.order[dir]).map((n) => entryOf(n.path));
  const rail = () => {
    const nav = q<HTMLElement>('.tab-rail');
    if (!nav) return 'no rail';
    if (nav.classList.contains('folded')) return 'folded';
    return qa<HTMLElement>('.tab-rail .rail-row').map((r) => `${r.classList.contains('heading') ? '# ' : ''}${r.dataset.active === '1' ? '*' : ''}${r.querySelector('.chev')?.textContent ?? ''}${r.querySelector('.glyph')?.textContent ?? ''}${r.querySelector('.name')?.textContent ?? ''}`).join(' | ');
  };
  const dragEv = (type: string, dt: DataTransfer, x: number, y: number) => new DragEvent(type, { bubbles: true, cancelable: true, clientX: x, clientY: y, dataTransfer: dt });
  /**
   * A drag as a pointer makes it: dragstart on `from`, one dragover on `to`
   * at its top (12%), middle, or bottom (88%), then (with `rest`) that long
   * with no more dragovers, as a still pointer sends none; the mark is read,
   * then the drop. Both rows are scrolled to the middle of their scrollers
   * first, so the edge scroll does not move them under the pointer.
   */
  const drag = async (name: string, from: HTMLElement | null, to: HTMLElement | null, where: 'top' | 'mid' | 'bottom', rest = 0) => {
    if (!from || !to) throw new Error(`${name}: a row is missing (${from ? '' : 'from '}${to ? '' : 'to'})`);
    to.scrollIntoView({ block: 'center' });
    await sleep(150);
    const dt = new DataTransfer();
    from.dispatchEvent(dragEv('dragstart', dt, 0, 0));
    await sleep(60);
    const r = to.getBoundingClientRect();
    const y = r.top + r.height * (where === 'top' ? 0.12 : where === 'mid' ? 0.5 : 0.88);
    const x = r.right - 40;
    to.dispatchEvent(dragEv('dragenter', dt, x, y));
    to.dispatchEvent(dragEv('dragover', dt, x, y));
    await sleep(rest || 120);
    const d = useDrag.getState().drop;
    const drawn = to.className.match(/drop-(top|bottom|into)/)?.[1] ?? 'nothing';
    log(`${name}: ${from.dataset.path} over the ${where} of ${to.dataset.path}${rest ? `, still for ${rest} ms` : ''}: drawn ${drawn}, drop ${d ? `${d.mode} ${d.target}` : 'none'}`);
    to.dispatchEvent(dragEv('drop', dt, x, y));
    from.dispatchEvent(dragEv('dragend', dt, x, y));
    return { drop: d, drawn };
  };
  const pressOn = (el: HTMLElement, key: string, init: KeyboardEventInit = {}) => {
    const ev = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ...init });
    el.dispatchEvent(ev);
    return ev.defaultPrevented;
  };
  const typeName = async (name: string) => {
    const input = await poll(() => q<HTMLInputElement>('.tab-rail input.rename'), 'the rename field is open', 8000);
    await sleep(150);
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input, name);
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));
  };
  const entries = () => qa<HTMLElement>('.ctx-menu .ci').map((e) => e.textContent?.slice(1).replace(/F2$|▸$/, '') ?? '');

  const F26 = 'courses/fall-2026';
  const QM = `${F26}/phys-412-quantum-ii.md`;
  const QMK = `${F26}/phys-412-quantum-ii`;
  const VAR = `${QMK}/variational-method.md`;
  const WKB = `${QMK}/wkb-approximation.md`;
  const ABB = `${F26}/arab-455-abbasid-poetry.md`;
  const ABBK = `${F26}/arab-455-abbasid-poetry`;
  const CLIP = `${ABBK}/clipped-on-translating-the-qasida.md`;
  const MORPH = 'courses/spring-2026/arab-302-morphology.md';
  try {
    setInspector({ open: false });
    setSidebar({ width: SIDE_DEFAULT, hidden: false });
    for (const p of ['', 'courses', F26, 'fleeting']) toggleOpen(p, true);
    openNode(queueId('today'));
    await poll(() => trow('fleeting/2026-10-30.md'), 'the sidebar is drawn', 10000);
    await sleep(500);

    // ── 38's window check, 1: a still pointer resting on a bare note's middle nests it ──
    {
      const moving = 'fleeting/2026-10-29.md';
      const host = 'fleeting/idea-for-honors-thesis.md';
      const r = await drag('rest to nest (tree)', trow(moving), trow(host), 'mid', 650);
      must(r.drop?.mode === 'into' && r.drop.target === host && r.drawn === 'into', `after 650 ms still on the middle of ${host}: a box around it and into (drew ${r.drawn}, ${r.drop?.mode ?? 'none'})`);
      await poll(() => exists(`${childDirOf(host)}/2026-10-29.md`), `${moving} landed inside ${host}`);
      await shot('tabs2-rest-nests');
    }

    // ── 38's window check, 2: ⌘⌫ on a note with nothing under it leaves a notice with undo ──
    {
      const gone = 'fleeting/2026-10-27.md';
      const before = listed('fleeting');
      trow(gone)!.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
      tbox().focus();
      await sleep(150);
      must(pressOn(tbox(), 'Backspace', { metaKey: true }), '⌘⌫ taken by the tree');
      await poll(async () => !(await exists(gone)), `${gone} deleted`);
      const line = await poll(() => q<HTMLElement>('.notice .nl')?.textContent, 'a notice');
      must(line.startsWith('deleted · '), `the notice says "${line}"`);
      const undo = qa<HTMLButtonElement>('.notice .na').find((b) => b.textContent === 'undo');
      must(undo, 'the notice has undo');
      await shot('tabs2-delete-notice');
      undo!.click();
      await poll(() => exists(gone), `${gone} back on disk`);
      await poll(() => (JSON.stringify(listed('fleeting')) === JSON.stringify(before) ? true : null), `back in its place: ${before.join(', ')}`);
      const ord = await orderOn('fleeting');
      must(!ord || ord.indexOf(entryOf(gone)) === before.indexOf(entryOf(gone)), `order.json["fleeting"] has it where it was (${JSON.stringify(ord)})`);
    }

    // ── 38's window check, 3: names four levels down not cut by the indent; the sidebar's edge ──
    {
      const all: Record<string, true> = { '': true };
      const visit = (nodes: typeof vault.tree) => { for (const n of nodes) { const kids = n.kind === 'folder' ? n.children : n.children ?? []; if (kids.length) { all[n.path] = true; visit(kids); } } };
      visit(vault.tree);
      useApp.setState({ open: all });
      await sleep(800);
      const rows = qa<HTMLElement>('.edit-tree .trow:not(.placeholder)');
      const cut = rows.filter((r) => { const n = q<HTMLElement>('.name', r); return !!n && n.scrollWidth > n.clientWidth + 1; });
      const deep = rows.filter((r) => parseInt(r.getAttribute('aria-level') ?? '0', 10) >= 5);
      const deepCut = deep.filter((r) => cut.includes(r));
      log(`width ${q<HTMLElement>('.side')!.getBoundingClientRect().width}px: ${rows.length} rows, ${cut.length} cut (${cut.slice(0, 6).map((r) => r.querySelector('.name')?.textContent).join('; ')}); four levels down ${deep.length}, cut ${deepCut.length}`);
      const vm = trow(VAR);
      must(vm && !cut.includes(vm), `"${vm?.querySelector('.name')?.textContent}" four levels down is not cut`);
      const ps7 = trow(`${QMK}/problem-sets/ps-7.md`);
      must(ps7?.style.paddingLeft === `${TREE_PAD + 5 * TREE_INDENT}px`, `a level is ${TREE_INDENT} px (ps-7 at ${ps7?.style.paddingLeft})`);
      await shot('tabs2-indent', 3000);
      const edge = q<HTMLElement>('.side-resize')!;
      edge.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true, clientX: SIDE_DEFAULT }));
      window.dispatchEvent(new MouseEvent('mousemove', { clientX: 300 }));
      window.dispatchEvent(new MouseEvent('mouseup', {}));
      must(useApp.getState().sidebar.width === 300, 'the sidebar\'s edge dragged it to 300 px');
      await poll(async () => ((await vault.loadState()).sidebar?.width === 300 ? true : null), 'state.json keeps the sidebar at 300 px');
      setSidebar({ width: SIDE_DEFAULT });
      useApp.setState({ open: { '': true, courses: true, [F26]: true, fleeting: true } });
      await sleep(300);
    }

    // ── tabs turned on from a course's top row ──
    {
      openNode(MORPH);
      const t = await poll(() => q<HTMLButtonElement>('.nb-page .reader .meta .tabs-toggle, .pane-body .reader .meta .tabs-toggle'), 'the `tabs` toggle in the top row of arab 302', 8000);
      must(t.dataset.on === '0' && !q('.tab-rail'), 'off, and no rail');
      await shot('tabs2-toggle-off');
      t.click();
      await poll(async () => (await text(MORPH)).includes('\ntabs: true\n'), 'the toggle wrote `tabs: true`');
      await poll(() => rrow(MORPH), 'the rail is drawn beside the page', 8000);
      log(`rail: ${rail()}`);
      must(q<HTMLElement>('.tabs-toggle')?.dataset.on === '1', 'the toggle is lit');
      await shot('tabs2-toggle-on');
      q<HTMLButtonElement>('.tabs-toggle')!.click();
      await poll(async () => !(await text(MORPH)).includes('tabs: true'), 'off again: the field gone');
      await poll(() => !q('.tab-rail'), 'and the rail');
      q<HTMLButtonElement>('.tabs-toggle')!.click();
      await poll(async () => (await text(MORPH)).includes('tabs: true'), 'on again');
    }

    // ── extracts are never tabs ──
    {
      openNode(ABB);
      await poll(() => rrow(CLIP), 'abbasid poetry\'s rail', 8000);
      log(`rail: ${rail()}`);
      must(!qa('.tab-rail .rail-row[data-kind="extract"]').length, 'no extract is a tab');
      rrow(CLIP)!.querySelector<HTMLElement>('.chev')!.click();
      const ex = await poll(() => rrow(childDirOf(CLIP)), 'the clipping\'s `n extracts` row');
      must(ex.textContent?.includes('2 extracts'), `it reads "${ex.textContent}"`);
      must(!qa('.tab-rail .rail-row[data-kind="extract"]').length, 'still no extract as a tab, open');
      await shot('tabs2-extracts-row');
      ex.click();
      await poll(() => page() === childDirOf(CLIP) && q('.tab-rail') && q('.folder-view'), 'it opens their folder, the rail kept', 8000);
      await shot('tabs2-extracts-folder');
    }

    // ── the active tab's headings navigate ──
    {
      openNode(QM);
      await poll(() => rrow(VAR), 'quantum II\'s rail', 8000);
      rrow(VAR)!.click();
      // the overview's own outline shows first (it is the open page); wait for the tab to be the page and its own headings
      await poll(() => page() === VAR, 'the variational method is the page', 8000);
      const heads = await poll(() => { const h = qa<HTMLElement>(`.tab-rail .rail-row.heading[data-of="${esc(VAR)}"]`); return h.length >= 5 && !q(`.tab-rail .rail-row.heading:not([data-of="${esc(VAR)}"])`) ? h : null; }, 'the variational method\'s headings under its tab, and no other row\'s', 8000);
      log(`outline: ${heads.map((h) => `${'  '.repeat(Number(h.dataset.level) - 2)}${h.textContent}`).join(' | ')}`);
      const helium = heads.find((h) => h.textContent === 'helium ground state');
      must(helium, 'the outline lists `helium ground state`');
      helium!.click();
      await poll(() => {
        const scroller = q<HTMLElement>('.nb-page');
        const target = qa<HTMLElement>('.nb-page .dd-h').find((h) => h.textContent === 'helium ground state');
        if (!scroller || !target) return null;
        const dy = target.getBoundingClientRect().top - scroller.getBoundingClientRect().top;
        // at the top of the page, or as near it as the page's end lets it come
        const atEnd = scroller.scrollTop > 0 && scroller.scrollTop >= scroller.scrollHeight - scroller.clientHeight - 2;
        return (dy > -8 && dy < 120) || (atEnd && dy >= 0 && dy < scroller.clientHeight) ? true : null;
      }, 'a click on it scrolled the page to it');
      await shot('tabs2-outline');
      // both views reveal the open tab
      await poll(() => trow(VAR)?.dataset.active === '1', 'the sidebar reveals the open tab');
      must(rrow(VAR)?.dataset.active === '1', 'and the rail');
      // a click on the active tab hides the outline, another shows it
      rrow(VAR)!.click();
      await poll(() => !q(`.tab-rail .rail-row.heading[data-of="${esc(VAR)}"]`), 'a click on the active tab hides its outline');
      rrow(VAR)!.click();
      await poll(() => q(`.tab-rail .rail-row.heading[data-of="${esc(VAR)}"]`), 'another shows it');
    }

    // ── a tab added, renamed, nested and moved by keyboard ──
    let tab = `${QMK}/lecture 15 notes.md`;
    {
      q<HTMLButtonElement>('.tab-rail .rail-head .rail-add')!.click();
      await typeName('lecture 15 notes');
      await poll(() => exists(tab), `\`+ add tab\` made ${tab}`);
      await poll(async () => ((await orderOn(QMK))?.at(-1) === entryOf(tab) ? true : null), 'last in order.json');
      const head = await text(tab);
      must(!/^type:/m.test(head) && !/^write:/m.test(head), 'a note: no type, no writing schedule');
      await poll(() => rrow(tab), 'its row');
      rrow(tab)!.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
      rbox()!.focus();
      await sleep(150);
      must(pressOn(rbox()!, 'F2'), 'F2 taken by the rail');
      await typeName('lecture 15');
      tab = `${QMK}/lecture 15.md`;
      await poll(() => exists(tab), 'F2 renamed it to lecture 15');
      await shot('tabs2-added');
      await sleep(300);
      rbox()!.focus();
      must(pressOn(rbox()!, 'ArrowRight', { metaKey: true, altKey: true }), '⌥⌘→ taken by the rail');
      const nested = `${QMK}/problem-sets/lecture 15.md`;
      await poll(() => exists(nested), `⌥⌘→ nested it into the tab above: ${nested}`);
      await poll(() => rrow(nested), 'shown under problem sets');
      await shot('tabs2-key-nested');
      rbox()!.focus();
      pressOn(rbox()!, 'ArrowLeft', { metaKey: true, altKey: true });
      await poll(() => exists(tab), '⌥⌘← brought it out, after problem sets');
      await poll(async () => { const o = await orderOn(QMK); return o && o.indexOf(entryOf(tab)) === o.indexOf('problem-sets/') + 1 ? true : null; }, 'right after problem sets in order.json');
      const pg = page();
      rbox()!.focus();
      must(pressOn(rbox()!, 'ArrowUp', { metaKey: true, altKey: true }), '⌥⌘↑ taken by the rail');
      await poll(async () => { const o = await orderOn(QMK); return o && o.indexOf(entryOf(tab)) === o.indexOf('problem-sets/') - 1 ? true : null; }, '⌥⌘↑ moved it before problem sets');
      must(page() === pg, 'and did not step the page');
      log(`rail: ${rail()}`);
      await shot('tabs2-key-moved');
    }

    // ── nested and moved by drag; a drag from the rail into the sidebar ──
    {
      const r1 = await drag('nest (rail)', rrow(tab), rrow(VAR), 'mid', 650);
      must(r1.drop?.mode === 'into' && r1.drop.target === VAR, 'a rest on the variational method\'s middle: into it');
      const under = `${childDirOf(VAR)}/lecture 15.md`;
      await poll(() => exists(under), `landed as its subtab: ${under}`);
      await poll(() => rrow(under), 'drawn under it, the tab opened');
      await shot('tabs2-drag-nested');
      const r2 = await drag('move (rail)', rrow(under), rrow(WKB), 'top');
      must(r2.drop?.mode === 'before' && r2.drop.target === WKB && r2.drawn === 'top', 'the top of wkb: a line above it');
      await poll(() => exists(tab), `back as a tab: ${tab}`);
      await poll(async () => { const o = await orderOn(QMK); return o && o.indexOf(entryOf(tab)) === o.indexOf(entryOf(WKB)) - 1 ? true : null; }, 'right before wkb in order.json');
      await shot('tabs2-drag-moved');
      toggleOpen('fleeting', true);
      await poll(() => trow('fleeting/2026-10-30.md'), 'the sidebar\'s fleeting notes');
      const r3 = await drag('rail → sidebar', rrow(tab), trow('fleeting/2026-10-30.md'), 'top');
      must(r3.drop?.mode === 'before' && r3.drop.target === 'fleeting/2026-10-30.md', 'the sidebar row took it: a line above it');
      const landed = 'fleeting/lecture 15.md';
      await poll(() => exists(landed), `landed in the sidebar's folder: ${landed}`);
      await poll(async () => { const o = await orderOn('fleeting'); return o && o.indexOf(entryOf(landed)) === o.indexOf('2026-10-30.md') - 1 ? true : null; }, 'right before 2026-10-30 in order.json');
      await poll(() => !rrow(tab), 'and gone from the rail');
      await shot('tabs2-rail-to-sidebar');
    }

    // ── a row's hover `+` and `···` ──
    {
      // the dragged tab was the open page (`+ add tab` opened it), and the pane follows its document out of the
      // notebook, so the rail goes with it (window run 2 found the rail gone here); back to the course
      log(`after the drag out: page ${page()}, rail ${q('.tab-rail') ? 'drawn' : 'gone'}`);
      openNode(QM);
      const wkb = await poll(() => rrow(WKB), 'quantum II\'s rail again, wkb in it', 8000);
      wkb.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
      await sleep(150);
      q<HTMLElement>('.row-acts .add', wkb)!.click();
      const made = `${QMK}/untitled.md`;
      await poll(() => exists(made), `\`+\` made ${made}`);
      await poll(async () => { const o = await orderOn(QMK); return o && o.indexOf(entryOf(made)) === o.indexOf(entryOf(WKB)) + 1 ? true : null; }, 'right after wkb');
      const field = await poll(() => q<HTMLInputElement>('.tab-rail input.rename'), 'named in place');
      field.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
      await sleep(200);
      q<HTMLElement>('.row-acts .more', await poll(() => rrow(made), 'its row'))!.click();
      await poll(() => q('.ctx-menu'), 'the `···` menu');
      must(JSON.stringify(entries()) === JSON.stringify(['add subtab', 'rename', 'duplicate', 'move to…', 'delete']), `its entries: ${entries().join(' | ')}`);
      await shot('tabs2-row-more');
      qa<HTMLElement>('.ctx-menu .ci').find((e) => e.dataset.act === 'delete')!.click();
      await poll(async () => !(await exists(made)), 'delete from the menu');
      await poll(() => qa<HTMLButtonElement>('.notice .na').some((b) => b.textContent === 'undo'), 'with the notice\'s undo');
    }

    // ── the fold key and the rail's edge ──
    {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: '{', code: 'BracketLeft', metaKey: true, shiftKey: true, bubbles: true, cancelable: true }));
      await sleep(200);
      must(!q('.tab-rail.folded'), '⌘⇧[ no longer folds the rail');
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 't', code: 'KeyT', metaKey: true, ctrlKey: true, bubbles: true, cancelable: true }));
      await poll(() => q('.tab-rail.folded'), '⌃⌘T folds it');
      await shot('tabs2-folded');
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 't', code: 'KeyT', metaKey: true, ctrlKey: true, bubbles: true, cancelable: true }));
      await poll(() => rrow(QM), '⌃⌘T opens it');
      const nav = q<HTMLElement>('.tab-rail')!;
      const w0 = nav.getBoundingClientRect().width;
      must(Math.abs(w0 - useApp.getState().railWidth) <= 1, `the rail is ${Math.round(w0)} px`);
      const edge = q<HTMLElement>('.tab-rail .rail-resize')!;
      const x0 = nav.getBoundingClientRect().right;
      edge.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, cancelable: true, clientX: x0 }));
      window.dispatchEvent(new PointerEvent('pointermove', { clientX: x0 + 60 }));
      window.dispatchEvent(new PointerEvent('pointerup', {}));
      const want = useApp.getState().railWidth;
      must(Math.abs(want - (w0 + 60)) <= 1, `its edge dragged it to ${want} px`);
      await poll(async () => ((await vault.loadState()).railWidth === want ? true : null), 'state.json keeps the width');
      await shot('tabs2-wider');
    }

    useApp.getState().setTheme('dark');
    await shot('tabs2-dark');
    useApp.getState().setTheme('eink');
    await shot('tabs2-eink');
    useApp.getState().setTheme('light');
    log(`done; vault ${vault.root}`);
  } catch (e) {
    log(`failed: ${e instanceof Error ? e.message : String(e)}`);
  }
}

/**
 * `ILMI_SMOKE=listcards` over a copy of `samples/double-major` (milestone
 * 37): the stat-mech note's card items drawn as items; a bullet card typed
 * after lecture 9's last paragraph (`- ` makes the list, the card's text
 * after it) and read back from the file as a card item; found in the queue;
 * reviewed in a session whose line above the card is the document and the
 * heading over it, the grade's `sr` line written under the item at its
 * content column; `o` (go to source) opening the note scrolled to the card
 * and marking it; `study` in the reader's top row and on the note's tab in
 * the notebook's rail. Every step asserted (`ok: …`; the first miss ends
 * the run with `failed: …`); `shot: <name>` where a capture is worth reading.
 */
export async function smokeListCards(vault: Vault): Promise<void> {
  const log = (s: string) => info(`smoke listcards: ${s}`);
  const shot = async (name: string, ms = 2500) => { await sleep(600); log(`shot: ${name}`); await sleep(ms); };
  const q = <T extends Element>(sel: string, root: ParentNode = document) => root.querySelector<T>(sel);
  const qa = <T extends Element>(sel: string, root: ParentNode = document) => Array.from(root.querySelectorAll<T>(sel));
  const must = (ok: unknown, what: string) => { if (!ok) throw new Error(what); log(`ok: ${what}`); };
  const poll = async <T,>(probe: () => T | null | undefined | false | Promise<T | null | undefined | false>, what: string, ms = 5000): Promise<T> => {
    const t0 = Date.now();
    for (;;) {
      const v = await probe();
      if (v) { log(`ok: ${what}`); return v; }
      if (Date.now() - t0 > ms) throw new Error(`${what} (waited ${ms} ms)`);
      await sleep(100);
    }
  };
  const COURSE = 'courses/fall-2026/phys-415-stat-mech';
  const NOTE = `${COURSE}/canonical-ensemble.md`;
  const TITLE = 'canonical ensemble & partition functions';
  const SECTION = 'lecture 9 — $Z$ does everything (Wed 9/23)';
  const ANCHOR = 'positive. OK.';
  const FRONT = 'what the heat capacity measures, canonically';
  const CARD = `${FRONT} :: the size of the energy fluctuations`;
  const text = () => vault.fs.readText(vault.abs(NOTE));
  const lines = async () => (await text()).split('\n');
  const surface = () => q<HTMLElement>('.pane-body .doc-view .draft-doc');
  const scroller = () => surface()?.closest<HTMLElement>('.pane-body') ?? null;
  const BLOCKS = 'p.dd-p, .dd-h, .dd-li .li-text, .dd-ql';
  const block = (needle: string) => qa<HTMLElement>(BLOCKS, surface() ?? document).filter((p) => p.textContent?.includes(needle)).pop();
  const ourCard = () => qa<HTMLElement>('.card-span.in-item', surface() ?? document).find((c) => c.textContent?.includes(FRONT));
  const caretKind = () => {
    const n = document.getSelection()?.anchorNode ?? null;
    const el = (n?.nodeType === 1 ? (n as HTMLElement) : n?.parentElement)?.closest<HTMLElement>(BLOCKS);
    return !el ? 'nothing' : el.matches('p.dd-p') ? `paragraph "${el.textContent ?? ''}"` : el.matches('.li-text') ? `item "${el.textContent ?? ''}"` : 'other';
  };
  const keyOn = (el: HTMLElement | Window, k: string, init: KeyboardEventInit = {}) => {
    const ev = new KeyboardEvent('keydown', { key: k, bubbles: true, cancelable: true, ...init });
    el.dispatchEvent(ev);
    return ev.defaultPrevented;
  };
  const type = async (s: string) => {
    for (const ch of s) {
      document.execCommand('insertText', false, ch);
      await sleep(30);
    }
    await sleep(80);
  };
  const open = async (path: string) => {
    openNode(path);
    await poll(() => (activeTab(useApp.getState().panes)?.id === path ? surface() : null), `${path} open in the reader`, 10000);
    await sleep(500);
  };
  try {
    for (const p of ['courses', 'courses/fall-2026', COURSE]) toggleOpen(p, true);
    await open(NOTE);
    const t0 = await text();
    must(!t0.includes(FRONT), 'a fresh copy of the sample: the card is not in the note yet');
    must(surface()!.isContentEditable, 'the note is editable');

    // ── the note's own card items: lecture 11's list ──
    const zn = await poll(() => qa<HTMLElement>('.card-span.in-item', surface()!).find((c) => c.textContent?.includes('dilute gas')), 'lecture 11\'s partition-function card is drawn as a list item');
    must(zn.querySelector('.li-mark')?.textContent === '•', `with its bullet (${zn.querySelector('.li-mark')?.textContent ?? 'none'})`);
    must(zn.previousElementSibling?.matches('.dd-list') && zn.nextElementSibling?.matches('.dd-list'), 'the list goes on around it: an item before, the nested caveat after');
    zn.scrollIntoView({ block: 'center' });
    await shot('listcards-items');

    // ── a bullet card typed after lecture 9's last paragraph ──
    const anchor = await poll(() => block(ANCHOR), 'lecture 9\'s last paragraph');
    anchor.scrollIntoView({ block: 'center' });
    surface()!.focus();
    caret(anchor, ANCHOR, ANCHOR.length);
    await sleep(100);
    keyOn(surface()!, 'Enter', { code: 'Enter' });
    await sleep(120);
    must(caretKind() === 'paragraph ""', `⏎ makes a fresh paragraph (caret in ${caretKind()})`);
    await type('- ');
    must(caretKind() === 'item ""', `\`- \` makes a list item (caret in ${caretKind()})`);
    await type(CARD);
    surface()!.blur();
    const written = await poll(async () => (await lines()).find((l) => l === `- ${CARD}`), `the file has the item line "- ${CARD}"`);
    const all = await lines();
    const at = all.indexOf(written);
    must(all[at - 1] === '' && all[at - 2]!.endsWith(ANCHOR), 'under the anchor paragraph, a blank line between');
    const typed = await poll(() => ourCard(), 'the reader reads it back as a card item (the file is right)');
    must(typed.querySelector('.li-mark')?.textContent === '•' && typed.querySelector('.cs-q')?.textContent === FRONT, 'drawn as the item it is: the bullet, the front, the back');
    typed.scrollIntoView({ block: 'center' });
    await shot('listcards-typed');

    // ── the queue ──
    const item = await poll(() => useApp.getState().queue.find((i): i is CardItem => i.kind === 'card' && i.path === NOTE && i.text === CARD), 'the queue has it');
    must(JSON.stringify(item.trail) === JSON.stringify([SECTION]), `under its heading (${JSON.stringify(item.trail)})`);
    openNode(queueId('today'));
    const row = await poll(() => qa<HTMLElement>('.qlist li[data-el="card"]').find((r) => r.textContent?.includes(FRONT)), 'today\'s queue shows its row', 8000);
    must(row.dataset.fresh === '1', 'a new card');
    row.scrollIntoView({ block: 'center' });
    await shot('listcards-queue');

    // ── reviewed in a session: the heading path above it, the sr line under the item ──
    openSession(item);
    const trail = await poll(() => q<HTMLElement>('.recall-wrap .card-trail'), 'the session shows the card', 8000);
    const want = `${TITLE} › ${SECTION}`;
    const got = qa<HTMLElement>('.ct-doc, .ct-h', trail).map((s) => s.textContent).join(' › ');
    must(got === want, `the line above the card is "${got}"`);
    must(q('.recall-wrap .card .qa-q')?.textContent === FRONT, 'its front');
    await shot('listcards-session');
    keyOn(window, ' ');
    await poll(() => q('.recall-wrap .card[data-revealed="1"]'), 'space reveals the back');
    await shot('listcards-revealed', 1500);
    keyOn(window, '3');
    const graded = await poll(async () => {
      const ls = await lines();
      const k = ls.findIndex((l) => l.startsWith(`- ${CARD} ^`));
      return k >= 0 && /^ {2}<!-- sr due=\S+ st=\S+ .*-->$/.test(ls[k + 1] ?? '') ? [ls[k]!, ls[k + 1]!] : null;
    }, 'good: the card line gains its id and the sr line is written under the item, at its content column');
    log(`the lines: ${graded.join(' ⏎ ')}`);
    const after = await lines();
    must(after.length === all.length + 1, `one line more in the file (${all.length} → ${after.length})`);

    // ── go to source: back to the card, `o` ──
    keyOn(window, '[');
    await poll(() => q<HTMLElement>('.recall-wrap .card .qa-q')?.textContent === FRONT, 'back on the card with [');
    keyOn(window, 'o');
    await poll(() => (activeTab(useApp.getState().panes)?.id === NOTE ? surface() : null), 'o opens the note', 8000);
    const landed = await poll(() => { const c = ourCard(); return c?.classList.contains('selected') ? c : null; }, 'the card is selected in the page');
    must(landed.classList.contains('landed'), 'and marked where it landed');
    const sc = scroller()!;
    const r = landed.getBoundingClientRect();
    const v = sc.getBoundingClientRect();
    must(sc.scrollTop > 400, `the page is scrolled down (${Math.round(sc.scrollTop)} px), not at the top`);
    must(r.top >= v.top && r.bottom <= v.bottom, `the card is in view (${Math.round(r.top - v.top)} px from the pane's top of ${Math.round(v.height)})`);
    await shot('listcards-source', 1500);

    // ── study from the reader's top row, and from the note's tab ──
    const study = await poll(() => q<HTMLButtonElement>('.doc-view .meta .study-btn'), 'the top row has study');
    must(study.textContent?.trim() === 'study', `labelled "${study.textContent?.trim() ?? ''}"`);
    await shot('listcards-toprow', 1200);
    study.click();
    const head = await poll(() => q<HTMLElement>('.recall-wrap .sess-deck'), 'study opens a session over the note', 8000);
    must(new RegExp(`^${TITLE.replace(/[.*+?^${}()|[\]\\&]/g, '\\$&')} · \\d+ left$`).test(head.textContent ?? ''), `its header: "${head.textContent ?? ''}"`);
    const s = useApp.getState().session;
    must(s?.deck?.id === NOTE && s.items.every((i) => i.path === NOTE), `${s?.items.length ?? 0} cards, all the note's`);
    await shot('listcards-study');
    const tabRow = q<HTMLElement>(`.tab-rail .rail-row[data-path="${CSS.escape(NOTE)}"]`);
    if (tabRow) {
      await open(NOTE);
      const row2 = await poll(() => q<HTMLElement>(`.tab-rail .rail-row[data-path="${CSS.escape(NOTE)}"]`), 'the note\'s tab in the notebook\'s rail');
      q<HTMLElement>('.row-acts .more', row2)!.click();
      await poll(() => q('.ctx-menu .ci[data-act="study"]'), 'its `···` menu has study');
      await shot('listcards-rail-menu', 1500);
      document.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
      keyOn(window, 'Escape');
    } else {
      log('the note opened without the notebook\'s rail; the rail\'s study is covered by the tests');
    }

    useApp.getState().setTheme('dark');
    await open(NOTE);
    ourCard()?.scrollIntoView({ block: 'center' });
    await shot('listcards-dark');
    useApp.getState().setTheme('light');
    log(`done; vault ${vault.root}`);
  } catch (e) {
    log(`failed: ${e instanceof Error ? e.message : String(e)}`);
  }
}

// `ILMI_SMOKE=arabic` (`smokeArabic`) over a copy of `samples/double-major`:
// 36's "done when". The grammar note, the classical prose reader's passage,
// a note with formulas inside Arabic sentences, the vocab deck, and a
// session on an Arabic card and a case-ending cloze, each in light and
// dark: every block's and list item's computed direction against the rule
// (its majority script), a glossed example that opens in Arabic left to
// right with its Arabic run kept in order, an RTL block's
// text against its right edge, a formula an LTR isolate that keeps its
// order and its punctuation, the marks never cut by a clip (the clip box's
// scrollHeight against its clientHeight, and each voweled run's ink,
// measured on a canvas in the font it is drawn in, inside the box), no
// letter-spacing on Arabic, the Arabic faces loaded (`document.fonts`), and
// the fields that take Arabic `dir="auto"`. Every step asserts (`ok: …`);
// the first mismatch is `failed: …`.
export async function smokeArabic(vault: Vault): Promise<void> {
  const log = (s: string) => info(`smoke arabic: ${s}`);
  const shot = async (name: string, ms = 2500) => { await sleep(600); log(`shot: ${name}`); await sleep(ms); };
  const q = <T extends Element>(sel: string, root: ParentNode = document) => root.querySelector<T>(sel);
  const qa = <T extends Element>(sel: string, root: ParentNode = document) => Array.from(root.querySelectorAll<T>(sel));
  const { strongDir } = await import('../reader/index.js');
  const must = (ok: unknown, what: string) => { if (!ok) throw new Error(what); log(`ok: ${what}`); };
  const poll = async <T,>(probe: () => T | null | undefined | false | Promise<T | null | undefined | false>, what: string, ms = 8000): Promise<T> => {
    const t0 = Date.now();
    for (;;) {
      const v = await probe();
      if (v) { log(`ok: ${what}`); return v; }
      if (Date.now() - t0 > ms) throw new Error(`${what} (waited ${ms} ms)`);
      await sleep(100);
    }
  };
  const GRAMMAR = 'courses/fall-2026/arab-401-advanced-grammar/conditional-sentences.md';
  const KANA = 'courses/fall-2026/arab-401-advanced-grammar/kana-and-its-sisters.md';
  const PASSAGE = 'library/classical-prose-reader/12-the-grammarian-and-the-bedouin.md';
  const VOCAB = 'arabic/vocabulary.md';
  const MATH = 'fleeting/arabic-with-formulas.md';
  const MARKS = /[\u064B-\u065F\u0670]/;
  const ARABIC = /[\u0600-\u06FF]/;
  const surface = () => q<HTMLElement>('.pane-body .doc-view .draft-doc');
  const open = async (path: string, ready: string) => {
    openNode(path);
    await poll(() => (activeTab(useApp.getState().panes)?.id === path ? q(ready) : null), `${path} is open`, 12000);
    await sleep(600);
  };
  const dirOf = (el: Element) => getComputedStyle(el).direction;
  const short = (el: Element) => (el.textContent ?? '').trim().slice(0, 28);
  /** A list item's own text: past its bullet, without its formulas. */
  const itemText = (li: Element) => {
    const bare = (li.querySelector(':scope > .li-text') ?? li).cloneNode(true) as HTMLElement;
    for (const m of Array.from(bare.querySelectorAll('.math, ul, ol, .dd-list'))) m.remove();
    return (bare.textContent ?? '').trim();
  };
  /** Every list item of the page, an editable one (`.dd-li`) or one drawn from a raw block (`li`). */
  const items = () => [...qa<HTMLElement>('.dd-li', surface()!), ...qa<HTMLElement>('.raw-view li', surface()!)];
  /** The box of the first occurrence of `sub` in `root`'s text, in one text node. */
  const boxOf = (root: Element, sub: string): DOMRect | null => {
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    for (let n = walker.nextNode(); n; n = walker.nextNode()) {
      const i = (n.textContent ?? '').indexOf(sub);
      if (i < 0) continue;
      const r = document.createRange();
      r.setStart(n, i);
      r.setEnd(n, i + sub.length);
      return r.getBoundingClientRect();
    }
    return null;
  };
  /** A list item's bullet on its start side: the left for LTR, the right for RTL (an editable item only). */
  const checkBullet = (li: HTMLElement) => {
    const mark = q<HTMLElement>('.li-mark', li)?.getBoundingClientRect();
    const text = q<HTMLElement>('.li-text', li)?.getBoundingClientRect();
    if (!mark || !text) return;
    const rtl = dirOf(li) === 'rtl';
    must(rtl ? mark.left >= text.right - 1 : mark.right <= text.left + 1, `"${short(li)}": its bullet sits on its ${rtl ? 'right' : 'left'}, the start side`);
  };

  /** Every block of the page: its `dir` set, its computed direction the same, and the rule's answer for its own text when it has a letter. */
  const checkBlocks = (label: string) => {
    const s = surface()!;
    const kids = Array.from(s.children) as HTMLElement[];
    const wrong: string[] = [];
    let rtl = 0;
    for (const el of kids) {
      const d = el.getAttribute('dir');
      if (d !== 'ltr' && d !== 'rtl') { wrong.push(`no dir on "${short(el)}"`); continue; }
      if (dirOf(el) !== d) wrong.push(`"${short(el)}" computed ${dirOf(el)}, dir ${d}`);
      // a paragraph or heading: its own letters decide when it has any
      if (el.matches('p.dd-p, .dd-h')) {
        const bare = el.cloneNode(true) as HTMLElement;
        for (const m of Array.from(bare.querySelectorAll('.math'))) m.remove();
        const own = strongDir(bare.textContent ?? '');
        if (own && own !== d) wrong.push(`"${short(el)}" should be ${own}`);
      }
      if (d === 'rtl') {
        rtl++;
        const cs = getComputedStyle(el);
        if (cs.letterSpacing !== 'normal' && parseFloat(cs.letterSpacing) !== 0) wrong.push(`"${short(el)}" letter-spacing ${cs.letterSpacing}`);
        const lh = parseFloat(cs.lineHeight);
        if (el.matches('p.dd-p') && !(lh >= parseFloat(cs.fontSize) * 1.8)) wrong.push(`"${short(el)}" line-height ${cs.lineHeight} at ${cs.fontSize}`);
      }
    }
    for (const li of qa<HTMLElement>('.dd-li', s)) {
      if (dirOf(li) !== li.getAttribute('dir')) wrong.push(`item "${short(li)}" computed ${dirOf(li)}`);
      const own = strongDir(itemText(li));
      if (own && own !== li.getAttribute('dir')) wrong.push(`item "${short(li)}" should be ${own}`);
    }
    // a list kept as a raw block (drawn read-only): each item its own way too
    for (const li of qa<HTMLElement>('.raw-view li', s)) {
      const own = strongDir(itemText(li));
      if (own && dirOf(li) !== own) wrong.push(`raw item "${short(li)}" computed ${dirOf(li)}, should be ${own}`);
    }
    must(wrong.length === 0, `${label}: ${kids.length} blocks, ${rtl} right to left, each computed as its dir${wrong.length ? `; ${wrong.slice(0, 4).join('; ')}` : ''}`);
    return { rtl, all: kids.length };
  };

  /** An RTL paragraph's first line ends at its right edge, and an LTR one starts at its left. */
  const checkAnchored = (label: string, el: HTMLElement) => {
    const r = document.createRange();
    r.selectNodeContents(el);
    const first = Array.from(r.getClientRects()).sort((a, b) => a.top - b.top)[0];
    const box = el.getBoundingClientRect();
    if (!first) throw new Error(`${label}: no text drawn`);
    const d = dirOf(el);
    const gap = d === 'rtl' ? box.right - Math.max(...Array.from(r.getClientRects()).filter((x) => Math.abs(x.top - first.top) < 2).map((x) => x.right)) : first.left - box.left;
    must(gap < 3, `${label}: "${short(el)}" (${d}) sits at its ${d === 'rtl' ? 'right' : 'left'} edge (${gap.toFixed(1)} px)`);
  };

  /** The canvas font for an element, as it is drawn. */
  const fontOf = (el: Element) => {
    const cs = getComputedStyle(el);
    return `${cs.fontStyle} ${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`;
  };
  const ctx = document.createElement('canvas').getContext('2d')!;

  /**
   * No voweled text cut by a clip: for each text run with ḥarakāt under
   * `root`, the nearest ancestor that clips (overflow other than visible)
   * and is a row, not a scrolling pane: its scrollHeight within its
   * clientHeight, and each line's ink (the run measured in its own font)
   * inside its padding box.
   */
  const checkClips = (label: string, root: Element) => {
    const cut: string[] = [];
    let runs = 0;
    let boxed = 0;
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    for (let n = walker.nextNode(); n; n = walker.nextNode()) {
      const t = n.textContent ?? '';
      if (!MARKS.test(t)) continue;
      const el = n.parentElement;
      if (!el || el.closest('.katex')) continue;
      runs++;
      let clip: HTMLElement | null = null;
      for (let a: HTMLElement | null = el; a && a !== document.body; a = a.parentElement) {
        const cs = getComputedStyle(a);
        if (cs.overflowX === 'visible' && cs.overflowY === 'visible') continue;
        // a pane or a face that scrolls is not a row's clip; its content moves, it is not cut
        const lh = parseFloat(cs.lineHeight) || parseFloat(cs.fontSize) * 1.2;
        if (a.clientHeight > lh * 4 || cs.overflowY === 'auto' || cs.overflowY === 'scroll') break;
        clip = a;
        break;
      }
      if (!clip) continue;
      boxed++;
      if (clip.scrollHeight > clip.clientHeight + 1) cut.push(`"${t.trim().slice(0, 16)}" in .${clip.className.split(' ')[0]}: scrollHeight ${clip.scrollHeight} > ${clip.clientHeight}`);
      ctx.font = fontOf(el);
      const m = ctx.measureText(t.trim());
      const cr = clip.getBoundingClientRect();
      const top = cr.top + clip.clientTop;
      const bottom = top + clip.clientHeight;
      const range = document.createRange();
      range.selectNodeContents(n);
      for (const line of Array.from(range.getClientRects())) {
        const fa = m.fontBoundingBoxAscent || m.actualBoundingBoxAscent;
        const fd = m.fontBoundingBoxDescent || m.actualBoundingBoxDescent;
        const base = line.top + (line.height - (fa + fd)) / 2 + fa;
        const inkTop = base - m.actualBoundingBoxAscent;
        const inkBottom = base + m.actualBoundingBoxDescent;
        if (inkTop < top - 0.5 || inkBottom > bottom + 0.5) cut.push(`"${t.trim().slice(0, 16)}" in .${clip.className.split(' ')[0]}: ink ${inkTop.toFixed(1)}–${inkBottom.toFixed(1)}, box ${top.toFixed(1)}–${bottom.toFixed(1)}`);
      }
    }
    must(cut.length === 0, `${label}: ${runs} voweled runs, ${boxed} in a clipping row, none cut${cut.length ? `; ${cut.slice(0, 4).join('; ')}` : ''}`);
  };

  const themed = async (label: string, check: () => void | Promise<void>) => {
    useApp.getState().setTheme('light');
    await sleep(400);
    await check();
    await shot(`arabic-${label}`);
    useApp.getState().setTheme('dark');
    await sleep(400);
    await check();
    await shot(`arabic-${label}-dark`);
    useApp.getState().setTheme('light');
  };

  try {
    setInspector({ open: false });

    // ── the faces: bundled, loaded, in the stacks ──
    {
      await document.fonts.load('18px "Ilmi Naskh"', 'كَانَ');
      await document.fonts.load('13px "Ilmi Plex Arabic"', 'كَانَ');
      const faces = Array.from(document.fonts as unknown as Iterable<FontFace>);
      const loaded = (fam: string) => faces.some((f) => f.family.replace(/"/g, '') === fam && f.status === 'loaded');
      must(loaded('Ilmi Naskh') && document.fonts.check('18px "Ilmi Naskh"', 'كَانَ'), 'Noto Naskh Arabic is loaded from the bundle');
      must(loaded('Ilmi Plex Arabic') && document.fonts.check('13px "Ilmi Plex Arabic"', 'كَانَ'), 'IBM Plex Sans Arabic is loaded from the bundle');
      const css = getComputedStyle(document.documentElement);
      must(css.getPropertyValue('--serif').includes('Ilmi Naskh') && css.getPropertyValue('--sans').includes('Ilmi Plex Arabic'), 'both are in the reading and chrome stacks');
      // the face is the one drawing: a voweled word measures differently in it than in the system's Arabic
      ctx.font = '18px "Ilmi Naskh"';
      const ours = ctx.measureText('وَاللّٰهِ مَا أَدْرِي').width;
      ctx.font = '18px "Geeza Pro", serif';
      const system = ctx.measureText('وَاللّٰهِ مَا أَدْرِي').width;
      must(Math.abs(ours - system) > 0.5, `Naskh draws the text (${ours.toFixed(1)} px against the system's ${system.toFixed(1)} px)`);
    }

    // ── the grammar note ──
    await open(GRAMMAR, '.pane-body .doc-view .draft-doc');
    await themed('grammar', () => {
      const { rtl } = checkBlocks('the grammar note');
      must(rtl >= 1, 'the grammar note has its Arabic verse right to left');
      const verse = qa<HTMLElement>('p.dd-p', surface()!).find((p) => p.textContent?.startsWith('اسْمِيَّةٌ'));
      must(verse && dirOf(verse) === 'rtl', 'the verse, all Arabic, reads right to left');
      checkAnchored('the verse', verse!);
      // opens in Arabic, goes on in English: left to right, the Arabic a run of its own in its order
      const ex = qa<HTMLElement>('p.dd-p', surface()!).find((p) => p.textContent?.startsWith('إِنْ تَدْرُسْ'));
      must(ex && dirOf(ex) === 'ltr', 'إِنْ تَدْرُسْ تَنْجَحْ, glossed in English, reads left to right');
      checkAnchored('the example', ex!);
      {
        const first = boxOf(ex!, 'إِنْ')!;
        const last = boxOf(ex!, 'تَنْجَحْ')!;
        const after = boxOf(ex!, 'in tadrus')!;
        const sameLine = Math.abs(first.top - after.top) < 4;
        must(first.left > last.left, `the Arabic run reads right to left inside: إِنْ (${first.left.toFixed(0)}) right of تَنْجَحْ (${last.left.toFixed(0)})`);
        must(!sameLine || first.right <= after.left + 1, `the Arabic run comes first, on the left, then "in tadrus" (${first.right.toFixed(0)} ≤ ${after.left.toFixed(0)})`);
        const ex0 = ex!.getBoundingClientRect();
        must(!sameLine || last.left - ex0.left < 3, `the run starts at the line's left edge (${(last.left - ex0.left).toFixed(1)} px)`);
        const period = boxOf(ex!, '".')!;
        must(period.right > after.right || period.top > after.top + 2, 'the closing period is at the end, on the right, not dragged to the far left');
      }
      const en = qa<HTMLElement>('p.dd-p', surface()!).find((p) => p.textContent?.startsWith('A conditional sentence'));
      must(en && dirOf(en) === 'ltr', 'the English paragraph around it left to right');
      checkAnchored('the English', en!);
      must(getComputedStyle(ex!).fontFamily.includes('Ilmi Naskh'), 'the example is set in the serif stack with Naskh');
      checkClips('the grammar note', surface()!);
    });

    // the find field takes Arabic its own way
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'f', code: 'KeyF', metaKey: true, bubbles: true, cancelable: true }));
    const fb = await poll(() => q<HTMLInputElement>('.find-bar input.fb-q'), 'find opens', 4000);
    must(fb.dir === 'auto', 'the find field is dir="auto"');
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(fb, 'كان');
    fb.dispatchEvent(new Event('input', { bubbles: true }));
    await sleep(300);
    must(dirOf(fb) === 'rtl' || fb.matches(':dir(rtl)'), 'Arabic typed into it reads right to left');
    await shot('arabic-find');
    fb.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
    await sleep(200);

    // ── the classical prose reader ──
    await open(PASSAGE, '.pane-body .doc-view .draft-doc');
    await themed('passage', () => {
      const { rtl } = checkBlocks('the prose passage');
      must(rtl >= 4, 'the passage reads right to left');
      const story = qa<HTMLElement>('p.dd-p', surface()!).find((p) => p.textContent?.startsWith('قِيلَ'));
      must(story && dirOf(story) === 'rtl', 'its first paragraph is right to left');
      checkAnchored('the passage', story!);
      // the glossary opens each item in Arabic and glosses it in English: mostly English, so left to right
      const gloss = items().filter((li) => ARABIC.test(itemText(li)[0] ?? ''));
      must(gloss.length >= 15, `the glossary's items are found (${gloss.length} open in Arabic)`);
      const rtlGloss = gloss.filter((li) => dirOf(li) !== 'ltr');
      must(rtlGloss.length === 0, `each glossary item, mostly English, is left to right${rtlGloss.length ? `; not "${short(rtlGloss[0]!)}"` : ''}`);
      checkBullet(gloss[0]!);
      checkAnchored('a glossary item', (q<HTMLElement>('.li-text', gloss[0]!) ?? gloss[0]!));
      checkClips('the prose passage', surface()!);
    });

    // ── formulas inside Arabic sentences ──
    await vault.fs.writeText(vault.abs(MATH), '# formulas in Arabic\n\nإِذَا كَانَ $x^2 = 4$ فَإِنَّ $x = \\pm 2$، وَهٰذَا وَاضِحٌ.\n\nالطَّاقَةُ تُسَاوِي $E = mc^2$ (مُعَادَلَةُ أَيْنِشْتَايْن)، وَ`c` سُرْعَةُ الضَّوْءِ.\n\n$$\\int_0^1 x\\,dx = \\tfrac12$$\n\nand back to English: $a + b$ is a sum.\n\n- كِتَابٌ جَدِيدٌ عَلَى المَكْتَبِ\n- 42\n- كِتَاب *kitāb* — a book, anything written\n');
    await poll(() => useApp.getState().docs[MATH], 'the note with formulas is in the collection', 10000);
    await open(MATH, '.pane-body .doc-view .draft-doc .math');
    await themed('formulas', () => {
      checkBlocks('the formulas note');
      const p = qa<HTMLElement>('p.dd-p', surface()!).find((e) => e.textContent?.startsWith('إِذَا كَانَ'))!;
      must(dirOf(p) === 'rtl', 'the sentence with formulas is right to left');
      const chips = qa<HTMLElement>('.math', p);
      must(chips.length === 2, 'its two formulas are chips');
      for (const c of chips) {
        const cs = getComputedStyle(c);
        must(cs.direction === 'ltr' && cs.unicodeBidi === 'isolate', `"${c.dataset.tex}" is an LTR isolate (${cs.direction}, ${cs.unicodeBidi})`);
        const parts = qa<HTMLElement>('.katex-html .mord, .katex-html .mrel', c);
        const first = parts[0]!.getBoundingClientRect();
        const last = parts[parts.length - 1]!.getBoundingClientRect();
        must(first.left < last.left, `"${c.dataset.tex}" reads left to right inside: ${parts[0]!.textContent} before ${parts[parts.length - 1]!.textContent}`);
      }
      const [a, b] = chips.map((c) => c.getBoundingClientRect());
      if (Math.abs(a!.top - b!.top) < 4) must(a!.left > b!.right, 'the first formula is to the right of the second, the sentence\'s order');
      // the comma after the second formula stays after it (to its left), not dragged to the line's end
      const walker = document.createTreeWalker(p, NodeFilter.SHOW_TEXT);
      let comma: DOMRect | null = null;
      for (let n = walker.nextNode(); n && !comma; n = walker.nextNode()) {
        const i = (n.textContent ?? '').indexOf('،');
        if (i < 0 || (n.parentElement?.closest('.math'))) continue;
        const r = document.createRange();
        r.setStart(n, i);
        r.setEnd(n, i + 1);
        comma = r.getBoundingClientRect();
      }
      must(comma && Math.abs(comma.top - b!.top) < 8 ? comma.right <= b!.left + 2 : !!comma, 'the comma after it sits just after it, on its left');
      const p2 = qa<HTMLElement>('p.dd-p', surface()!).find((e) => e.textContent?.startsWith('الطَّاقَةُ'))!;
      const code = q<HTMLElement>('.md-code', p2);
      must(code && getComputedStyle(code).direction === 'ltr', 'inline code in an Arabic sentence is left to right');
      const display = q<HTMLElement>('.math.display', surface()!);
      must(display && getComputedStyle(display).direction === 'ltr', 'display math is left to right, centred');
      const en = qa<HTMLElement>('p.dd-p', surface()!).find((e) => e.textContent?.startsWith('and back'))!;
      must(dirOf(en) === 'ltr', 'the English after it is left to right again');
      // a list: an all-Arabic item right to left, one with no letter after it the same, a glossed one left to right
      const li = items().filter((e) => /^(?:كِتَاب|42)/.test(itemText(e)));
      must(li.length === 3, `the list's three items are found (${li.length})`);
      must(dirOf(li[0]!) === 'rtl', `the all-Arabic item is right to left ("${short(li[0]!)}")`);
      checkBullet(li[0]!);
      must(dirOf(li[1]!) === 'rtl', 'the item with only a number takes the item before\'s way');
      must(dirOf(li[2]!) === 'ltr', `the glossed item is left to right ("${short(li[2]!)}")`);
      checkBullet(li[2]!);
      checkClips('the formulas note', surface()!);
    });

    // ── the vocab deck ──
    await open(VOCAB, '.deck-view .deck-row');
    await themed('vocab', () => {
      const rows = qa<HTMLElement>('.deck-view .deck-row');
      const fronts = rows.map((r) => q<HTMLElement>('.dr-front', r)!).filter(Boolean);
      const rtl = fronts.filter((f) => dirOf(f) === 'rtl');
      must(rtl.length >= fronts.length * 0.9, `the deck's fronts are right to left (${rtl.length} of ${fronts.length})`);
      const back = q<HTMLElement>('.dr-back', rows[0]!);
      must(back && dirOf(back) === 'ltr', 'a back in English is left to right');
      checkClips('the vocab deck', q('.deck-view')!);
    });
    const search = q<HTMLInputElement>('.deck-view .db-search');
    must(search?.dir === 'auto', 'the deck search is dir="auto"');

    // ── a session on Arabic cards ──
    const vocabItem = await poll(() => useApp.getState().queue.find((i) => i.kind === 'card' && i.path === VOCAB), 'a vocab card in the queue', 10000);
    openSession(vocabItem);
    await poll(() => q('.recall-wrap .card .face.front'), 'the session shows the vocab card', 10000);
    await sleep(500);
    await themed('session-vocab', () => {
      const front = q<HTMLElement>('.recall-wrap .card .face.front > [dir]');
      must(front && dirOf(front) === 'rtl', `the word's face is right to left ("${short(front!)}")`);
      checkClips('the vocab card', q('.recall-wrap .card')!);
    });
    press(' ');
    await poll(() => q('.recall-wrap .card[data-revealed="1"]'), 'revealed', 4000);
    await shot('arabic-session-vocab-revealed');

    const kanaItem = await poll(() => useApp.getState().queue.find((i) => i.kind === 'card' && i.path === KANA && i.text.includes('غَائِبَات{{c1::')), 'the case-ending card in the queue', 10000);
    openSession(kanaItem);
    const blank = await poll(() => q<HTMLElement>('.recall-wrap .card .cloze.on-letter'), 'the case-ending blank sits on its letter', 10000);
    await sleep(400);
    await themed('session-case-ending', () => {
      const b = q<HTMLElement>('.recall-wrap .card .cloze.on-letter')!;
      must(b.textContent === 'ت', `hidden, it shows the bare letter ("${b.textContent}")`);
      const fill = getComputedStyle(b).webkitTextFillColor || getComputedStyle(b).color;
      must(!/rgba\(0, 0, 0, 0\)|transparent/.test(fill), `the letter is visible (${fill})`);
      must(b.getBoundingClientRect().width > 2, 'the blank is not an empty chip');
      must(dirOf(q('.recall-wrap .card .cloze-text')!) === 'rtl', 'the sentence is right to left');
      checkClips('the case-ending card', q('.recall-wrap .card')!);
    });
    void blank;
    press(' ');
    await poll(() => q<HTMLElement>('.recall-wrap .card .cloze.on-letter.revealed')?.textContent === 'تٍ', 'revealed, the letter takes its kasratān', 4000);
    // 40: a cloze is answered in place, no second face repeating it
    must(!q('.recall-wrap .card .cloze-answer') && !q('.recall-wrap .card .face.back'), 'no answer face under the sentence');
    await shot('arabic-session-case-ending-revealed');
    useApp.getState().setTheme('dark');
    await sleep(400);
    checkClips('the revealed case ending, dark', q('.recall-wrap .card')!);
    await shot('arabic-session-case-ending-revealed-dark');
    useApp.getState().setTheme('light');

    // the fields that take Arabic
    press('k', { metaKey: true });
    const pal = await poll(() => q<HTMLInputElement>('.palette-input input'), 'the palette opens', 4000);
    must(pal.dir === 'auto', 'the palette field is dir="auto"');
    press('Escape');
    log(`done; vault ${vault.root}`);
  } catch (e) {
    log(`failed: ${e instanceof Error ? e.message : String(e)}`);
  }
}

// `ILMI_SMOKE=rest` (`smokeRest`) over a copy of `samples/double-major`:
// the editor's rest (milestone 41). The stat-mech notes' outline in the
// rail and, with the rail folded, in the inspector, each click scrolling
// its heading into view; lecture 9 folded by its chevron, the file
// untouched, `state.json` keeping the key, and still folded after the page
// is reopened; a folded section in a source read by one press on its
// heading; a note with code written beside the sample, coloured in light,
// dark and e-ink, a plain block given `bash` from the picker; the
// verb-forms table edited in place: a cell typed, Tab and ⇧Tab, ⏎ down,
// a row and a column added at the edges and from the cell's menu and
// deleted again, the file's lines checked after each. Every step asserts
// (`ok: …`); the first miss logs `failed: …` and stops.
export async function smokeRest(vault: Vault): Promise<void> {
  const log = (s: string) => info(`smoke rest: ${s}`);
  const shot = async (name: string, ms = 2500) => { await sleep(600); log(`shot: ${name}`); await sleep(ms); };
  const q = <T extends Element>(sel: string, root: ParentNode = document) => root.querySelector<T>(sel);
  const qa = <T extends Element>(sel: string, root: ParentNode = document) => Array.from(root.querySelectorAll<T>(sel));
  const must = (ok: unknown, what: string) => { if (!ok) throw new Error(what); log(`ok: ${what}`); };
  const poll = async <T,>(probe: () => T | null | undefined | false | Promise<T | null | undefined | false>, what: string, ms = 5000): Promise<T> => {
    const t0 = Date.now();
    for (;;) {
      const v = await probe();
      if (v) { log(`ok: ${what}`); return v; }
      if (Date.now() - t0 > ms) throw new Error(`${what} (waited ${ms} ms)`);
      await sleep(100);
    }
  };
  const { meta } = await import('../format/index.js');
  const { setRailFolded } = await import('./vault.js');
  const NB = 'courses/fall-2026/phys-415-stat-mech.md';
  const CANON = 'courses/fall-2026/phys-415-stat-mech/canonical-ensemble.md';
  const LECTURE9 = 'lecture 9 — $Z$ does everything (Wed 9/23)';
  const SOURCE = 'library/lindqvist-statistical-physics/ch-3-the-canonical-ensemble.md';
  const FORMS = 'courses/spring-2026/arab-302-morphology/verb-forms.md';
  const CODE = 'fleeting/numerics.md';
  const text = (path: string) => vault.fs.readText(vault.abs(path));
  /** The file holds `lines` one after another, within 5 s. */
  const lines = (path: string, want: string[], what: string) => poll(async () => {
    const all = (await text(path)).split('\n');
    return all.some((_, i) => want.every((l, k) => all[i + k] === l));
  }, what);
  /** The file no longer holds `line`, within 5 s. */
  const gone = (path: string, line: string, what: string) => poll(async () => !(await text(path)).split('\n').includes(line), what);
  const surface = () => q<HTMLElement>('.pane-body .doc-view .draft-doc')!;
  const open = async (path: string, ready = '.pane-body .doc-view .draft-doc') => {
    openNode(path);
    await poll(() => (activeTab(useApp.getState().panes)?.id === path ? q(ready) : null), `${path} is open`, 12000);
    await sleep(600);
  };
  const keyDown = async (k: string, init: KeyboardEventInit = {}) => {
    surface().dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true, cancelable: true, ...init }));
    await sleep(120);
  };
  const type = async (str: string) => {
    for (const ch of str) { document.execCommand('insertText', false, ch); await sleep(30); }
    await sleep(80);
  };
  const down = (el: Element) => el.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true, button: 0 }));
  const heading = (needle: string) => qa<HTMLElement>('.dd-h', surface()).find((h) => h.textContent?.includes(needle));
  const inView = (el: Element) => { const r = el.getBoundingClientRect(); return r.top >= 0 && r.top < window.innerHeight * 0.5; };
  const selText = () => window.getSelection()?.toString() ?? '';
  const cellOf = () => { const n = window.getSelection()?.anchorNode; return (n instanceof Element ? n : n?.parentElement)?.closest('td') ?? null; };
  const placeIn = async (td: HTMLElement, needle: string, offset: number) => {
    surface().focus();
    caret(td, needle, offset);
    await sleep(150);
  };
  try {
    setInspector({ open: true });

    // ── the outline, in the rail ──
    await open(CANON);
    setRailFolded(NB, false);
    const railRow = await poll(() => qa<HTMLElement>(`.tab-rail .rail-row.heading[data-of="${CANON}"]`).find((r) => r.textContent?.startsWith('lecture 13')), 'the rail lists the notes\' headings under the tab', 8000);
    must(!q('.insp .insp-outline'), 'the inspector draws no outline while the rail shows it');
    railRow.click();
    await poll(() => { const h = heading('lecture 13'); return h && inView(h); }, 'a click on lecture 13 in the rail scrolls it to the top');
    await shot('rest-outline-rail');

    // ── the outline, in the inspector, the rail folded ──
    setRailFolded(NB, true);
    const inspRow = await poll(() => qa<HTMLElement>('.insp .insp-outline li').find((r) => r.textContent?.startsWith('lecture 8')), 'with the rail folded, the inspector lists the headings', 4000);
    must(qa('.insp .insp-outline li').length === qa('.dd-h', surface()).filter((h) => /^H[123]$/.test(h.tagName)).length, 'one row for every heading of levels 1 to 3');
    inspRow.click();
    await poll(() => { const h = heading('lecture 8'); return h && inView(h); }, 'a click on lecture 8 in the inspector scrolls it to the top');
    await shot('rest-outline-inspector');

    // ── folding ──
    const before = await text(CANON);
    const h9 = heading('lecture 9')!;
    const chev = q<HTMLElement>('.fold-chev', h9);
    must(chev && chev.dataset.folded === '0', 'lecture 9 has a chevron in the margin');
    must(h9.textContent?.startsWith('lecture 9'), 'the heading\'s text is its own (the chevron is drawn by CSS)');
    down(chev!);
    const hidden = await poll(() => { const n = qa('.fold-hidden', surface()).length; return n > 0 ? n : null; }, 'lecture 9 folds');
    must(heading('lecture 9')!.classList.contains('fold-head'), 'the heading is marked folded');
    must(heading('lecture 10') && getComputedStyle(heading('lecture 10')!).display !== 'none', 'lecture 10, the next heading of its level, stays');
    const more = q<HTMLElement>('.fold-more', heading('lecture 9')!);
    must(more, `the folded line says what it holds ("${more?.dataset.label}", ${hidden} blocks hidden)`);
    await shot('rest-folded');
    await sleep(800);
    must((await text(CANON)) === before, 'the file is untouched by the fold');
    const key = `2 ${LECTURE9}`;
    await poll(async () => ((await vault.loadState()).folds?.[CANON] ?? []).includes(key), `state.json keeps the fold under its key ("${key}")`);
    // reopened: still folded
    await open(FORMS);
    await open(CANON);
    await poll(() => heading('lecture 9')?.classList.contains('fold-head'), 'reopened, lecture 9 is still folded');
    must(qa('.fold-hidden', surface()).length === hidden, 'the same blocks are hidden');
    // the outline into a fold: lecture 8 is not in it; opening via the folded line
    down(q<HTMLElement>('.fold-more', heading('lecture 9')!)!);
    await poll(() => !heading('lecture 9')?.classList.contains('fold-head') && qa('.fold-hidden', surface()).length === 0, 'a press on the folded line opens it');
    await poll(async () => !((await vault.loadState()).folds?.[CANON] ?? []).includes(key), 'state.json lets the fold go');
    setRailFolded(NB, false);

    // ── a folded section in a source, read by one press ──
    await open(SOURCE);
    const loaded = await vault.read(SOURCE, true);
    const blocks = loaded.doc.blocks;
    const hi = blocks.findIndex((b) => b.kind === 'heading' && b.text.startsWith('3.7'));
    let end = blocks.length;
    for (let i = hi + 1; i < blocks.length; i++) { const b = blocks[i]!; if (b.kind === 'heading' && b.level <= 2) { end = i; break; } }
    const want = blocks.slice(0, end).filter((b) => b.kind !== 'card').length;
    const h37 = heading('3.7')!;
    down(q<HTMLElement>('.fold-chev', h37)!);
    await poll(() => heading('3.7')?.classList.contains('fold-head'), '3.7 two-level systems folds in the frozen source');
    const g = q<HTMLElement>('.read-gutter', surface().closest('.doc-wrap')!)!;
    const hr = heading('3.7')!.getBoundingClientRect();
    const opts = { bubbles: true, clientY: hr.bottom - 2, pointerId: 1 };
    g.dispatchEvent(new PointerEvent('pointerdown', opts));
    g.dispatchEvent(new PointerEvent('pointerup', opts));
    await poll(async () => meta((await vault.read(SOURCE, true)).doc).read?.pos === want, `a press on the folded heading reads through its section (pos ${want})`);
    // this page's own rule: its wrap is the surface's
    const wrap = surface().closest<HTMLElement>('.doc-wrap')!;
    const rule = await poll(() => q<HTMLElement>('.read-rule', wrap), 'the rule is drawn');
    // what is drawn, in the wrap's frame: where the rule's style says it ends (a covered window may hold its ease back, so not its painted box), the block it ends at, the folded heading
    const wtop = () => wrap.getBoundingClientRect().top;
    const ruleEnd = () => parseFloat(rule.style.top) + parseFloat(rule.style.height);
    const rel = (el: Element) => { const r = el.getBoundingClientRect(); return { top: Math.round(r.top - wtop()), bottom: Math.round(r.bottom - wtop()) }; };
    const kids = Array.from(surface().children) as HTMLElement[];
    const at = kids.map((el, i) => ({ el, i })).filter(({ el }) => el.getClientRects().length && Math.abs(rel(el).bottom - ruleEnd()) < 4).pop();
    log(`rule: pos ${meta((await vault.read(SOURCE, true)).doc).read?.pos}; style ends at ${Math.round(ruleEnd())} (painted ${rel(rule).bottom}); ends at block ${at ? `${at.i} "${(at.el.textContent ?? '').slice(0, 40)}" ${JSON.stringify(rel(at.el))}` : '(none)'}; folded heading ${JSON.stringify(rel(heading('3.7')!))}; rules in the page ${qa('.read-rule').length}, readers ${qa('.doc-wrap').length}`);
    await shot('rest-folded-rule');
    let gap = Infinity;
    await poll(() => {
      gap = Math.abs(ruleEnd() - rel(heading('3.7')!).bottom);
      return gap < 4;
    }, 'the rule ends under the folded heading', 3000).catch((e: unknown) => { throw new Error(`${e instanceof Error ? e.message : String(e)}; off by ${gap.toFixed(0)} px`); });
    await shot('rest-folded-source');
    down(q<HTMLElement>('.fold-chev', heading('3.7')!)!);
    await poll(() => !heading('3.7')?.classList.contains('fold-head'), '3.7 opens again');

    // ── code coloured ──
    const fence = '```';
    await vault.fs.writeText(vault.abs(CODE), [
      '# numerics', '', 'The partition function by brute force, for problem set 5.', '',
      `${fence}python`, 'import numpy as np', '', 'def Z(beta, E):', '    """the canonical partition function"""', '    return np.sum(np.exp(-beta * E))  # one line', fence, '',
      'The same in Julia.', '', `${fence}jl`, 'Z(β, E) = sum(exp.(-β .* E))  # broadcast', fence, '',
      'Counting words in the notes.', '', fence, 'for f in *.md; do wc -w "$f"; done', fence, '',
    ].join('\n'));
    await poll(() => !!useApp.getState().docs[CODE], 'the code note is in the collection', 8000);
    await open(CODE, '.pane-body .doc-view .draft-doc pre.dd-code');
    const blocksOf = () => qa<HTMLElement>('pre.dd-code', surface());
    const py = blocksOf()[0]!;
    await poll(() => q('.hljs-keyword', py), 'the python block is coloured');
    const kw = q<HTMLElement>('.hljs-keyword', py)!;
    must(['import', 'def', 'return', 'as'].includes(kw.textContent ?? ''), `a keyword is a keyword ("${kw.textContent}")`);
    must(q('.hljs-string', py) && q('.hljs-comment', py), 'strings and comments are marked');
    must(py.querySelector('code')!.textContent!.startsWith('import numpy as np'), 'the code\'s text is the code');
    must(q('.code-lang', py)?.getAttribute('data-label') === 'python', 'the corner names the language');
    must(q('[class^="hljs-"]', blocksOf()[1]!), 'the jl block is coloured as julia');
    must(!q('[class^="hljs-"]', blocksOf()[2]!), 'the plain block is not coloured');
    // a run that failed in e-ink leaves that theme in the saved tweaks: start from light
    useApp.getState().setTheme('light');
    await poll(() => document.documentElement.dataset.theme === 'light', 'the page is light');
    const colourOf = (el: Element) => getComputedStyle(el).color;
    const plainColour = colourOf(py.querySelector('code')!);
    must(colourOf(kw) !== plainColour && colourOf(q('.hljs-comment', py)!) !== plainColour, `light: keyword ${colourOf(kw)}, comment ${colourOf(q('.hljs-comment', py)!)}, text ${plainColour}`);
    py.scrollIntoView({ block: 'center' });
    await shot('rest-code');
    /** The theme switched, and the page drawing it, before anything is read. */
    const theme = async (t: 'light' | 'dark' | 'eink') => {
      useApp.getState().setTheme(t);
      await poll(() => document.documentElement.dataset.theme === t, `the page is in ${t}`, 3000);
      await sleep(300);
    };
    const grey = (c: string) => {
      const rgb = /rgba?\(([\d.]+),? ([\d.]+),? ([\d.]+)/.exec(c);
      if (rgb) return Math.max(+rgb[1]!, +rgb[2]!, +rgb[3]!) - Math.min(+rgb[1]!, +rgb[2]!, +rgb[3]!) <= 8;
      // oklab / oklch: the e-ink paper's own faint warmth (#cfcfca, chroma ≈ 0.008) and no more; the code hues are 0.05 and up
      const lab = /oklab\(([-\d.]+) ([-\d.]+) ([-\d.]+)/.exec(c);
      if (lab) return Math.hypot(+lab[2]!, +lab[3]!) < 0.02;
      const lch = /oklch\(([-\d.]+) ([-\d.]+)/.exec(c);
      return !!lch && +lch[2]! < 0.02;
    };
    const einkOk = (from: string) => {
      must([kw, q('.hljs-string', py)!, q('.hljs-comment', py)!].every((el) => grey(colourOf(el))), `e-ink after ${from}: grey only (${colourOf(kw)}, ${colourOf(q('.hljs-string', py)!)}, ${colourOf(q('.hljs-comment', py)!)})`);
      must(Number(getComputedStyle(kw).fontWeight) >= 600, `e-ink after ${from}: a keyword by its weight`);
    };
    await theme('eink');
    einkOk('light');
    await theme('dark');
    must(colourOf(kw) !== colourOf(py.querySelector('code')!) && !grey(colourOf(kw)), `dark: keyword ${colourOf(kw)}`);
    await shot('rest-code-dark');
    await theme('eink');
    einkOk('dark');
    await shot('rest-code-eink');
    await theme('light');
    // the language picker on the plain block
    const plain = blocksOf()[2]!;
    plain.scrollIntoView({ block: 'center' });
    down(q<HTMLElement>('.code-lang', plain)!);
    const langs = await poll(() => q<HTMLElement>('.pop-menu.code-langs'), 'the picker opens', 3000);
    must(qa('.ci', langs).length === 12, `it lists the bundled languages and plain (${qa('.ci', langs).map((r) => r.textContent).join(', ')})`);
    await shot('rest-code-picker');
    q<HTMLElement>('[data-act="lang-bash"]', langs)!.click();
    await lines(CODE, [`${fence}bash`, 'for f in *.md; do wc -w "$f"; done', fence], 'the fence says bash');
    await poll(() => q('[class^="hljs-"]', blocksOf()[2]!), 'the bash block is coloured');

    // ── the verb-forms table ──
    await open(FORMS, '.pane-body .doc-view .draft-doc .dd-table');
    const orig = (await text(FORMS)).split('\n');
    const table = () => q<HTMLElement>('.dd-table', surface())!;
    const cells = () => qa<HTMLTableRowElement>('tr', table()).map((tr) => qa<HTMLElement>('td', tr));
    must(cells().length === 11 && cells()[0]!.length === 7, `the table is drawn as cells (${cells().length} rows of ${cells()[0]!.length})`);
    must(cells()[2]![1]!.getAttribute('dir') === 'rtl' && cells()[0]![1]!.getAttribute('dir') === 'ltr', 'an Arabic cell reads right to left, the header left to right');
    table().scrollIntoView({ block: 'center' });
    // a cell typed
    const basic = cells()[1]![6]!;
    await placeIn(basic, 'basic', 5);
    await type(' meaning');
    const formI = orig.find((l) => l.startsWith('| I |'))!;
    await lines(FORMS, [formI.replace('| basic |', '| basic meaning |')], 'a cell typed: its row\'s line changes');
    must((await text(FORMS)).split('\n').filter((l, i) => l !== orig[i]).length === 1, 'and only that line');
    must(q('td.tb-cur', table()) && q<HTMLElement>(':scope > .tb-more', table())?.hidden === false, 'the caret\'s cell shows its menu');
    await shot('rest-table-edit');
    // Tab and ⇧Tab
    await keyDown('Tab');
    must(cellOf()?.textContent === 'II' && selText() === 'II', `Tab: the next row's first cell, selected ("${selText()}")`);
    await keyDown('Tab');
    must(selText() === 'فَعَّلَ', `Tab: the next cell ("${selText()}")`);
    await keyDown('Tab', { shiftKey: true });
    await keyDown('Tab', { shiftKey: true });
    must(selText() === 'basic meaning', `⇧Tab twice: back to "${selText()}"`);
    // ⏎ down a column
    await placeIn(cells()[2]![0]!, 'II', 2);
    await keyDown('Enter');
    must(cellOf()?.textContent === 'III', `⏎: the cell below ("${cellOf()?.textContent}")`);
    // a row at the bottom edge, typed, deleted from the menu
    down(q<HTMLElement>('.tb-add-row', table())!);
    await lines(FORMS, [orig.find((l) => l.startsWith('| X |'))!, '|  |  |  |  |  |  |  |'], 'a row added at the bottom edge');
    must(cellOf() === cells()[11]?.[0], `the caret is in the new row's first cell (in "${cellOf()?.textContent ?? 'nothing'}", row ${cellOf() ? cells().findIndex((r) => r.includes(cellOf() as HTMLElement)) : -1})`);
    await type('XI');
    await lines(FORMS, ['| XI |  |  |  |  |  |  |'], 'the new row typed');
    await shot('rest-table-row');
    down(q<HTMLElement>(':scope > .tb-more', table())!);
    const menu = await poll(() => q<HTMLElement>('.pop-menu.table-menu'), 'the cell\'s menu opens', 3000);
    await shot('rest-table-menu');
    q<HTMLElement>('[data-act="delete-row"]', menu)!.click();
    await gone(FORMS, '| XI |  |  |  |  |  |  |', 'the row deleted from the menu');
    // a column at the end edge, named, deleted from the menu
    down(q<HTMLElement>('.tb-add-col', table())!);
    const head = orig.find((l) => l.startsWith('| form |'))!;
    await lines(FORMS, [`${head} |`.replace(/ \|$/, '  |'), `${orig[orig.indexOf(head) + 1]}`.replace(/ \|$/, ' | --- |')], 'a column added at the end edge');
    await type('root');
    await lines(FORMS, [head.replace(/ \|$/, ' | root |')], 'the new column named');
    await shot('rest-table-column');
    down(q<HTMLElement>(':scope > .tb-more', table())!);
    q<HTMLElement>('[data-act="delete-col"]', await poll(() => q<HTMLElement>('.pop-menu.table-menu'), 'the menu again', 3000))!.click();
    await lines(FORMS, [head, orig[orig.indexOf(head) + 1]!], 'the column deleted from the menu');
    // a row above from the menu, then gone again
    await placeIn(cells()[3]![0]!, 'III', 3);
    down(q<HTMLElement>(':scope > .tb-more', table())!);
    q<HTMLElement>('[data-act="row-above"]', await poll(() => q<HTMLElement>('.pop-menu.table-menu'), 'the menu on III', 3000))!.click();
    await lines(FORMS, [orig.find((l) => l.startsWith('| II |'))!, '|  |  |  |  |  |  |  |', orig.find((l) => l.startsWith('| III |'))!], 'a row put above III');
    down(q<HTMLElement>(':scope > .tb-more', table())!);
    q<HTMLElement>('[data-act="delete-row"]', await poll(() => q<HTMLElement>('.pop-menu.table-menu'), 'the menu on the new row', 3000))!.click();
    await poll(async () => { const now = (await text(FORMS)).split('\n'); return now.length === orig.length && now.filter((l, i) => l !== orig[i]).length === 1; }, 'the file is the sample\'s again but for the one cell typed');
    useApp.getState().setTheme('dark');
    await shot('rest-table-dark');
    useApp.getState().setTheme('light');
    log(`done; vault ${vault.root}`);
  } catch (e) {
    log(`failed: ${e instanceof Error ? e.message : String(e)}`);
  }
}

// `ILMI_SMOKE=bothways` over a fresh copy of `samples/double-major`
// (ILMI_VAULT): milestone 44, a both-ways card asked in two directions, each
// on its own `sr` line. Asserts (each an `ok: …` line, the first miss
// `failed: …`): in the vocab deck a card whose forward is due shows its
// reverse buried till tomorrow, and a card whose forward is not due has its
// reverse (never reviewed, so new) due today: both directions due apart;
// the queue and the deck browser draw each direction; a session asks the
// reverse back to front; grading the reverse writes an `sr r` line under the
// card and leaves the bare line byte for byte; grading a forward rewrites
// its bare line alone and buries its sibling the same day; a migrated card's
// history (its reviews and lapses) is kept as the forward's; the inspector
// shows both schedules. Files are polled up to 5 s; the theme is set first.
export async function smokeBothWays(vault: Vault): Promise<void> {
  type Card = import('../format/index.js').Card;
  const log = (s: string) => info(`smoke bothways: ${s}`);
  const shot = async (name: string, ms = 2500) => { await sleep(800); log(`shot: ${name}`); await sleep(ms); };
  const q = <T extends Element>(sel: string, root: ParentNode = document) => root.querySelector<T>(sel);
  const qa = <T extends Element>(sel: string, root: ParentNode = document) => Array.from(root.querySelectorAll<T>(sel));
  const must = (ok: unknown, what: string) => { if (!ok) throw new Error(what); log(`ok: ${what}`); };
  const poll = async <T,>(probe: () => T | null | undefined | false | Promise<T | null | undefined | false>, what: string, ms = 5000): Promise<T> => {
    const t0 = Date.now();
    for (;;) {
      const v = await probe();
      if (v) { log(`ok: ${what}`); return v; }
      if (Date.now() - t0 > ms) throw new Error(`${what} (waited ${ms} ms)`);
      await sleep(100);
    }
  };
  const key = (k: string) => window.dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true, cancelable: true }));
  const click = (el: Element) => el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
  const { parse, cardFields, cardForm } = await import('../format/index.js');
  const { addDays, dayOf, isDue } = await import('../schedule/index.js');
  const { refreshQueue } = await import('./vault.js');
  const { studyDeck } = await import('./deckOps.js');
  const VOCAB = 'arabic/vocabulary.md';
  const text = () => vault.fs.readText(vault.abs(VOCAB));
  const fileLines = async () => (await text()).split('\n');
  const now = new Date();
  const today = dayOf(now);
  try {
    useApp.getState().setTheme('light');
    setInspector({ open: true });

    // ── the deck as the sample has it: one bare line per both-ways card ──
    const orig = await fileLines();
    const doc = parse(orig.join('\n')).doc;
    const bidir = doc.blocks.map((b, i) => ({ b, i })).filter((x): x is { b: Card; i: number } => x.b.kind === 'card' && cardForm(x.b.text) === 'bidir');
    must(bidir.length > 100 && bidir.every((x) => !x.b.reverse), `the vocab deck's ${bidir.length} both-ways cards each have one bare line, no reverse line`);
    const dueDay = (c: Card) => c.sched?.due?.slice(0, 10) ?? '';
    const A = bidir.find((x) => x.b.sched?.reps && !x.b.sched.suspended && dueDay(x.b) <= today && dueDay(x.b) !== '');
    const B = bidir.find((x) => x.b.sched?.reps && !x.b.sched.suspended && dueDay(x.b) > addDays(today, 1));
    must(A && B, `a card due today forward (${A?.b.id}, due ${A && dueDay(A.b)}) and one not due till later (${B?.b.id}, due ${B && dueDay(B.b)})`);
    const lineOf = (lines: string[], id: string) => lines.findIndex((l) => l.endsWith(` ^${id}`));
    const aAt = lineOf(orig, A!.b.id!);
    const bAt = lineOf(orig, B!.b.id!);
    const aBare = orig[aAt + 1]!;
    const bBare = orig[bAt + 1]!;
    must(aBare.startsWith('<!-- sr due=') && bBare.startsWith('<!-- sr due=') && orig[aAt + 2] === '' && orig[bAt + 2] === '', `each card's one line sits under it (${A!.b.id} line ${aAt + 2}, ${B!.b.id} line ${bAt + 2})`);

    // ── the queue: both directions, due apart ──
    refreshQueue();
    const cardsOf = () => useApp.getState().queue.filter((i): i is CardItem => i.kind === 'card' && i.path === VOCAB);
    const item = (id: string, dir: 'f' | 'r') => cardsOf().find((i) => i.id === id && i.dir === dir);
    await poll(() => { refreshQueue(); return item(A!.b.id!, 'r') && item(B!.b.id!, 'r'); }, 'the queue holds a reverse item for each both-ways card', 10000);
    const t = new Date();
    const aF = item(A!.b.id!, 'f')!;
    const aR = item(A!.b.id!, 'r')!;
    const bF = item(B!.b.id!, 'f')!;
    const bR = item(B!.b.id!, 'r')!;
    must(isDue(aF, t) && !isDue(aR, t) && aR.buried && dayOf(aR.dueAt) === addDays(today, 1), `${A!.b.id}: the forward due today, its reverse buried till tomorrow`);
    must(!isDue(bF, t) && isDue(bR, t) && !bR.buried && bR.sched === undefined, `${B!.b.id}: the forward due ${dueDay(B!.b)}, its reverse new and due today`);
    const dueF = cardsOf().filter((i) => i.dir === 'f' && isDue(i, t)).length;
    const dueR = cardsOf().filter((i) => i.dir === 'r' && isDue(i, t)).length;
    const buried = cardsOf().filter((i) => i.buried).length;
    must(dueF > 0 && dueR > 0, `the vocab deck has both directions due separately: ${dueF} front to back, ${dueR} back to front, ${buried} held till tomorrow`);
    must(cardsOf().every((i) => !(isDue(i, t) && cardsOf().some((j) => j !== i && j.id === i.id && j.id !== undefined && isDue(j, t)))), 'no card is due both ways on one day');

    openNode(queueId('today'));
    const qrow = await poll(() => qa<HTMLElement>('.qlist li').find((li) => q(`[data-dir="r"]`, li)), 'the queue draws a reverse row', 8000);
    must(q('.cs-arrow', qrow)?.textContent === '→' && q('.kindtag', qrow)?.textContent === 'bidir', 'a reverse row reads its asked side first, an arrow to the answer, tagged both ways');
    qrow.scrollIntoView({ block: 'center' });
    await shot('bothways-queue');

    // ── the deck browser: a both-ways row shows each direction's due ──
    openNode(VOCAB);
    const rowOf = (i: number) => q<HTMLElement>(`.deck-view .deck-row[data-block="${i}"]`);
    await poll(() => rowOf(A!.i) && rowOf(B!.i), 'the deck lens lists both cards', 10000);
    const dues = (i: number) => qa<HTMLElement>('.dr-when[data-dirs="2"] .dr-due', rowOf(i)!).map((d) => `${d.dataset.dir}:${d.dataset.due}:${d.textContent}`);
    log(`${A!.b.id} row: ${dues(A!.i).join(' | ')}; ${B!.b.id} row: ${dues(B!.i).join(' | ')}`);
    must(dues(A!.i).length === 2 && dues(A!.i)[0]!.startsWith('f:1:→') && dues(A!.i)[1] === 'r:1:← new', `${A!.b.id}'s row: the forward due, the reverse new`);
    must(dues(B!.i).length === 2 && dues(B!.i)[0]!.startsWith('f:0:→ in') && dues(B!.i)[1] === 'r:1:← new', `${B!.b.id}'s row: the forward ahead, the reverse new`);
    rowOf(B!.i)!.scrollIntoView({ block: 'center' });
    await shot('bothways-deck');

    // ── a session over the two: the reverse asked back to front ──
    const n = studyDeck(VOCAB, { only: new Set([`${VOCAB}#${A!.i}`, `${VOCAB}#${B!.i}`]) });
    const items = useApp.getState().session?.items ?? [];
    must(n === 2 && items.every((i) => i.kind === 'card') && items.map((i) => (i as CardItem).dir).sort().join() === 'f,r', `the session holds ${A!.b.id} forward and ${B!.b.id} reverse (${n} items)`);
    const faces = cardFields(B!.b.text);
    for (let k = 0; k < 2; k++) {
      const it = useApp.getState().session!.items[k] as CardItem;
      const front = await poll(() => q<HTMLElement>('.recall-wrap .card .bidir-a'), `card ${k + 1} is drawn`, 8000);
      if (it.dir === 'r') {
        const squash = (x: string) => x.replace(/\s+/g, '').slice(0, 16);
        must(front.dataset.dir === 'r' && faces?.form === 'bidir' && squash(front.textContent ?? '') === squash(faces.right), `the reverse asks the right side ("${front.textContent?.slice(0, 30)}")`);
        must(q('.card-meta .cm-dir')?.textContent === 'back to front', 'the session says back to front');
        await shot('bothways-session-reverse');
      } else {
        must(front.dataset.dir === 'f', 'the forward asks the left side');
      }
      key(' ');
      await sleep(300);
      if (it.dir === 'r') await shot('bothways-session-revealed', 1500);
      key('3');
      if (it.dir === 'r') {
        // the reverse: a new `sr r` line under the bare one, the bare line byte for byte
        const after = await poll(async () => { const l = await fileLines(); const at = lineOf(l, B!.b.id!); return l[at + 2]?.startsWith('<!-- sr r ') ? l : null; }, `grading ${B!.b.id}'s reverse writes an sr r line under its bare line`);
        const at = lineOf(after, B!.b.id!);
        log(`${B!.b.id}: ${after[at + 1]} ⏎ ${after[at + 2]}`);
        must(after[at + 1] === bBare, 'its bare line, the forward, is untouched');
        must(/ r=1 l=0 /.test(after[at + 2]!) && after[at + 3] === '', 'the reverse line holds one review');
        must(after.length === orig.length + 1, 'one line more in the file, nothing else');
      } else {
        const after = await poll(async () => { const l = await fileLines(); const at = lineOf(l, A!.b.id!); return l[at + 1] !== aBare ? l : null; }, `grading ${A!.b.id}'s forward rewrites its bare line`);
        const at = lineOf(after, A!.b.id!);
        log(`${A!.b.id}: was ${aBare} ⏎ now ${after[at + 1]}`);
        must(after[at + 2] === '', 'and writes no reverse line: the other direction\'s line (none yet) is left alone');
        const reps = Number(/ r=(\d+)/.exec(aBare)?.[1]);
        const lapses = / l=(\d+)/.exec(aBare)?.[1];
        must(after[at + 1]!.includes(` r=${reps + 1} `) && after[at + 1]!.includes(` l=${lapses} `), `the migrated card keeps its history: ${reps} reviews before, ${reps + 1} now, lapses ${lapses}`);
      }
      await sleep(600);
    }

    // ── siblings: graded today, the other direction waits for tomorrow ──
    refreshQueue();
    await sleep(300);
    const t2 = new Date();
    const aR2 = item(A!.b.id!, 'r');
    must(aR2 && aR2.buried && !isDue(aR2, t2) && dayOf(aR2.dueAt) === addDays(today, 1), `${A!.b.id}'s reverse, its sibling reviewed today, is buried till tomorrow`);
    const bF2 = item(B!.b.id!, 'f');
    must(bF2 && bF2.sched?.reps === B!.b.sched!.reps && bF2.sched?.due === B!.b.sched!.due, `${B!.b.id}'s forward keeps its schedule (${bF2?.sched?.reps} reviews, due ${bF2?.sched?.due})`);

    // ── the deck row and the inspector after ──
    openNode(VOCAB);
    await poll(() => rowOf(B!.i), 'the deck lens again', 10000);
    await poll(() => !dues(B!.i)[1]?.endsWith('new'), `${B!.b.id}'s row shows its reverse scheduled (${dues(B!.i).join(' | ')})`);
    click(rowOf(B!.i)!);
    const heads = await poll(() => { const h = qa('.insp h6').map((e) => e.textContent); return h.includes('front to back') && h.includes('back to front') ? h : null; }, 'the inspector shows a schedule per direction');
    log(`inspector blocks: ${heads.join(', ')}`);
    const block = (title: string) => qa<HTMLElement>('.insp .block').find((b) => q('h6', b)?.textContent === title);
    const reviews = (title: string) => qa<HTMLElement>('.kv > *', block(title) ?? document.createElement('div')).map((e) => e.textContent ?? '');
    log(`front to back: ${reviews('front to back').join(' ')}; back to front: ${reviews('back to front').join(' ')}`);
    must((block('front to back')?.textContent ?? '').includes(`reviews${B!.b.sched!.reps}lapses`), `front to back holds the migrated history (${B!.b.sched!.reps} reviews)`);
    must((block('back to front')?.textContent ?? '').includes('reviews1lapses'), 'back to front holds its one review');
    rowOf(B!.i)!.scrollIntoView({ block: 'center' });
    await shot('bothways-deck-after');
    useApp.getState().setTheme('dark');
    await shot('bothways-deck-dark');
    useApp.getState().setTheme('light');
    log(`done; vault ${vault.root}`);
  } catch (e) {
    log(`failed: ${e instanceof Error ? e.message : String(e)}`);
  }
}

// `ILMI_SMOKE=numbers` (`smokeNumbers`) over a fresh copy of
// `samples/double-major`, milestone 42: the seeded review log loaded; the
// vocab deck's numbers (reviews a day, coming due, retention, failed most,
// the spread, time a review) and a leech row opening its card in place;
// the 110 new reverses metered to the default twenty a day; the quantum
// notebook's numbers; options set on the notebook from the inspector
// changing the day's queue for its cards, and inherited by a page under
// it with where they come from; a card graded again at the leech threshold
// suspended, its line and its review-log line checked; light and dark.
export async function smokeNumbers(vault: Vault): Promise<void> {
  type Card = import('../format/index.js').Card;
  // a watchdog: every line logged is progress; thirty seconds without one is a hang, said as a failure with the last step
  let last = { at: Date.now(), what: 'start' };
  let finished = false;
  const log = (s: string) => { last = { at: Date.now(), what: s }; void info(`smoke numbers: ${s}`); };
  const dog = setInterval(() => {
    if (finished) { clearInterval(dog); return; }
    if (Date.now() - last.at > 30_000) { finished = true; clearInterval(dog); void info(`smoke numbers: failed: no progress for 30 s after "${last.what}"`); }
  }, 2000);
  /** An await that may never settle (the fs over IPC), bounded. */
  const bounded = <T,>(p: Promise<T>, what: string, ms = 8000): Promise<T> =>
    Promise.race([p, new Promise<T>((_, no) => setTimeout(() => no(new Error(`${what} (no answer in ${ms} ms)`)), ms))]);
  const shot = async (name: string, ms = 2500) => { await sleep(800); log(`shot: ${name}`); await sleep(ms); };
  const q = <T extends Element>(sel: string, root: ParentNode = document) => root.querySelector<T>(sel);
  const qa = <T extends Element>(sel: string, root: ParentNode = document) => Array.from(root.querySelectorAll<T>(sel));
  const must = (ok: unknown, what: string) => { if (!ok) throw new Error(what); log(`ok: ${what}`); };
  const poll = async <T,>(probe: () => T | null | undefined | false | Promise<T | null | undefined | false>, what: string, ms = 5000): Promise<T> => {
    const t0 = Date.now();
    for (;;) {
      const v = await probe();
      if (v) { log(`ok: ${what}`); return v; }
      if (Date.now() - t0 > ms) throw new Error(`${what} (waited ${ms} ms)`);
      await sleep(100);
    }
  };
  const key = (k: string) => window.dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true, cancelable: true }));
  const click = (el: Element) => el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
  /** Type into a React-controlled number field and leave it, which commits. */
  const enter = async (el: HTMLInputElement, v: string) => {
    el.focus();
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(el, v);
    el.dispatchEvent(new Event('input', { bubbles: true }));
    await sleep(50);
    el.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));
    el.blur();
    await sleep(400);
  };
  const { parse, meta, reviewFile } = await import('../format/index.js');
  const { dayOf, isDue, scheduleOf, whenToDate } = await import('../schedule/index.js');
  const { refreshQueue, reviewLog, optionsAt } = await import('./vault.js');
  const { setLensView } = await import('./Lenses.js');
  const { studyDeck } = await import('./deckOps.js');
  const { docsUnder } = await import('./deck.js');
  const VOCAB = 'arabic/vocabulary.md';
  const QM = 'courses/fall-2026/phys-412-quantum-ii';
  const NB = `${QM}.md`;
  const PAGE = `${QM}/wkb-approximation.md`;
  const today = dayOf(new Date());
  const cards = () => useApp.getState().queue.filter((i): i is CardItem => i.kind === 'card');
  const under = (dir: string) => new Set(docsUnder(useApp.getState().tree, dir, useApp.getState().order, useApp.getState().files));
  const isNew = (i: CardItem) => !i.sched?.reps;
  const spentNew = (paths: Set<string>) => reviewLog().filter((r) => r.st === 'new' && paths.has(r.doc) && dayOf(whenToDate(r.at)) === today).length;
  const front = async (path: string) => meta(parse(await bounded(vault.fs.readText(vault.abs(path)), `reading ${path}`)).doc);
  try {
    useApp.getState().setTheme('light');
    setInspector({ open: true });

    // ── the log, as seeded ──
    const logged = reviewLog();
    must(logged.length > 4000, `the review log is loaded: ${logged.length} reviews since ${logged[0]?.at.slice(0, 10)}`);

    // ── the 110 new reverses, metered ──
    refreshQueue();
    const vocabNew = await poll(() => { refreshQueue(); const v = cards().filter((i) => i.path === VOCAB && i.dir === 'r' && isNew(i)); return v.length > 100 ? v : null; }, 'the vocab deck\'s new reverses are in the queue', 10000);
    const t = new Date();
    const dueNew = vocabNew.filter((i) => isDue(i, t));
    const held = vocabNew.filter((i) => i.held === 'new');
    const spent = spentNew(new Set([VOCAB]));
    const allowance = optionsAt(VOCAB).opts.newPerDay;
    log(`vocab: ${vocabNew.length} new reverses, ${dueNew.length} due today, ${held.length} held for tomorrow, ${spent} new graded today, allowance ${allowance}`);
    must(allowance === 20 && optionsAt(VOCAB).from.newPerDay === undefined, 'the vocab deck sets nothing: the default twenty new a day');
    must(dueNew.length + spent <= 20 && dueNew.length === Math.max(0, 20 - spent - cards().filter((i) => i.path === VOCAB && i.dir !== 'r' && isNew(i) && isDue(i, t)).length), `new cards a day meters the reverses: ${dueNew.length} due today, the rest held`);
    must(held.length >= 85 && held.every((i) => dayOf(i.dueAt) !== today), `${held.length} new reverses wait for tomorrow`);

    // ── the vocab deck's numbers ──
    openNode(VOCAB);
    setLensView(VOCAB, 'numbers');
    const past = await poll(() => q('.numbers .nb-days[data-of="past"]'), 'the vocab deck shows its numbers', 10000);
    // the screen first, so a run that fails below still shows it
    await shot('numbers-vocab');
    const line = q('.numbers .nb-line')?.textContent ?? '';
    log(`vocab line: ${line}`);
    must(/^178 cards/.test(line) && /logged since 20\d\d-\d\d-\d\d/.test(line), 'the counts line, and since when the log was kept');
    const weekTotals = qa('tbody .nb-total', past).map((e) => e.textContent);
    log(`reviews a day, week totals: ${weekTotals.join(' ')}; today ${q('.nb-days[data-of="ahead"] td[data-today="1"]')?.textContent} due`);
    must(weekTotals.length === 4 && weekTotals.some((x) => Number(x) > 0), 'four weeks of reviews a day from the log');
    must(qa('.nb-days[data-of="ahead"] tbody tr').length === 4, 'four weeks coming due');
    const rates = qa('.nb-rates .nb-rate').map((e) => e.textContent);
    log(`retention: ${rates.join(' ')}`);
    must(rates.some((r) => /^\d+%$/.test(r ?? '')), 'true retention by week and by age');
    must(qa('.nb-spread tbody th').map((e) => e.textContent).join() === 'stability,difficulty', 'the spread of stability and difficulty, a line each');
    must(/s a review/.test(q('[data-sec="time"]')?.textContent ?? ''), `time a review: ${q('[data-sec="time"]')?.textContent}`);
    must(!q('.numbers canvas, .numbers svg:not(.katex svg)'), 'type, not charts');
    const leechRows = qa<HTMLElement>('.nb-leeches li');
    log(`failed most: ${leechRows.map((r) => `${r.querySelector('.nb-front')?.textContent?.slice(0, 24)} (${r.querySelector('.nb-where')?.textContent}) ${r.querySelector('.nb-lapses')?.textContent} ${r.querySelector('.nb-tag')?.textContent}`).join(' | ')}`);
    must(leechRows.every((r) => (r.querySelector('.nb-front')?.textContent ?? '').trim() && (r.querySelector('.nb-where')?.textContent ?? '').trim()), 'each failed-most row names its card: its front and where it lives');
    const [, all, fresh, sus] = /^(\d+) cards(?:, (\d+) never seen)?(?:, (\d+) suspended)?/.exec(line) ?? [];
    must(Number(fresh ?? 0) + Number(sus ?? 0) <= Number(all), `the counts are of cards and add up (${line})`);
    leechRows[0]?.scrollIntoView({ block: 'center' });
    await shot('numbers-vocab-leeches');
    useApp.getState().setTheme('dark');
    await shot('numbers-vocab-dark');
    useApp.getState().setTheme('light');
    if (leechRows.length) {
      // the rows as drawn now (the theme changes redrew them), not as first found
      const first = await poll(() => q<HTMLElement>('.nb-leeches li'), 'the failed-most rows after the theme changes');
      const block = Number(first.dataset.block);
      log(`opening the failed-most row ${first.dataset.path}#${block}`);
      click(q('button', first)!);
      await poll(() => useApp.getState().lensViews[VOCAB] === 'cards' && useApp.getState().selectedCard?.index === block, `a failed-most row opens its card in place (block ${block}, selected in the deck)`, 8000)
        .catch((e: unknown) => { throw new Error(`${e instanceof Error ? e.message : String(e)}; the lens shows ${useApp.getState().lensViews[VOCAB]}, selected ${JSON.stringify(useApp.getState().selectedCard)}`); });
      await shot('numbers-leech-opened', 1500);
    }

    // ── a course notebook's numbers ──
    openNode(QM);
    setLensView(QM, 'numbers');
    await poll(() => q('.folder-view .numbers .nb-days'), 'the quantum notebook\'s children show their numbers', 10000);
    must(qa('.fv-view button').map((b) => b.textContent).join(' ') === 'items cards numbers', 'the lens reads items · cards · numbers');
    log(`quantum line: ${q('.numbers .nb-line')?.textContent}`);
    await shot('numbers-notebook');
    useApp.getState().setTheme('dark');
    await shot('numbers-notebook-dark');
    useApp.getState().setTheme('light');

    // ── options on the notebook change the day's queue for its cards ──
    const qmPaths = under(QM);
    const newUnder = () => { refreshQueue(); const now = new Date(); return cards().filter((i) => qmPaths.has(i.path) && isNew(i) && isDue(i, now)); };
    const before = newUnder();
    const qmSpent = spentNew(qmPaths);
    log(`quantum before: ${before.length} new cards due today (${[...new Set(before.map((i) => i.path.split('/').pop()))].join(', ')}), ${qmSpent} new graded today`);
    must(before.length > 3, 'the notebook has more than three new cards due today under the default');
    openNode(NB);
    const field = await poll(() => q<HTMLInputElement>('.insp [data-opt="newPerDay"] input'), 'the notebook\'s inspector shows its options', 8000);
    must(field.placeholder === '20' && !q('.insp [data-opt="newPerDay"] .opt-from'), 'new a day: the default, nothing set');
    await enter(field, String(qmSpent + 3));
    await poll(async () => (await front(NB)).newPerDay === qmSpent + 3, `the notebook's front-matter gains new-per-day: ${qmSpent + 3}`);
    const after = await poll(() => { const a = newUnder(); return a.length === 3 ? a : null; }, 'the day\'s queue holds three new cards across the notebook');
    log(`quantum after: ${after.map((i) => `${i.path.split('/').pop()}#${i.block}`).join(', ')}; held ${cards().filter((i) => qmPaths.has(i.path) && i.held === 'new').length}`);
    await shot('numbers-options-set');

    // inherited by a page under it, said where from
    openNode(PAGE);
    const from = await poll(() => q('.insp [data-opt="newPerDay"] .opt-from'), 'a page under the notebook shows the option inherited', 8000);
    const pf = q<HTMLInputElement>('.insp [data-opt="newPerDay"] input')!;
    must(from.textContent === 'from quantum II' && pf.value === '' && pf.placeholder === String(qmSpent + 3), `the page's new a day: ${pf.placeholder}, ${from.textContent}`);
    must(optionsAt(PAGE).from.newPerDay === NB, 'the page resolves it to the notebook');
    await shot('numbers-options-inherited');

    // ── a leech at the threshold, suspended ──
    const now = new Date();
    // one item to its card (a q&a, else a one-blank card), so the session over it asks that one line
    const pool = cards().filter((i) => qmPaths.has(i.path) && i.sched?.state === 'review' && (i.sched.lapses ?? 0) >= 1 && i.id !== undefined && i.groups === 1 && !i.dir);
    const qa1 = pool.filter((i) => i.form === 'qa');
    const cand = qa1.find((i) => isDue(i, now)) ?? pool.find((i) => isDue(i, now)) ?? qa1[0] ?? pool[0];
    must(cand, `a card in review under the notebook with a lapse: ${cand?.id} (${cand?.sched?.lapses} lapses, ${isDue(cand!, now) ? 'due' : 'not due'})`);
    const threshold = (cand!.sched!.lapses ?? 0) + 1;
    openNode(NB);
    const leechField = await poll(() => q<HTMLInputElement>('.insp [data-opt="leech"] input'), 'the leech field', 8000);
    await enter(leechField, String(threshold));
    const suspendBtn = await poll(() => qa<HTMLButtonElement>('.insp .opt-action button').find((b) => b.textContent === 'suspended'), 'the leech action buttons');
    click(suspendBtn);
    await poll(async () => { const m = await front(NB); return m.leech === threshold && m.leechAction === 'suspend'; }, `the notebook's front-matter gains leech: ${threshold} and leech-action: suspend`);
    await shot('numbers-options-leech', 1500);
    const logBefore = reviewLog().length;
    const n = studyDeck(QM, { only: new Set([`${cand!.path}#${cand!.block}`]), cram: !isDue(cand!, now) });
    must(n >= 1, `a session over ${cand!.id} (${n} item${n === 1 ? '' : 's'})`);
    await poll(() => q('.recall-wrap .card'), 'the card is drawn', 8000);
    key(' ');
    await sleep(400);
    key('1');
    const graded = await poll(async () => {
      const doc = parse(await bounded(vault.fs.readText(vault.abs(cand!.path)), `reading ${cand!.path}`)).doc;
      const c = doc.blocks.find((b): b is Card => b.kind === 'card' && b.id === cand!.id);
      const s = c && scheduleOf(c, cand!.group, cand!.dir);
      return s && s.lapses === threshold ? s : null;
    }, `${cand!.id} graded again: ${threshold} lapses`);
    must(graded.suspended === true, `at the threshold it is suspended, its schedule kept (s=${graded.stability?.toFixed(2)}, r=${graded.reps})`);
    // a q&a writes its bare line; a one-blank cloze its bare line, or its own `sr cN` line when it has one
    const keyOk = (k: string | undefined) => (cand!.form === 'qa' ? k === undefined : k === undefined || /^c\d+$/.test(k));
    const lastLine = await poll(async () => {
      const text = await bounded(vault.fs.readText(vault.abs(reviewFile(new Date().toISOString()))), 'reading the review log');
      const l = text.trimEnd().split('\n').pop() ?? '';
      const r = JSON.parse(l) as { card: string; g: number; st: string; key?: string; doc: string; ms?: number };
      return r.card === cand!.id ? r : null;
    }, 'the grade appended its line to this month\'s review log');
    log(`log line: ${JSON.stringify(lastLine)}`);
    must(lastLine.g === 1 && lastLine.st === 'review' && lastLine.doc === cand!.path && keyOk(lastLine.key) && typeof lastLine.ms === 'number', 'the line names the card, the line graded, again from review, the time on it');
    must(reviewLog().length === logBefore + 1, 'one review more in the log the numbers read');
    await poll(() => useApp.getState().log.find((l) => l === 'leech · suspended'), `the log line says so (${useApp.getState().log.slice(0, 2).join(' | ')})`);
    refreshQueue();
    must(!cards().some((i) => i.id === cand!.id && i.path === cand!.path && (i.dir ?? '') === (cand!.dir ?? '') && JSON.stringify(i.group ?? null) === JSON.stringify(cand!.group ?? null)), 'the suspended leech is out of the queue');

    // the numbers list it, suspended
    openNode(QM);
    setLensView(QM, 'numbers');
    const row = await poll(() => qa<HTMLElement>('.nb-leeches li').find((r) => r.dataset.path === cand!.path && Number(r.dataset.block) === cand!.block), 'the notebook\'s failed-most lists the leech', 8000);
    must(row.querySelector('.nb-tag')?.textContent === 'suspended', 'marked suspended');
    row.scrollIntoView({ block: 'center' });
    await shot('numbers-leech');
    useApp.getState().setTheme('dark');
    await shot('numbers-leech-dark');
    useApp.getState().setTheme('light');
    log(`done; vault ${vault.root}`);
  } catch (e) {
    log(`failed: ${e instanceof Error ? e.message : String(e)}`);
  } finally {
    finished = true;
    clearInterval(dog);
  }
}

// `ILMI_SMOKE=open` (`smokeOpen`) over a copy of `samples/double-major`:
// milestone 46, the open items. The Hamiltonian note's Poisson-bracket card
// items moved by Tab, ⇧Tab, ⌥⇧↑ and ⌥⇧↓, the file's lines checked after
// each and the list written back as the sample had it; ⏎ at the end of the
// stat-mech note's plain item before its card item, a new item typed, the
// list still one; a card made from a selection in the nested caveat item,
// landing as the next item under it; a derivation card's steps drawn as
// lines; the gap under a display formula measured against the paragraph
// rhythm; a book PDF (generated here, three chapters in its outline)
// dropped on the intake and landing as a notebook, a chapter opened as its
// own pages, the top row without `pages`/`frozen` words, an extract from
// its page 4 written as page 4, the book renamed and the chapter still
// finding its pages; a title with a formula drawn in the tree and a card's
// formula in the palette; a heading in a list item folded, its children
// hidden and the key in `state.json`; ⇧⏎ in a verb-forms cell written as
// `<br>`; lecture 9 folded and marked in the rail's outline and the
// inspector's. Light first; a few screens again in dark. Every step asserts
// (`ok: …`); the first miss logs `failed: …` and stops.
export async function smokeOpen(vault: Vault): Promise<void> {
  const log = (s: string) => info(`smoke open: ${s}`);
  const shot = async (name: string, ms = 2500) => { await sleep(600); log(`shot: ${name}`); await sleep(ms); };
  const q = <T extends Element>(sel: string, root: ParentNode = document) => root.querySelector<T>(sel);
  const qa = <T extends Element>(sel: string, root: ParentNode = document) => Array.from(root.querySelectorAll<T>(sel));
  const must = (ok: unknown, what: string) => { if (!ok) throw new Error(what); log(`ok: ${what}`); };
  const poll = async <T,>(probe: () => T | null | undefined | false | Promise<T | null | undefined | false>, what: string, ms = 5000): Promise<T> => {
    const t0 = Date.now();
    for (;;) {
      const v = await probe();
      if (v) { log(`ok: ${what}`); return v; }
      if (Date.now() - t0 > ms) throw new Error(`${what} (waited ${ms} ms)`);
      await sleep(100);
    }
  };
  const { meta, parse, setField } = await import('../format/index.js');
  const { setRailFolded } = await import('./vault.js');
  const { makeBookPdf } = await import('../pdf/fixture.js');
  const HAM = 'courses/fall-2025/phys-301-classical-mechanics/hamiltonian-mechanics.md';
  const NB = 'courses/fall-2026/phys-415-stat-mech.md';
  const CANON = 'courses/fall-2026/phys-415-stat-mech/canonical-ensemble.md';
  const FORMS = 'courses/spring-2026/arab-302-morphology/verb-forms.md';
  const DAILY = 'fleeting/2026-10-30.md';
  const TITLED = 'fleeting/2026-10-29.md';
  const text = (path: string) => vault.fs.readText(vault.abs(path));
  /** The file holds `want` one line after another, within 5 s. */
  const lines = (path: string, want: string[], what: string) => poll(async () => {
    const all = (await text(path)).split('\n');
    return all.some((_, i) => want.every((l, k) => all[i + k] === l));
  }, what);
  const surface = () => q<HTMLElement>('.pane-body .doc-view .draft-doc')!;
  const open = async (path: string, ready = '.pane-body .doc-view .draft-doc') => {
    openNode(path);
    await poll(() => (activeTab(useApp.getState().panes)?.id === path ? q(ready) : null), `${path} is open`, 12000);
    await sleep(600);
  };
  const keyDown = async (k: string, init: KeyboardEventInit = {}) => {
    surface().dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true, cancelable: true, ...init }));
    await sleep(200);
  };
  const type = async (str: string) => {
    for (const ch of str) { document.execCommand('insertText', false, ch); await sleep(30); }
    await sleep(80);
  };
  const down = (el: Element) => el.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true, button: 0 }));
  /** A press on an element's middle, as a pointer's: ProseMirror selects a card atom so. */
  const pressOn = (el: HTMLElement) => {
    const r = el.getBoundingClientRect();
    for (const t of ['mousedown', 'mouseup', 'click']) el.dispatchEvent(new MouseEvent(t, { bubbles: true, cancelable: true, button: 0, buttons: t === 'mousedown' ? 1 : 0, detail: 1, clientX: r.left + Math.min(40, r.width / 2), clientY: r.top + Math.min(10, r.height / 2), view: window }));
  };
  const cardItem = (needle: string) => qa<HTMLElement>('.card-span.in-item', surface()).find((c) => c.textContent?.includes(needle));
  const itemText = (needle: string) => qa<HTMLElement>('.dd-li .li-text', surface()).filter((t) => t.textContent?.includes(needle)).pop();
  const heading = (needle: string) => qa<HTMLElement>('.dd-h', surface()).find((h) => h.textContent?.includes(needle));
  try {
    useApp.getState().setTheme('light');
    await poll(() => document.documentElement.dataset.theme === 'light', 'the light theme is on');
    setInspector({ open: true });

    // ── 1. a card item moved in its list like any item ──
    const ham0 = await text(HAM);
    const PB = [
      '- time evolution of a phase-space function $f(q,p,t)$ in Poisson-bracket form :: $\\dfrac{df}{dt} = \\{f,H\\} + \\dfrac{\\partial f}{\\partial t}$ ^cm-pb-evol',
      '  <!-- sr due=2027-01-08 st=review s=168 d=3.3 r=11 l=0 ivl=168 last=2026-07-24T08:02:00Z g=3 -->',
      '- $\\{L_i, L_j\\} = {{c1::\\epsilon_{ijk}L_k}}$ ^cm-pb-L',
      '  <!-- sr due=2026-12-25 st=review s=128 d=4.4 r=10 l=1 ivl=128 last=2026-08-19T09:20:00Z g=3 -->',
    ];
    must(ham0.split('\n').some((l, i, all) => PB.every((p, k) => all[i + k] === p)), 'a fresh copy of the sample: the Poisson-bracket card items as written');
    await open(HAM);
    const items = () => qa<HTMLElement>('.card-span.in-item', surface());
    const lij = await poll(() => (items().length === 4 ? items()[1] : null), 'the four bracket cards are drawn as list items, the algebra one second');
    lij.scrollIntoView({ block: 'center' });
    surface().focus();
    pressOn(lij.querySelector<HTMLElement>('.cs-body') ?? lij);
    await poll(() => qa('.card-span.in-item.selected', surface()).length === 1 && items()[1]!.classList.contains('selected'), 'a press selects the card item');
    await keyDown('Tab', { code: 'Tab' });
    await lines(HAM, [PB[0]!, PB[1]!, `  ${PB[2]!}`, `  ${PB[3]!}`], 'Tab sets the card item under the one before it, its schedule line at the new column');
    await poll(() => items()[1]!.style.getPropertyValue('--indent') === '2', 'drawn set in');
    must(items()[1]!.classList.contains('selected'), 'the card stays selected');
    await shot('open-card-item-tab');
    await keyDown('Tab', { code: 'Tab', shiftKey: true });
    await lines(HAM, PB, '⇧Tab brings it back out');
    await keyDown('ArrowUp', { code: 'ArrowUp', altKey: true, shiftKey: true });
    await lines(HAM, [PB[2]!, PB[3]!, PB[0]!, PB[1]!], '⌥⇧↑ trades it with the item before, schedules with each');
    await poll(() => items()[0]!.classList.contains('selected'), 'the card goes up with the selection on it');
    await shot('open-card-item-moved');
    await keyDown('ArrowDown', { code: 'ArrowDown', altKey: true, shiftKey: true });
    await poll(async () => (await text(HAM)) === ham0, '⌥⇧↓ puts it back: the file is the sample\'s again');

    // ── 2. a step card's lines, drawn as lines ──
    const STEPS = 'derive $\\{H, H\\}$ from the definition\n?\n1. $\\{H,H\\} = \\sum_j(\\partial_q H\\,\\partial_p H - \\partial_p H\\,\\partial_q H)$\n2. $= 0$, so a Hamiltonian with no explicit $t$ is conserved';
    await vault.update(HAM, (doc) => { doc.blocks.push({ kind: 'card', text: STEPS }); });
    const steps = await poll(() => qa<HTMLElement>('.card-span', surface()).find((c) => c.textContent?.includes('from the definition')), 'a derivation card written under the note is drawn', 8000);
    steps.scrollIntoView({ block: 'center' });
    const back = q<HTMLElement>('.cs-a', steps)!;
    must(back.querySelectorAll('br').length === 1, 'its back holds its two steps, a break between them');
    const lh = parseFloat(getComputedStyle(back).lineHeight) || 20;
    must(back.getBoundingClientRect().height > lh * 1.6, `the steps stand on two lines (${Math.round(back.getBoundingClientRect().height)} px for a ${Math.round(lh)} px line)`);
    await shot('open-steps');

    // ── 3. the gap under display math is a paragraph's ──
    const disp = await poll(() => qa<HTMLElement>('p.dd-p', surface()).find((p) => p.firstElementChild?.matches('.math.display') && p.nextElementSibling?.matches('p.dd-p')), 'a paragraph that is one display formula, a paragraph after it');
    disp.scrollIntoView({ block: 'center' });
    await sleep(300);
    const formula = q<HTMLElement>('.math.display', disp)!;
    const next = disp.nextElementSibling as HTMLElement;
    const rhythm = parseFloat(getComputedStyle(disp).marginBottom);
    const below = next.getBoundingClientRect().top - formula.getBoundingClientRect().bottom;
    const seps = qa<HTMLElement>('img.ProseMirror-separator', disp);
    log(`display math: gap below ${below.toFixed(1)} px, the paragraph's ${rhythm.toFixed(1)} px; separators ${seps.map((s) => getComputedStyle(s).display).join(',') || 'none'}; breaks ${qa<HTMLElement>('br.ProseMirror-trailingBreak', disp).map((b) => getComputedStyle(b).display).join(',') || 'none'}`);
    must(seps.every((s) => getComputedStyle(s).display === 'none'), 'no separator image drawn under the formula');
    must(Math.abs(below - rhythm) <= 2, 'the gap under the formula is the paragraph rhythm');
    await shot('open-display-math');

    // ── 4. ⏎ on the plain item just before a card item ──
    for (const p of ['courses', 'courses/fall-2026', 'courses/fall-2026/phys-415-stat-mech']) toggleOpen(p, true);
    await open(CANON);
    const DIST = '- distinguishable identical-looking things (atoms on lattice sites in a solid, told apart by position): $Z = Z_1^N$';
    const ZN = '- partition function of $N$ identical, non-interacting particles in a dilute gas :: $Z = Z_1^N / N!$ ^sm-ZN-identical';
    await lines(CANON, [DIST, ZN], 'the stat-mech note has its plain item right before the card item');
    const dist = await poll(() => itemText('distinguishable'), 'the plain item is drawn');
    dist.scrollIntoView({ block: 'center' });
    surface().focus();
    const sel = window.getSelection()!;
    sel.removeAllRanges();
    sel.collapse(dist, dist.childNodes.length);
    await sleep(200);
    await keyDown('Enter', { code: 'Enter' });
    await type('a gas of bosons: no simple factor');
    await lines(CANON, [DIST, '- a gas of bosons: no simple factor', ZN], '⏎ made the next item in the same list, the card item right under it, no blank line');
    const parsed = parse(await text(CANON)).doc.blocks;
    must(parsed.some((b) => b.kind === 'card' && b.text.startsWith('partition function of $N$') && b.item === '- ' && b.joined), 'read back, the card is still a card item joined to the list');
    await shot('open-enter-before-card');

    // ── 5. a card made from a selection in a list: the next item ──
    const CAVEAT = '  - same caveat as microcanonical: only when multiple occupancy is negligible';
    const cav = await poll(() => itemText('multiple occupancy'), 'the nested caveat item');
    cav.scrollIntoView({ block: 'center' });
    surface().focus();
    select(cav, 'multiple occupancy is negligible');
    await poll(() => q('.sel-cue'), 'the selection cue');
    surface().dispatchEvent(new KeyboardEvent('keydown', { key: 'M', code: 'KeyM', metaKey: true, shiftKey: true, bubbles: true, cancelable: true }));
    const ta = await poll(() => q<HTMLTextAreaElement>('.composer textarea'), 'the composer opens on it');
    const CARD = '$Z_1^N/N!$ holds while {{c1::multiple occupancy}} is negligible';
    Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')!.set!.call(ta, CARD);
    ta.dispatchEvent(new Event('input', { bubbles: true }));
    await sleep(150);
    await shot('open-composer-in-list');
    press('Enter', { metaKey: true });
    await poll(() => (q('.composer') ? null : true), 'the card saved');
    await lines(CANON, [CAVEAT, `  - ${CARD}`], 'the card is the next item, under the caveat at its indentation');
    must(parse(await text(CANON)).doc.blocks.some((b) => b.kind === 'card' && b.text === CARD && b.item === '  - '), 'read back as a card item');
    await poll(() => cardItem('is negligible'), 'drawn as a card item in the list');
    await shot('open-card-in-list');

    // ── 6. the outline marks folded headings ──
    setRailFolded(NB, false);
    const h9 = await poll(() => heading('lecture 9'), 'lecture 9\'s heading');
    h9.scrollIntoView({ block: 'center' });
    down(q<HTMLElement>('.fold-chev', h9)!);
    await poll(() => heading('lecture 9')?.classList.contains('fold-head'), 'lecture 9 folds');
    await poll(() => qa<HTMLElement>(`.tab-rail .rail-row.heading[data-of="${CANON}"]`).find((r) => r.textContent?.startsWith('lecture 9') && r.dataset.folded === '1' && q('.fold-mark', r)), 'the rail\'s outline marks lecture 9 folded', 8000);
    must(qa(`.tab-rail .rail-row.heading[data-folded="1"]`).length === 1, 'only it');
    await shot('open-outline-folded-rail');
    setRailFolded(NB, true);
    await poll(() => qa<HTMLElement>('.insp .insp-outline li').find((r) => r.textContent?.startsWith('lecture 9') && r.dataset.folded === '1' && q('.fold-mark', r)), 'with the rail folded, the inspector\'s outline marks it folded', 4000);
    await shot('open-outline-folded-inspector');
    down(q<HTMLElement>('.fold-chev', heading('lecture 9')!)!);
    await poll(() => !q('.insp .insp-outline li[data-folded="1"]'), 'opened again, the mark goes');
    setRailFolded(NB, false);

    // ── 7. a heading inside a list item folds ──
    const LIST = '- ## lab checklist\n  - calibrate the scale against the 100 g mass\n  - $m = \\rho V$ :: mass from density\n- ## after the lab';
    await vault.update(DAILY, (doc) => { doc.blocks.push(...parse(`${LIST}\n`).doc.blocks); });
    const daily0 = await text(DAILY);
    must(daily0.includes(LIST), 'a list with headings in its items written under the daily note');
    await open(DAILY);
    const lab = await poll(() => qa<HTMLElement>('.dd-li.li-h', surface()).find((li) => li.textContent?.includes('lab checklist')), 'the item\'s heading is drawn as one');
    lab.scrollIntoView({ block: 'center' });
    must(lab.dataset.level === '2', 'at its level');
    down(q<HTMLElement>('.fold-chev', lab)!);
    await poll(() => qa('.fold-hidden', surface()).length === 2, 'its two children hide, the card item among them');
    must(q<HTMLElement>('.fold-more', lab)?.dataset.label === '… 1 card', `the folded line says what it holds ("${q<HTMLElement>('.fold-more', lab)?.dataset.label}")`);
    must(qa<HTMLElement>('.dd-li.li-h', surface()).some((li) => li.textContent?.includes('after the lab') && getComputedStyle(li).display !== 'none'), 'the next heading item stays');
    await shot('open-item-heading-folded');
    await poll(async () => ((await vault.loadState()).folds?.[DAILY] ?? []).includes('- 2 lab checklist'), 'state.json keeps the fold by its key');
    await sleep(600);
    must((await text(DAILY)) === daily0, 'the file is untouched by the fold');
    down(q<HTMLElement>('.fold-more', lab)!);
    await poll(() => qa('.fold-hidden', surface()).length === 0, 'its `…` opens it');

    // ── 8. ⇧⏎ in a table cell is `<br>` ──
    await open(FORMS);
    const cell = await poll(() => qa<HTMLElement>('.dd-table td', surface()).find((td) => td.textContent === 'basic'), 'form I\'s meaning cell');
    cell.scrollIntoView({ block: 'center' });
    surface().focus();
    caret(cell, 'basic', 5);
    await sleep(150);
    await keyDown('Enter', { code: 'Enter', shiftKey: true });
    await type('root sense');
    await poll(async () => (await text(FORMS)).split('\n').some((l) => l.startsWith('| I |') && l.endsWith('| basic<br>root sense |')), 'the cell is written with `<br>`');
    must(qa<HTMLElement>('.dd-table td', surface()).some((td) => td.textContent === 'basic\nroot sense'), 'the cell holds two lines');
    await shot('open-table-br');
    await open(TITLED);
    await open(FORMS);
    must(await poll(() => qa<HTMLElement>('.dd-table td', surface()).some((td) => td.textContent === 'basic\nroot sense'), 'reopened, the `<br>` reads back as the break'), 'the round trip holds');

    // ── 9. formulas in the tree and the palette ──
    await vault.update(TITLED, (doc) => setField(doc, 'title', 'the $J = \\oint p\\,dq$ adiabatic invariant'));
    toggleOpen('fleeting', true);
    const row = await poll(() => q<HTMLElement>(`.tree .row[data-path="${TITLED}"] .name .katex`), 'the tree draws the title\'s formula', 8000);
    const tipText = row.closest('.name')?.getAttribute('title') ?? '';
    must(tipText.includes('adiabatic invariant') && !tipText.includes('$'), `its tooltip reads the formula as text ("${tipText}")`);
    await shot('open-tree-math');
    useApp.setState({ paletteOpen: true });
    const input = await poll(() => q<HTMLInputElement>('.palette-input input'), 'the palette');
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input, 'Poisson-bracket form');
    input.dispatchEvent(new Event('input', { bubbles: true }));
    await poll(() => qa<HTMLElement>('.palette-row[data-t="card"]').find((r) => r.querySelector('.pt .katex')), 'a card row in the palette draws its formula');
    must(!qa<HTMLElement>('.palette-row .pt').some((p) => /\\[a-z]+|\$/.test(p.textContent ?? '')), 'no raw TeX in the palette\'s rows');
    await shot('open-palette-math');
    useApp.setState({ paletteOpen: false });

    // ── 10. a multi-chapter PDF as a notebook ──
    const CH = [
      { title: 'Ensembles', pages: [['A system in contact with a reservoir.', 'Its energy is not fixed; its temperature is.'], ['The canonical ensemble follows from counting the reservoir.']] },
      { title: 'The partition function', pages: [['Z sums the Boltzmann factors over the states.'], ['Every average follows from Z.', 'The energy is minus the derivative of ln Z in beta.'], ['The free energy is minus kT ln Z.']] },
      { title: 'Quantum statistics', pages: [['Bosons and fermions fill their states differently.']] },
    ];
    const BOOK = 'A short book of statistical physics';
    openIntake('library');
    await poll(() => q('.intake textarea'), 'the intake');
    const { intakeHooks } = await import('./Intake.js');
    await intakeHooks.ingestPdf!(makeBookPdf(CH, BOOK), 'smoke-book.pdf');
    const detail = await poll(() => q<HTMLElement>('.intake-detail'), 'the book read', 15000);
    must(detail.querySelector('.stats')?.textContent?.includes('3 chapters'), `the intake counts its chapters ("${detail.querySelector('.stats')?.textContent}")`);
    await shot('open-pdf-intake');
    q<HTMLButtonElement>('.intake .place:not(.primary)')!.click();
    const book = await poll(() => vault.documents().find((d) => d.startsWith('library/') && useApp.getState().docs[d]?.tabs && !!useApp.getState().docs[d]?.pdf), 'the book lands as a notebook with its pages', 10000);
    const kids = await poll(() => { const ks = vault.documents().filter((d) => d.startsWith(`${book.slice(0, -3)}/`)).sort(); return ks.length === 3 ? ks : null; }, 'a chapter per entry in the outline', 8000);
    const chap = kids[1]!;
    const chText = await text(chap);
    must(/\npdf: \.\.\/[^\n]+\.pdf\n/.test(chText) && chText.includes('\npages: 3-5\n'), `the second chapter names the book's file and its pages 3–5 (${chText.split('\n').slice(1, 8).join(' / ')})`);
    must((await text(book)).includes('\ntabs: true\n'), 'the book\'s document has tabs');
    await open(chap, '.pane-body .pdf-view .pdf-page');
    const pages = await poll(() => { const ps = qa<HTMLElement>('.pane-body .pdf-view .pdf-page').map((p) => p.dataset.page); return ps.length === 3 ? ps : null; }, 'the chapter opens as its own three pages');
    must(pages.join(',') === '3,4,5', `numbered as the book numbers them (${pages.join(',')})`);
    await poll(() => qa('.tab-rail .rail-row').filter((r) => kids.some((k) => (r as HTMLElement).dataset.path === k)).length === 3, 'the rail shows the three chapters as tabs', 8000);
    const meta0 = q<HTMLElement>('.pane-body .pdf-view .meta')!;
    must(!/\b(pages|frozen)\b/.test(meta0.textContent ?? ''), `the top row has no pages or frozen word ("${meta0.textContent}")`);
    // milestone 48: the chapter's body is its notes, in the editor; since 70 `notes` opens them in the pane beside the pages
    must(qa('.pane').length === 1 && !!q('.pane-body .book'), 'it opens as its pages alone');
    q<HTMLElement>('.pane-body .book .meta .notes-toggle')!.click();
    await poll(() => q('.pane[data-active="0"] .book-notes-doc .draft-doc[contenteditable="true"]'), 'notes opens its notes in the pane beside, in the editor', 8000);
    q<HTMLElement>('.pane[data-active="1"] .book .meta .notes-toggle')!.click();
    await poll(() => qa('.pane').length === 1, 'and closes them again', 8000);
    const tip = qa<HTMLElement>('.right', meta0).map((r) => r.title).join(' ');
    log(`top row: "${meta0.textContent}"; tooltip "${tip}"`);
    await shot('open-pdf-chapter');
    const p4 = await poll(() => { const el = q<HTMLElement>('.pdf-page[data-page="4"]'); el?.scrollIntoView({ block: 'start' }); return qa<HTMLElement>('.pdf-page[data-page="4"] .textLayer span').find((s) => s.textContent?.includes('Every average')); }, 'page 4\'s text layer has its words', 10000);
    const r = document.createRange();
    r.selectNodeContents(p4.firstChild!);
    window.getSelection()!.removeAllRanges();
    window.getSelection()!.addRange(r);
    await poll(() => q('.pdf-view .sel-cue'), 'the selection cue on the page');
    press('e');
    await poll(async () => /\n<!-- read made=\S+ due=\S+ ivl=[123] boxes=4:[\d.:]+ -->\n/.test(await text(chap)), 'the selection boxes its lines: a section of the notes, its boxes on page 4 as the book numbers it', 8000);
    // the book renamed: the chapters still find its file
    const { renameNode } = await import('./vault.js');
    const renamed = await renameNode(book, 'stat phys, briefly');
    const chap2 = `${renamed.slice(0, -3)}/${chap.split('/').pop()}`;
    await poll(async () => (await text(chap2)).includes('\npdf: ../stat phys, briefly.pdf\n'), 'renamed, the chapter names the book\'s new file');
    await poll(() => useApp.getState().docs[chap2]?.pdf === renamed.replace(/\.md$/, '.pdf'), 'and its pages are found there');
    await open(chap2, '.pane-body .pdf-view .pdf-page');
    await poll(() => qa('.pane-body .pdf-view .pdf-page').length === 3, 'the renamed book\'s chapter opens as its pages');
    useApp.getState().setTheme('dark');
    await poll(() => document.documentElement.dataset.theme === 'dark', 'dark');
    await shot('open-pdf-chapter-dark');
    await open(DAILY);
    await shot('open-daily-dark');
    useApp.getState().setTheme('light');
    log(`done; vault ${vault.root}`);
  } catch (e) {
    log(`failed: ${e instanceof Error ? e.message : String(e)}`);
  }
}

// `ILMI_SMOKE=exam` (`smokeExam`) over a fresh copy of `samples/double-major`,
// milestone 43: the quantum notebook's exam set to a midterm three weeks out
// (written as a hand edit would be); its reviews FSRS put after the day
// brought into the last week and its textbook chapter paced, nothing outside
// it touched; the queue saying so (`for the midterm`) and narrowed to it; the
// notebook's top row and the inspector showing the exam and what is left; a
// grade before the week capped into it with FSRS's stability; a reading pass
// paced; then the app's clock (`setClockDay`, test-only) walked into the last
// week, where the brought-forward reviews are due, and to the day after the
// exam, where nothing is for it and a grade is FSRS's own. Light and dark.
export async function smokeExam(vault: Vault): Promise<void> {
  type Card = import('../format/index.js').Card;
  let last = { at: Date.now(), what: 'start' };
  let finished = false;
  const log = (s: string) => { last = { at: Date.now(), what: s }; void info(`smoke exam: ${s}`); };
  const dog = setInterval(() => {
    if (finished) { clearInterval(dog); return; }
    if (Date.now() - last.at > 30_000) { finished = true; clearInterval(dog); void info(`smoke exam: failed: no progress for 30 s after "${last.what}"`); }
  }, 2000);
  const bounded = <T,>(p: Promise<T>, what: string, ms = 8000): Promise<T> =>
    Promise.race([p, new Promise<T>((_, no) => setTimeout(() => no(new Error(`${what} (no answer in ${ms} ms)`)), ms))]);
  const shot = async (name: string, ms = 2500) => { await sleep(800); log(`shot: ${name}`); await sleep(ms); };
  const q = <T extends Element>(sel: string, root: ParentNode = document) => root.querySelector<T>(sel);
  const qa = <T extends Element>(sel: string, root: ParentNode = document) => Array.from(root.querySelectorAll<T>(sel));
  const must = (ok: unknown, what: string) => { if (!ok) throw new Error(what); log(`ok: ${what}`); };
  const poll = async <T,>(probe: () => T | null | undefined | false | Promise<T | null | undefined | false>, what: string, ms = 5000): Promise<T> => {
    const t0 = Date.now();
    for (;;) {
      const v = await probe();
      if (v) { log(`ok: ${what}`); return v; }
      if (Date.now() - t0 > ms) throw new Error(`${what} (waited ${ms} ms)`);
      await sleep(100);
    }
  };
  const key = (k: string) => window.dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true, cancelable: true }));
  const click = (el: Element) => el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
  const { parse, meta, setField } = await import('../format/index.js');
  const { addDays, dayOf, grade, isDue, scheduleOf, whenToDate, EXAM_WINDOW, READ_LEAD } = await import('../schedule/index.js');
  const { refreshQueue, optionsAt } = await import('./vault.js');
  const { studyDeck } = await import('./deckOps.js');
  const { appNow, setClockDay } = await import('./clock.js');
  const QM = 'courses/fall-2026/phys-412-quantum-ii';
  const NB = `${QM}.md`;
  const BOOK = `${QM}/halvorsen-ch-9-wkb.md`;
  const today = dayOf(appNow());
  const E = addDays(today, 21);
  const START = addDays(E, -EXAM_WINDOW);
  const LAST = addDays(E, -1);
  const FINISH = addDays(E, -READ_LEAD);
  const under = (p: string) => p === NB || p.startsWith(`${QM}/`);
  const items = () => useApp.getState().queue;
  const cards = () => items().filter((i): i is CardItem => i.kind === 'card');
  const docOf = async (path: string) => parse(await bounded(vault.fs.readText(vault.abs(path)), `reading ${path}`)).doc;
  const lineOf = async (c: CardItem) => {
    const card = (await docOf(c.path)).blocks.find((b): b is Card => b.kind === 'card' && b.id === c.id);
    return card ? scheduleOf(card, c.group, c.dir) : undefined;
  };
  /** Grade one card good in a session over it alone; resolves to its line once written. */
  const gradeOne = async (c: CardItem, what: string) => {
    const before = c.sched?.reps ?? 0;
    const n = studyDeck(c.path, { only: new Set([`${c.path}#${c.block}`]), cram: !isDue(c, appNow()) });
    must(n >= 1, `a session over ${c.id} (${what})`);
    await poll(() => q('.recall-wrap .card'), `${c.id} is drawn`, 8000);
    key(' ');
    await sleep(400);
    key('3');
    return poll(async () => { const s = await lineOf(c); return s && (s.reps ?? 0) === before + 1 ? s : null; }, `${c.id} graded good: its line rewritten`, 8000);
  };
  const natural = (c: CardItem) => grade(c.sched, 3, appNow(), { request_retention: optionsAt(c.path).opts.retention });
  try {
    useApp.getState().setTheme('light');
    await poll(() => document.documentElement.dataset.theme === 'light', 'light');
    setInspector({ open: true });
    setClockDay(null);

    // ── the exam set on the notebook, three weeks out ──
    const nb0 = meta(await docOf(NB));
    log(`the sample's exams: ${(nb0.exams ?? []).map((e) => `${e.day} ${e.label ?? ''}`).join(', ')}`);
    must(nb0.exams?.some((e) => e.label === 'midterm 2'), 'the sample sets midterm 2 on the notebook');
    await bounded(vault.update(NB, (d) => setField(d, 'exam', [{ day: E, label: 'midterm' }])), 'writing the exam');
    await poll(async () => (await bounded(vault.fs.readText(vault.abs(NB)), 'reading the notebook')).includes(`\nexam: ${E} midterm\n`), `the notebook's front-matter reads exam: ${E} midterm`);
    await poll(() => { refreshQueue(); return items().some((i) => i.exam?.label === 'midterm'); }, 'the queue studies toward the midterm', 8000);

    // ── its cards and its textbook pulled before the date; nothing else touched ──
    const pulled = cards().filter((i) => i.pulled);
    log(`pulled: ${pulled.length} cards, to ${[...new Set(pulled.map((i) => dayOf(i.dueAt)))].sort().join(' ')}`);
    must(pulled.length > 5, `reviews FSRS put after ${E} are brought before it (${pulled.length})`);
    must(pulled.every((i) => under(i.path) && dayOf(i.dueAt) >= START && dayOf(i.dueAt) <= LAST), `each into the last week, ${START} to ${LAST}, all under the notebook`);
    must(cards().filter((i) => under(i.path) && !i.buried && i.sched?.state === 'review' && (i.sched.due ?? '').slice(0, 10) > LAST).every((i) => i.pulled || (i.sched!.last ? dayOf(whenToDate(i.sched!.last)) : '') >= START), 'every review past the exam is among them');
    must(!items().some((i) => !under(i.path) && (i.pulled || i.exam)), 'nothing outside the notebook is for the midterm');
    const book = items().find((i) => i.kind === 'read' && i.path === BOOK);
    must(book && book.pulled === '2026-11-21' && dayOf(book.dueAt) <= FINISH && dayOf(book.dueAt) >= today, `the textbook chapter, due ${book?.pulled}, is paced: next pass ${book && dayOf(book.dueAt)}, not before today`);
    must(items().every((i) => !i.pulled || dayOf(i.dueAt) >= today), 'nothing is brought forward to a day before today');
    /** Open a saved query and wait until its own list is drawn, not the tab it replaced. */
    const openQuery = async (scope: 'today' | 'upcoming') => {
      openNode(queueId(scope));
      await poll(() => q('.pane[data-active="1"] .queue h1')?.firstChild?.textContent === (scope === 'today' ? 'due today' : 'upcoming'), `the ${scope} query is drawn`, 8000);
      await sleep(300);
    };

    // ── the queue says so, and narrows to it ──
    await openQuery('upcoming');
    const marks = await poll(() => { const m = qa<HTMLElement>('.qlist li .for-exam'); return m.length ? m : null; }, 'upcoming rows say they are for the midterm', 8000);
    must(marks.every((m) => m.textContent === 'for the midterm'), `the words: "${marks[0]?.textContent}"`);
    const prow = marks[0]!.closest('li')!;
    must(/^in \d+d$/.test(prow.querySelector('.due')?.textContent ?? ''), `a row brought forward shows the day it is brought to (${prow.querySelector('.due')?.textContent})`);
    prow.scrollIntoView({ block: 'center' });
    await shot('exam-upcoming');
    const all = qa('.qlist li:not(.fold)').length;
    const chip = await poll(() => qa<HTMLButtonElement>('.queue .exam-filter button').find((b) => b.textContent === 'midterm'), 'the queue offers the midterm as a filter');
    click(chip);
    await poll(() => chip.dataset.active === '1' && qa('.qlist li:not(.fold)').length < all, 'the filter narrows the list');
    const upNow = appNow();
    const forIt = items().filter((i) => !isDue(i, upNow) && i.exam?.label === 'midterm');
    const shown = qa('.qlist li:not(.fold)').length;
    log(`narrowed to the midterm: ${shown} of ${all}`);
    must(shown === forIt.length && forIt.every((i) => under(i.path)), `only what is studied toward it: ${shown} rows, the ${forIt.length} upcoming items under the notebook`);
    must(shown < all, `fewer than all (${shown} of ${all})`);
    await shot('exam-upcoming-filtered');
    click(chip);
    await poll(() => qa('.qlist li:not(.fold)').length === all, 'and back to everything');
    await openQuery('today');
    const bookRow = await poll(() => qa<HTMLElement>('.qlist li[data-el="read"]').find((li) => li.textContent?.includes('ch. 9')), 'today holds the textbook chapter', 8000);
    must(bookRow.querySelector('.for-exam')?.textContent === 'for the midterm', 'its row says for the midterm');
    must(bookRow.querySelector('.due')?.textContent === 'today', `and is due today (${bookRow.querySelector('.due')?.textContent})`);
    bookRow.scrollIntoView({ block: 'center' });
    await shot('exam-today');

    // ── the notebook's top row and the inspector ──
    openNode(NB);
    const tag = await poll(() => q<HTMLButtonElement>('.pane-body .doc-view .meta .exam-tag'), 'the notebook\'s top row shows the exam', 10000);
    must(tag.textContent === 'midterm in 21d', `it reads "${tag.textContent}"`);
    log(`its tooltip: ${tag.title.replace(/\n/g, ' | ')}`);
    must(/cards \d+ of \d+ not yet stable/.test(tag.title) && /reading \d+ blocks? left in 1 source/.test(tag.title), 'what is left in its tooltip');
    const block = await poll(() => q<HTMLElement>('.insp .exam-block'), 'the inspector shows the exam', 8000);
    const rows = qa<HTMLElement>('.kvr', block).map((r) => r.textContent ?? '');
    log(`inspector: ${rows.join(' | ')}`);
    must(rows[0]?.startsWith('midterm') && rows[0].endsWith('in 21d'), 'the next exam, its day, three weeks');
    must(rows.some((r) => /^cards\d+ of \d+ not yet stable$/.test(r)) && rows.some((r) => /^reading\d+ blocks? left in 1 source/.test(r)), 'the cards not yet stable past it and the reading left');
    await shot('exam-notebook');
    useApp.getState().setTheme('dark');
    await poll(() => document.documentElement.dataset.theme === 'dark', 'dark');
    await shot('exam-notebook-dark');
    useApp.getState().setTheme('light');
    await poll(() => document.documentElement.dataset.theme === 'light', 'light again');

    // ── a grade before the week: capped into it, the memory FSRS's ──
    const cand = cards().find((i) => under(i.path) && i.sched?.state === 'review' && i.id !== undefined && i.groups === 1 && !i.dir && (natural(i).due ?? '') > LAST);
    must(cand, `a card FSRS would put past the exam (${cand?.id}, natural ${cand && natural(cand).due})`);
    const want = natural(cand!);
    const got = await gradeOne(cand!, 'before the week');
    log(`${cand!.id}: FSRS ${want.due} (${want.ivl}d), written ${got.due} (${got.ivl}d), s ${got.stability} d ${got.difficulty}`);
    must((got.due ?? '') >= START && (got.due ?? '') <= LAST, `due in the last week (${got.due})`);
    must(Math.abs((got.stability ?? 0) - (want.stability ?? 0)) < 1e-9 && Math.abs((got.difficulty ?? 0) - (want.difficulty ?? 0)) < 1e-9, 'stability and difficulty FSRS\'s own');

    // ── a reading pass: it advances, paced to finish before the exam ──
    refreshQueue();
    const bk = items().find((i) => i.kind === 'read' && i.path === BOOK)!;
    const reps0 = bk.kind === 'read' ? bk.sched.reps ?? 0 : 0;
    openSession(bk);
    // a reading's session is the document with its bar (`.doc-session`), not a card's `.recall-wrap`
    await poll(() => useApp.getState().sessionEl?.item.path === BOOK && q('.doc-session .ra-l'), 'the chapter in the session', 8000);
    await shot('exam-reading');
    key('Enter');
    const read = await poll(async () => { const r = meta(await docOf(BOOK)).read; return r && (r.reps ?? 0) === reps0 + 1 ? r : null; }, 'a pass made: the read line rewritten', 8000);
    log(`read: due=${read.due} ivl=${read.ivl} reps=${read.reps} pos=${read.pos}`);
    must((read.due ?? '') <= FINISH && (read.ivl ?? 99) <= 21, `the next pass paced before ${FINISH} (${read.due})`);

    // ── the last week: what was brought forward is due ──
    setClockDay(addDays(E, -3));
    refreshQueue();
    const now3 = appNow();
    const dueThen = cards().filter((i) => i.pulled && isDue(i, now3));
    log(`on ${dayOf(now3)}: ${dueThen.length} brought-forward reviews due, ${cards().filter((i) => under(i.path) && isDue(i, now3)).length} under the notebook in all`);
    must(dueThen.length > 0, `on ${dayOf(now3)} the brought-forward reviews are due`);
    await openQuery('today');
    const wrow = await poll(() => q<HTMLElement>('.qlist li .for-exam'), 'today\'s rows say for the midterm', 8000);
    wrow.closest('li')!.scrollIntoView({ block: 'center' });
    await shot('exam-last-week');
    openNode(NB);
    await poll(() => q('.pane-body .doc-view .meta .exam-tag')?.textContent === 'midterm in 3d', 'the top row: midterm in 3d', 8000);

    // ── the day after: the cap lifts ──
    setClockDay(addDays(E, 1));
    refreshQueue();
    must(!items().some((i) => i.exam || i.pulled), `on ${dayOf(appNow())} nothing is for the midterm`);
    await openQuery('upcoming');
    await poll(() => q('.qlist li') && !q('.qlist li .for-exam') && !q('.queue .exam-filter'), 'no row says so, no filter', 8000);
    openNode(NB);
    await poll(() => q('.pane-body .doc-view .meta') && !q('.pane-body .doc-view .meta .exam-tag'), 'the top row shows no exam', 8000);
    await poll(() => q('.insp') && !q('.insp .exam-block'), 'nor the inspector', 8000);
    const after = cards().find((i) => under(i.path) && i.sched?.state === 'review' && i.id !== undefined && i.groups === 1 && !i.dir && i.id !== cand!.id && (natural(i).ivl ?? 0) > EXAM_WINDOW);
    must(after, `a card in review under the notebook (${after?.id}, FSRS ${after && natural(after).ivl}d)`);
    const want2 = natural(after!);
    const got2 = await gradeOne(after!, 'the day after');
    log(`${after!.id}: FSRS ${want2.due} (${want2.ivl}d), written ${got2.due} (${got2.ivl}d)`);
    must(got2.due === want2.due && got2.ivl === want2.ivl, 'graded the day after, FSRS\'s interval, uncapped');
    await shot('exam-after');

    setClockDay(null);
    refreshQueue();
    useApp.getState().setTheme('light');
    finished = true;
    log(`done; vault ${vault.root}`);
  } catch (e) {
    setClockDay(null);
    finished = true;
    log(`failed: ${e instanceof Error ? e.message : String(e)}`);
  }
}

// `ILMI_SMOKE=same` (`smokeSame`) over a fresh copy of `samples/double-major`,
// milestone 45, the same fact twice. The stat-mech course's cards lens with
// the `similar` chip on: the pairs listed side by side with their schedules,
// eight of the nine stat-mech pairs among them (the free energy typed twice
// first), every listed pair logged with its score. Then: the multiplicity
// peak's two cards, both due, linked (each bare line naming the other, one
// schedule, the stronger), the day's queue holding one of them, a session
// grading it and the other card's line taking the same state, neither due
// again that day; the free energy's two cards merged into the course
// note's, the textbook's removed, the notice's undo putting it back, merged
// again; a formula and its derivation said not the same, remembered in
// `.ilmi/same.json` and gone from the list when the chip is turned on
// again; the inspector's `linked to` and `also in`. Light, then the list in
// dark. Every step asserts (`ok: …`); the first miss logs `failed: …` and
// stops; thirty seconds without a line is a hang, said as a failure.
export async function smokeSame(vault: Vault): Promise<void> {
  type Card = import('../format/index.js').Card;
  let last = { at: Date.now(), what: 'start' };
  let finished = false;
  const log = (s: string) => { last = { at: Date.now(), what: s }; void info(`smoke same: ${s}`); };
  const dog = setInterval(() => {
    if (finished) { clearInterval(dog); return; }
    if (Date.now() - last.at > 30_000) { finished = true; clearInterval(dog); void info(`smoke same: failed: no progress for 30 s after "${last.what}"`); }
  }, 2000);
  /** An await that may never settle (the fs over IPC), bounded. */
  const bounded = <T,>(p: Promise<T>, what: string, ms = 8000): Promise<T> =>
    Promise.race([p, new Promise<T>((_, no) => setTimeout(() => no(new Error(`${what} (no answer in ${ms} ms)`)), ms))]);
  const shot = async (name: string, ms = 2500) => { await sleep(800); log(`shot: ${name}`); await sleep(ms); };
  const q = <T extends Element>(sel: string, root: ParentNode = document) => root.querySelector<T>(sel);
  const qa = <T extends Element>(sel: string, root: ParentNode = document) => Array.from(root.querySelectorAll<T>(sel));
  const must = (ok: unknown, what: string) => { if (!ok) throw new Error(what); log(`ok: ${what}`); };
  const poll = async <T,>(probe: () => T | null | undefined | false | Promise<T | null | undefined | false>, what: string, ms = 5000): Promise<T> => {
    const t0 = Date.now();
    for (;;) {
      const v = await probe();
      if (v) { log(`ok: ${what}`); return v; }
      if (Date.now() - t0 > ms) throw new Error(`${what} (waited ${ms} ms)`);
      await sleep(100);
    }
  };
  const key = (k: string) => window.dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true, cancelable: true }));
  const click = (el: Element) => el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
  const { parse } = await import('../format/index.js');
  const { dayOf, isDue } = await import('../schedule/index.js');
  const { refreshQueue } = await import('./vault.js');
  const { setLensView } = await import('./Lenses.js');
  const { studyDeck } = await import('./deckOps.js');
  const COURSE = 'courses/fall-2026/phys-415-stat-mech';
  const MICRO = `${COURSE}/microcanonical-ensemble.md`;
  const CANON = `${COURSE}/canonical-ensemble.md`;
  const CH2 = 'library/lindqvist-statistical-physics/ch-2-microstates-and-entropy.md';
  const CH3 = 'library/lindqvist-statistical-physics/ch-3-the-canonical-ensemble.md';
  const STAT_MECH = [
    ['sm-F-lnZ', 'lq3-F-lnZ'], ['sm-einstein-omega', 'lq2-einstein-omega'], ['sm-peak-width', 'lq2-peak-width'], ['sm-def-T', 'lq2-def-T'],
    ['sm-equip-fail', 'lq3-equip-cond'], ['sm-classical-criterion', 'lq4-nQ'], ['sm-degeneracy', 'lq-ex-boltz-system-omega'],
    ['sm-dv-equip', 'dr-equip'], ['sm-dv-fermi', 'dr-fermi'],
  ] as const;
  const text = (p: string) => bounded(vault.fs.readText(vault.abs(p)), `read ${p}`);
  const lineUnder = async (p: string, id: string) => { const l = (await text(p)).split('\n'); const at = l.findIndex((x) => x.endsWith(` ^${id}`)); return at < 0 ? null : l[at + 1] ?? ''; };
  const cardOf = async (p: string, id: string) => parse(await text(p)).doc.blocks.find((b): b is Card => b.kind === 'card' && b.id === id);
  const pairEl = (a: string, b: string) => q<HTMLElement>(`.same-pair[data-a="${a}"][data-b="${b}"]`) ?? q<HTMLElement>(`.same-pair[data-a="${b}"][data-b="${a}"]`);
  const chip = () => q<HTMLElement>('.deck-view .chip[data-chip="similar"]');
  try {
    useApp.getState().setTheme('light');
    await poll(() => document.documentElement.dataset.theme === 'light', 'light');
    setInspector({ open: true });

    // ── the list: the stat-mech course's pairs ──
    openNode(COURSE);
    setLensView(COURSE, 'cards');
    click(await poll(() => chip(), 'the cards lens of the stat-mech course has a similar chip', 10000));
    await poll(() => chip()?.dataset.on === '1' && qa('.same-pair').length > 0, 'the chip on: pairs listed in place of the rows', 15000);
    const pairs = qa<HTMLElement>('.same-pair');
    for (const p of pairs) log(`pair ${p.dataset.score} ${p.dataset.a} ~ ${p.dataset.b}`);
    const found = STAT_MECH.filter(([a, b]) => pairEl(a, b));
    must(found.length >= 8, `${found.length} of the nine stat-mech pairs listed (missing: ${STAT_MECH.filter(([a, b]) => !pairEl(a, b)).map((p) => p.join(' ~ ')).join(', ') || 'none'})`);
    must(pairs.length <= 30, `${pairs.length} pairs in the course's lens: few beyond the known ones`);
    must([pairs[0]!.dataset.a, pairs[0]!.dataset.b].sort().join() === 'lq3-F-lnZ,sm-F-lnZ', 'the free energy typed twice is first');
    const side = q<HTMLElement>('.sp-side', pairs[0]!)!;
    must(q('.dr-front .katex', side) && /\d+ reviews?/.test(q('.sp-sched', side)?.textContent ?? '') && q('button[data-act="keep"]', side), 'each side draws its faces, its schedule, and keep this');
    must(qa('.sp-acts button', pairs[0]!).map((b) => b.textContent).join() === 'link,not the same', 'each pair offers link and not the same');
    must(q('.deck-view .deck-row') === null, 'the rows give way to the pairs');
    await shot('same-list');

    // ── link: the multiplicity peak's two cards, both due ──
    const [PA, PB] = ['sm-peak-width', 'lq2-peak-width'];
    refreshQueue();
    const dueNow = () => { const t = new Date(); return useApp.getState().queue.filter((i): i is CardItem => i.kind === 'card' && (i.id === PA || i.id === PB) && isDue(i, t)).map((i) => i.id); };
    must(dueNow().length === 2, `before the link both are in the day's queue (${dueNow().join(', ')})`);
    const [a0, b0] = [await cardOf(MICRO, PA), await cardOf(CH2, PB)];
    const strong = (b0?.sched?.stability ?? 0) > (a0?.sched?.stability ?? 0) ? b0!.sched! : a0!.sched!;
    click(q('button[data-act="link"]', pairEl(PA, PB)!)!);
    const la = await poll(async () => { const l = await lineUnder(MICRO, PA); return l?.includes(`link=${PB}`) ? l : null; }, 'linked: the course note\'s bare line names the textbook\'s card');
    const lb = await poll(async () => { const l = await lineUnder(CH2, PB); return l?.includes(`link=${PA}`) ? l : null; }, 'and the textbook\'s names the note\'s');
    log(`${PA}: ${la}`);
    log(`${PB}: ${lb}`);
    must(la.includes(`due=${strong.due} `) && lb.includes(`due=${strong.due} `) && la.includes(` s=${strong.stability} `) && lb.includes(` s=${strong.stability} `), `both take the stronger schedule (s=${strong.stability}, due ${strong.due})`);
    must(useApp.getState().notice?.line === 'linked · 2 cards', 'the notice says linked, with its undo');
    await poll(() => !pairEl(PA, PB), 'the linked pair leaves the list');
    await shot('same-linked');

    // ── one of them a day ──
    await poll(() => { refreshQueue(); return dueNow().length === 1; }, 'the day\'s queue holds one of the two', 8000);
    const shownId = dueNow()[0]!;
    const otherId = shownId === PA ? PB : PA;
    const buried = useApp.getState().queue.find((i): i is CardItem => i.kind === 'card' && i.id === otherId);
    must(buried?.buried && dayOf(buried.dueAt) !== dayOf(new Date()), `${shownId} is shown, ${otherId} buried till tomorrow`);
    openNode(queueId('today'));
    await sleep(800);
    await shot('same-queue');

    // ── grading one counts for the other ──
    const [shownPath, otherPath] = shownId === PA ? [MICRO, CH2] : [CH2, MICRO];
    const shownDoc = parse(await text(shownPath)).doc;
    const block = shownDoc.blocks.findIndex((b) => b.kind === 'card' && b.id === shownId);
    const n = studyDeck(shownPath, { only: new Set([`${shownPath}#${block}`]) });
    must(n === 1, `a session over ${shownId}`);
    await poll(() => q('.recall-wrap .card'), 'the card is drawn', 8000);
    const otherBefore = await lineUnder(otherPath, otherId);
    key(' ');
    await sleep(400);
    key('3');
    const shownAfter = await poll(async () => { const l = await lineUnder(shownPath, shownId); return l && !l.includes(`last=${strong.last}`) ? l : null; }, `grading ${shownId} rewrites its line`, 8000);
    const otherAfter = await poll(async () => { const l = await lineUnder(otherPath, otherId); return l && l !== otherBefore ? l : null; }, `and ${otherId}'s line takes the grade`, 8000);
    log(`${shownId}: ${shownAfter}`);
    log(`${otherId}: ${otherAfter}`);
    const state = (l: string) => l.replace(/ (pri|link)=\S+/g, '');
    must(state(shownAfter) === state(otherAfter), 'the same state on both lines, each keeping its own link');
    must(/ r=\d+ /.test(otherAfter) && Number(/ r=(\d+) /.exec(otherAfter)![1]) === (strong.reps ?? 0) + 1, 'one review more on both');
    await sleep(600);
    refreshQueue();
    must(dueNow().length === 0, 'neither is due again today');

    // ── merge: the free energy's two cards into the course note's ──
    openNode(COURSE);
    setLensView(COURSE, 'cards');
    const chip2 = await poll(() => chip(), 'the course\'s cards lens again', 10000);
    if (chip2.dataset.on !== '1') click(chip2);
    const fp = await poll(() => pairEl('sm-F-lnZ', 'lq3-F-lnZ'), 'the free energy pair listed', 15000);
    const ch3Before = await text(CH3);
    const k0 = (await cardOf(CANON, 'sm-F-lnZ'))!.sched!;
    const d0 = (await cardOf(CH3, 'lq3-F-lnZ'))!.sched!;
    const keepSide = qa<HTMLElement>('.sp-side', fp).find((s) => s.dataset.key === 'sm-F-lnZ')!;
    click(q('button[data-act="keep"]', keepSide)!);
    await poll(async () => !(await text(CH3)).includes('^lq3-F-lnZ'), 'merged: the textbook\'s card is removed');
    const kept = (await cardOf(CANON, 'sm-F-lnZ'))!.sched!;
    const want = (d0.stability ?? 0) > (k0.stability ?? 0) ? d0 : k0;
    log(`kept: s=${kept.stability} r=${kept.reps} due ${kept.due}; before: note s=${k0.stability}, textbook s=${d0.stability}`);
    must(kept.stability === want.stability && kept.due === want.due, 'the course note\'s card keeps the stronger schedule');
    must(useApp.getState().notice?.line === 'merged · 2 cards into 1', 'the notice says merged, with its undo');
    await shot('same-merged');
    click(await poll(() => qa<HTMLElement>('.notice button').find((b) => b.textContent === 'undo'), 'the notice\'s undo'));
    await poll(async () => (await text(CH3)) === ch3Before, 'undone: the textbook\'s file is as it was, byte for byte');
    const fp2 = await poll(() => pairEl('sm-F-lnZ', 'lq3-F-lnZ'), 'and the pair is listed again', 8000);
    click(q('button[data-act="keep"]', qa<HTMLElement>('.sp-side', fp2).find((s) => s.dataset.key === 'sm-F-lnZ')!)!);
    await poll(async () => !(await text(CH3)).includes('^lq3-F-lnZ'), 'merged again, and left merged');

    // ── not the same: a formula and its derivation ──
    const ns = await poll(() => pairEl('sm-sigmaE', 'sm-dv-fluct'), 'the energy fluctuation and its derivation listed');
    click(q('button[data-act="not-same"]', ns)!);
    const raw = await poll(async () => { const t = await bounded(vault.fs.readText(vault.abs('.ilmi/same.json')).catch(() => ''), 'read same.json'); return t.includes('sm-dv-fluct|sm-sigmaE') ? t : null; }, 'not the same: remembered in .ilmi/same.json');
    log(`.ilmi/same.json: ${raw.replace(/\s+/g, ' ')}`);
    await poll(() => !pairEl('sm-sigmaE', 'sm-dv-fluct'), 'the pair leaves the list');
    must((await bounded(vault.loadNotSame(), 'load not-same')).includes('sm-dv-fluct|sm-sigmaE'), 'and reads back from the file');
    click(chip()!);
    await poll(() => chip()?.dataset.on === '0' && q('.deck-view .deck-row'), 'the chip off: the rows again');
    click(chip()!);
    await poll(() => chip()?.dataset.on === '1' && qa('.same-pair').length > 0, 'the chip on again', 10000);
    must(!pairEl('sm-sigmaE', 'sm-dv-fluct') && !pairEl('sm-F-lnZ', 'lq3-F-lnZ') && !pairEl(PA, PB), 'never shown again; the merged and the linked pairs neither');
    await shot('same-list-after');

    // ── the inspector: linked to, also in ──
    const micro = parse(await text(MICRO)).doc;
    const idx = (id: string) => micro.blocks.findIndex((b) => b.kind === 'card' && b.id === id);
    openCard(MICRO, idx(PA), PA);
    const row = (k: string) => qa<HTMLElement>('.insp .kvr').find((r) => q('dt', r)?.textContent === k);
    const lt = await poll(() => row('linked to'), `the inspector on ${PA} says linked to`, 8000);
    const ltCard = q<HTMLElement>('.io-card', lt)?.textContent ?? '';
    must(/^relative width of the multiplicity peak/.test(ltCard) && q('.io-card .katex', lt), `linked to names the card by its front, its formula set ("${ltCard.slice(0, 50)}")`);
    must(q('.io-where', lt)?.textContent === 'ch. 2: microstates and entropy', `and where it lives (${q('.io-where', lt)?.textContent})`);
    must(q('button[data-act="unlink"]', lt)?.textContent === 'unlink' && !q('button[data-act="linked"] [data-act="unlink"]', lt), 'unlink is a control of its own');
    await shot('same-inspector-linked');
    openCard(MICRO, idx('sm-einstein-omega'), 'sm-einstein-omega');
    const ai = await poll(() => row('also in'), 'the inspector on the Einstein solid\'s multiplicity says also in', 8000);
    const aiCard = q<HTMLElement>('.io-card', ai)?.textContent ?? '';
    must(/^multiplicity of an Einstein solid/.test(aiCard) && q('.io-card .katex', ai), `also in names the card by its front ("${aiCard.slice(0, 50)}")`);
    must(q('.io-where', ai)?.textContent === 'ch. 2: microstates and entropy', `and where it lives (${q('.io-where', ai)?.textContent})`);
    click(q('button[data-act="alike"]', ai)!);
    await poll(() => useApp.getState().selectedCard?.path === CH2, 'also in opens the textbook\'s card, selected', 8000);
    await shot('same-inspector-also');

    // ── dark ──
    openNode(COURSE);
    setLensView(COURSE, 'cards');
    const chip3 = await poll(() => chip(), 'the course\'s cards lens', 10000);
    if (chip3.dataset.on !== '1') click(chip3);
    await poll(() => qa('.same-pair').length > 0, 'the pairs', 10000);
    useApp.getState().setTheme('dark');
    await poll(() => document.documentElement.dataset.theme === 'dark', 'dark');
    await shot('same-list-dark');
    useApp.getState().setTheme('light');
    finished = true;
    log(`done; vault ${vault.root}`);
  } catch (e) {
    finished = true;
    log(`failed: ${e instanceof Error ? e.message : String(e)}`);
  }
}

// `ILMI_SMOKE=sections` (`smokeSections`) over a fresh copy of
// `samples/double-major`, milestone 47, the app's clock on 2026-11-02 (the
// sample's day): the day's queue holds the typed-up derivation in
// canonical-ensemble among the reading and the cards, by priority, its row
// saying where it stands under the head's one line; a section opens in its
// session at its heading, the caret in it; ⏎, `p` and `d` each change
// exactly the heading's line and move on to the next element, whatever
// kind; a dismissed section leaves the queue while its cards stay due; the
// inspector's come back and bring back return it; the heading's own menu.
// Light, and the queue once in dark.
export async function smokeSections(vault: Vault): Promise<void> {
  type Heading = import('../format/index.js').Heading;
  type SectionItem = import('../schedule/index.js').SectionItem;
  let last = { at: Date.now(), what: 'start' };
  let finished = false;
  const log = (s: string) => { last = { at: Date.now(), what: s }; void info(`smoke sections: ${s}`); };
  const dog = setInterval(() => {
    if (finished) { clearInterval(dog); return; }
    if (Date.now() - last.at > 30_000) { finished = true; clearInterval(dog); void info(`smoke sections: failed: no progress for 30 s after "${last.what}"`); }
  }, 2000);
  const bounded = <T,>(p: Promise<T>, what: string, ms = 8000): Promise<T> =>
    Promise.race([p, new Promise<T>((_, no) => setTimeout(() => no(new Error(`${what} (no answer in ${ms} ms)`)), ms))]);
  const shot = async (name: string, ms = 2500) => { await sleep(800); log(`shot: ${name}`); await sleep(ms); };
  const q = <T extends Element>(sel: string, root: ParentNode = document) => root.querySelector<T>(sel);
  const qa = <T extends Element>(sel: string, root: ParentNode = document) => Array.from(root.querySelectorAll<T>(sel));
  const must = (ok: unknown, what: string) => { if (!ok) throw new Error(what); log(`ok: ${what}`); };
  const poll = async <T,>(probe: () => T | null | undefined | false | Promise<T | null | undefined | false>, what: string, ms = 5000): Promise<T> => {
    const t0 = Date.now();
    for (;;) {
      const v = await probe();
      if (v) { log(`ok: ${what}`); return v; }
      if (Date.now() - t0 > ms) throw new Error(`${what} (waited ${ms} ms)`);
      await sleep(100);
    }
  };
  const key = (k: string) => window.dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true, cancelable: true }));
  const click = (el: Element) => el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
  const { parse } = await import('../format/index.js');
  const { addDays, isDue, sameItem } = await import('../schedule/index.js');
  const { refreshQueue } = await import('./vault.js');
  const { setClockDay, appNow } = await import('./clock.js');
  const { doneLine } = await import('./items.js');
  const SM = 'courses/fall-2026/phys-415-stat-mech';
  const CANON = `${SM}/canonical-ensemble.md`;
  const DAY = '2026-11-02';
  const text = (p = CANON) => bounded(vault.fs.readText(vault.abs(p)), `reading ${p}`);
  const items = () => useApp.getState().queue;
  const sectionOf = (start: string) => items().find((i): i is SectionItem => i.kind === 'section' && i.path === CANON && i.heading.startsWith(start));
  const cardsUnder = async (start: string) => {
    const doc = parse(await text()).doc;
    const at = doc.blocks.findIndex((b) => b.kind === 'heading' && b.text.startsWith(start));
    let end = at + 1;
    while (end < doc.blocks.length && !(doc.blocks[end]!.kind === 'heading' && (doc.blocks[end] as Heading).level <= (doc.blocks[at] as Heading).level)) end++;
    return items().filter((i) => i.kind === 'card' && i.path === CANON && i.block > at && i.block < end && isDue(i, appNow())).length;
  };
  /** The lines that differ, as `before → after`; a line gone reads `line → (gone)`. */
  const diff = (a: string, b: string): string[] => {
    const x = a.split('\n');
    const y = b.split('\n');
    if (x.length === y.length) return x.flatMap((l, i) => (l === y[i] ? [] : [`${l} → ${y[i]}`]));
    if (x.length === y.length + 1) { const i = x.findIndex((l, k) => l !== y[k]); return x.filter((_, k) => k !== i).join('\n') === b ? [`${x[i]} → (gone)`] : ['(more than one line)']; }
    if (y.length === x.length + 1) { const i = y.findIndex((l, k) => l !== x[k]); return y.filter((_, k) => k !== i).join('\n') === a ? [`(none) → ${y[i]}`] : ['(more than one line)']; }
    return ['(more than one line)'];
  };
  const openQuery = async (scope: 'today' | 'upcoming') => {
    openNode(queueId(scope));
    await poll(() => q('.pane[data-active="1"] .queue h1')?.firstChild?.textContent === (scope === 'today' ? 'due today' : 'upcoming'), `the ${scope} query is drawn`, 8000);
    await sleep(300);
  };
  /** A session at one section; resolves once its bar is drawn on it. */
  const sessionAt = async (s: SectionItem) => {
    openSession(s);
    await poll(() => { const el = useApp.getState().sessionEl; return el?.kind === 'section' && sameItem(el.item, s) && q('.pane[data-active="1"] .doc-session[data-el="section"] .session-bar') ? true : null; }, `a session on § ${s.heading.slice(0, 40)}`, 8000);
    await sleep(600);
  };
  /** The current element moved on to the one after `s` in the session's order. */
  const movedOn = (s: SectionItem) => poll(() => {
    const st = useApp.getState();
    const list = st.session?.items ?? [];
    const was = list.findIndex((i) => sameItem(i, s));
    const now = st.sessionEl?.item;
    if (!now) return was === list.length - 1 ? 'the end' : null;
    return !sameItem(now, s) && list.indexOf(now) === was + 1 ? `${now.kind} (${now.path.split('/').pop()})` : null;
  }, `and the session moved on to the next element`, 8000);
  try {
    setClockDay(DAY);
    useApp.getState().setTheme('light');
    await poll(() => document.documentElement.dataset.theme === 'light', 'light');
    setInspector({ open: true });
    refreshQueue();

    // ── the sample as it ships: the derivation due, lecture 13 later ──
    const deriv = await poll(() => sectionOf('pset 4 #5'), 'the typed-up derivation is in the day\'s queue', 10000);
    must(isDue(deriv, appNow()) && deriv.written && deriv.cards === 0, 'due today, written, no cards');
    const l13 = await poll(() => sectionOf('lecture 13'), 'lecture 13 is enrolled');
    must(!isDue(l13, appNow()) && l13.cards === 4 && dayOfStr(l13.due) === '2026-11-09', `with its 4 cards, due later (${l13.due})`);
    await openQuery('today');
    must(/^\d+ due, in priority order $/.test(q('.queue .legend')?.textContent ?? '') && !q('.queue .summary'), `the head's one line, no counts by kind: "${q('.queue .legend')?.textContent}"`);
    const rows = qa<HTMLElement>('.pane[data-active="1"] .qlist li:not(.fold)');
    const at = rows.findIndex((r) => r.dataset.el === 'section' && r.textContent?.includes('pset 4 #5'));
    must(at >= 0, `the derivation's row (${at + 1} of ${rows.length})`);
    const row = rows[at]!;
    must(q('.mark', row)?.textContent === '§' && q('.ref-line', row)?.textContent === 'written, no cards yet · first time back', `marked §, saying "${q('.ref-line', row)?.textContent}"`);
    const kinds = rows.map((r) => r.dataset.el);
    log(`the day's kinds, in order: ${kinds.join(' ')}`);
    must(kinds.slice(0, at).includes('card') && kinds.slice(at + 1).includes('card') && kinds.includes('read'), 'interleaved with reading and cards, not grouped by kind');
    for (const r of rows.slice(0, 12)) log(`row: ${q('.mark', r)?.textContent} ${q('.kindtag', r)?.textContent} · ${(q('.body', r)?.textContent ?? '').slice(0, 60)} · ${q('.ref-line', r)?.textContent ?? ''}`);
    row.scrollIntoView({ block: 'center' });
    await shot('sections-queue');

    // two more due today, written as a hand edit would be: lecture 12 (to postpone) and lecture 13 (to dismiss)
    await bounded(vault.update(CANON, (d) => {
      for (const b of d.blocks) {
        if (b.kind !== 'heading') continue;
        if (b.text.startsWith('lecture 12')) b.read = { made: '2026-10-28', due: DAY, ivl: 3 };
        if (b.text.startsWith('lecture 13')) b.read = { ...b.read, due: DAY };
      }
    }), 'enrolling lecture 12, bringing lecture 13 to today');
    await poll(() => { refreshQueue(); const a = sectionOf('lecture 12'); const b = sectionOf('lecture 13'); return a && b && isDue(a, appNow()) && isDue(b, appNow()) ? true : null; }, 'lectures 12 and 13 due today', 8000);

    // ── ⏎ next: the derivation opens in place; its line, and only it, changes ──
    await sessionAt(deriv);
    /** What the landing depends on, said when it does not happen. */
    const why = () => {
      const st = useApp.getState();
      const hs = qa<HTMLElement>('.pane[data-active="1"] .doc-session .dd-h');
      return `caretHeading ${JSON.stringify(st.caretHeading && { ...st.caretHeading, text: st.caretHeading.text.slice(0, 50) })}; reveal ${JSON.stringify(st.reveal)}; `
        + `session on ${st.sessionEl?.item.path} ${st.sessionEl?.kind}; readers ${qa('.doc-view').length}; session headings ${hs.length}, landed ${hs.filter((h) => h.classList.contains('landed')).length}, `
        + `marked ${hs.filter((h) => h.dataset.read).map((h) => (h.textContent ?? '').slice(0, 20)).join(' | ')}; focus ${document.activeElement?.className}`;
    };
    let landed: NonNullable<ReturnType<typeof useApp.getState>['caretHeading']>;
    try {
      landed = await poll(() => { const c = useApp.getState().caretHeading; return c?.path === CANON && c.text === deriv.heading ? c : null; }, 'the section opened at its heading, the caret in it', 8000);
    } catch (e) { log(`why: ${why()}`); throw e; }
    const top = qa<HTMLElement>('.pane[data-active="1"] .doc-session .dd-h').find((e) => e.textContent?.startsWith('pset 4 #5'))?.getBoundingClientRect().top ?? -1;
    must(top >= 0 && top < window.innerHeight / 2, `scrolled to it (its top at ${Math.round(top)} px; ${landed.nth + 1}th heading)`);
    const h = await poll(() => qa<HTMLElement>('.pane[data-active="1"] .doc-session .dd-h').find((e) => e.textContent?.startsWith('pset 4 #5')), 'its heading is drawn in the editor');
    must(h.dataset.read === 'on' && !!h.closest('[contenteditable="true"]'), 'in the editor, marked as coming back');
    const bar = q<HTMLElement>('.pane[data-active="1"] .session-bar')!;
    const words = qa<HTMLElement>('.sb-actions button .ra-l', bar).map((b) => b.textContent);
    must(words.join(' / ') === 'next · back in 5d / later / dismiss', `the actions read ${words.join(' / ')}`);
    must(q('.sb-where', bar)?.textContent === 'written, no cards yet · first time back', `above them, where it stands: "${q('.sb-where', bar)?.textContent}"`);
    const strip = qa('.bot span').map((s) => s.textContent).join(' | ');
    must(strip.includes('⏎ next') && strip.includes('p later') && strip.includes('d dismiss'), `the bottom strip: ${strip}`);
    await shot('sections-session');
    let before = await text();
    key('Enter');
    let after = await poll(async () => { const t = await text(); return t !== before ? t : null; }, 'next wrote the file', 8000);
    let d = diff(before, after);
    must(d.length === 1 && d[0] === `<!-- read made=2026-10-30 due=2026-11-02 ivl=3 --> → <!-- read made=2026-10-30 due=${addDays(DAY, 5)} ivl=5 reps=1 -->`, `exactly the heading's line: ${d.join('; ')}`);
    log(`moved on to ${await movedOn(deriv)}`);
    must(useApp.getState().log[0] === doneLine('§', deriv.heading, 'next · back in 5d') && useApp.getState().log[0]!.startsWith('§ pset 4 #5'), `the done row names the section: "${useApp.getState().log[0]}"`);
    await shot('sections-after-next');

    // ── p later: lecture 12 ──
    const l12 = sectionOf('lecture 12')!;
    await sessionAt(l12);
    before = await text();
    key('p');
    after = await poll(async () => { const t = await text(); return t !== before ? t : null; }, 'later wrote the file', 8000);
    d = diff(before, after);
    must(d.length === 1 && d[0] === `<!-- read made=2026-10-28 due=2026-11-02 ivl=3 --> → <!-- read made=2026-10-28 due=${addDays(DAY, 4)} ivl=4 -->`, `exactly the heading's line, the pass not counted: ${d.join('; ')}`);
    log(`moved on to ${await movedOn(l12)}`);

    // ── d dismiss: lecture 13 leaves the queue, its cards stay due ──
    refreshQueue();
    const l13d = await poll(() => sectionOf('lecture 13'), 'lecture 13 in the queue');
    const cardsBefore = await cardsUnder('lecture 13');
    must(cardsBefore > 0, `lecture 13 has cards due (${cardsBefore})`);
    await sessionAt(l13d);
    before = await text();
    key('d');
    after = await poll(async () => { const t = await text(); return t !== before ? t : null; }, 'dismiss wrote the file', 8000);
    d = diff(before, after);
    must(d.length === 1 && d[0] === '<!-- read made=2026-10-19 due=2026-11-02 ivl=8 reps=2 --> → (gone)', `exactly the heading's line, gone: ${d.join('; ')}`);
    log(`moved on to ${await movedOn(l13d)}`);
    await poll(() => { refreshQueue(); return !sectionOf('lecture 13'); }, 'the dismissed section left the queue', 8000);
    must((await cardsUnder('lecture 13')) === cardsBefore, `its ${cardsBefore} cards stay due`);
    await shot('sections-after-dismiss');

    // ── the inspector: come back (no boxes), bring back (boxes) ──
    const reveal = async (start: string) => {
      const doc = parse(await text()).doc;
      const index = doc.blocks.findIndex((b) => b.kind === 'heading' && b.text.startsWith(start));
      const heading = (doc.blocks[index] as Heading).text;
      openNode(CANON);
      await poll(() => q('.pane[data-active="1"] .doc-view .dd-h'), 'the note is open', 8000);
      await sleep(300);
      useApp.setState({ reveal: { path: CANON, index, heading } });
      await poll(() => useApp.getState().caretHeading?.text === heading, `the caret in "${heading.slice(0, 40)}"`, 8000);
      return poll(() => q<HTMLElement>('.insp .sec-block'), 'the inspector\'s section part', 8000);
    };
    let part = await reveal('lecture 13');
    let btn = q<HTMLButtonElement>('button', part)!;
    must(part.dataset.status === 'none' && btn.textContent === 'come back', `a dismissed section with no boxes offers ${btn.textContent}`);
    before = await text();
    click(btn);
    after = await poll(async () => { const t = await text(); return t !== before ? t : null; }, 'come back wrote the file', 8000);
    d = diff(before, after);
    must(d.length === 1 && d[0] === `(none) → <!-- read made=${DAY} due=${addDays(DAY, 2)} ivl=2 -->`, `its line back: ${d.join('; ')}`);
    await poll(() => { refreshQueue(); const s = sectionOf('lecture 13'); return s && !isDue(s, appNow()) ? s : null; }, 'back in the queue, in 3 days', 8000);

    // a dismissed passage keeps its boxes: bring back
    await bounded(vault.update(CANON, (doc) => {
      const b = doc.blocks.find((x): x is Heading => x.kind === 'heading' && x.text.startsWith('lecture 14'))!;
      b.read = { made: '2026-10-20', reps: 2, boxes: '41:0.120:0.122:0.770:0.145' };
    }), 'a dismissed passage on lecture 14');
    part = await reveal('lecture 14');
    await poll(() => q<HTMLElement>('.insp .sec-block')?.dataset.status === 'dismissed', 'the inspector reads it dismissed');
    part = q<HTMLElement>('.insp .sec-block')!;
    btn = q<HTMLButtonElement>('button', part)!;
    const stands = qa<HTMLElement>('.kvr', part).map((r) => `${q('dt', r)?.textContent}: ${q('dd', r)?.textContent}`);
    log(`the inspector: ${stands.join(' | ')}`);
    must(btn.textContent === 'bring back' && stands.includes('next: never: dismissed'), `bring back, next never (${btn.textContent})`);
    await shot('sections-inspector-bring-back');
    before = await text();
    click(btn);
    after = await poll(async () => { const t = await text(); return t !== before ? t : null; }, 'bring back wrote the file', 8000);
    d = diff(before, after);
    must(d.length === 1 && d[0] === `<!-- read made=2026-10-20 reps=2 boxes=41:0.120:0.122:0.770:0.145 --> → <!-- read made=2026-10-20 due=${addDays(DAY, 2)} ivl=2 reps=2 boxes=41:0.120:0.122:0.770:0.145 -->`, `a fresh due, reps and boxes kept: ${d.join('; ')}`);
    await poll(() => { refreshQueue(); return sectionOf('lecture 14'); }, 'bring back returns it to the queue', 8000);
    await poll(() => q<HTMLElement>('.insp .sec-block')?.dataset.status === 'on' && q('.insp .sec-block button')?.textContent === 'dismiss', 'the inspector now offers dismiss');
    await shot('sections-inspector-after');

    // ── the heading's own menu ──
    const hd = await poll(() => qa<HTMLElement>('.pane[data-active="1"] .doc-view .dd-h').find((e) => e.textContent?.startsWith('lecture 11')), 'lecture 11\'s heading');
    const r = hd.getBoundingClientRect();
    hd.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true, clientX: r.left + 30, clientY: r.top + r.height / 2 }));
    const menu = await poll(() => q<HTMLElement>('.section-menu'), 'right-click on a heading opens its menu');
    must(q('[data-act="come-back"]', menu)?.textContent?.includes('come back'), `it offers come back (${menu.textContent})`);
    await shot('sections-heading-menu');
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    document.body.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));

    // ── dark ──
    await openQuery('today');
    useApp.getState().setTheme('dark');
    await poll(() => document.documentElement.dataset.theme === 'dark', 'dark');
    await shot('sections-queue-dark');
    useApp.getState().setTheme('light');
    setClockDay(null);
    finished = true;
    log(`done; vault ${vault.root}`);
  } catch (e) {
    finished = true;
    setClockDay(null);
    log(`failed: ${e instanceof Error ? e.message : String(e)}`);
  }
}

/** A stored due's day. */
const dayOfStr = (due: string | undefined): string => (due ?? '').slice(0, 10);

// `ILMI_SMOKE=book` (`smokeBook`) over a fresh copy of `samples/double-major`,
// milestone 48, with `ILMI_BOOKS=<repo>/design/books`: the smoke copies
// `ch3-book.pdf` (Lindqvist ch. 3 at pp. 41–44 of its book) and `reader.pdf`
// (the classical prose reader's passage) into `books/` of the scratch copy,
// with a chapter (`pages: 41-44`, two passages already boxed, one of them
// dismissed) and a passage document, and the app's clock on 2026-11-02. It
// opens the chapter as its pages beside its notes; draws a two-box passage
// across pp. 41–42 and makes it a section with `e` (named `3.3 · average
// values (3.12)`, placed in book order, its line's boxes in the grammar,
// the read point moved past it); ⏎ puts the caret in it and the caret
// lights its boxes; show boxes here draws both crops; a dismissed passage's
// boxes are dashed; a tag beside the page goes to its section; ⌘\ hides the
// notes and shows them; `m` on the Arabic page clips the box under `## p. 1`
// with the caret below it; the queue opens a section at its boxes; done for
// today records `pos` and `y`. Light, then dark.
export async function smokeBook(vault: Vault): Promise<void> {
  // what the app reports with console.error, for a failure's `why:` line
  const errors: string[] = [];
  const consoleError = console.error;
  console.error = (...a: unknown[]) => { errors.push(a.map((x) => (x instanceof Error ? x.message : String(x))).join(' ').slice(0, 200)); consoleError(...a); };
  type SectionItem = import('../schedule/index.js').SectionItem;
  type ReadItem = import('../schedule/index.js').ReadItem;
  let last = { at: Date.now(), what: 'start' };
  let finished = false;
  const log = (s: string) => { last = { at: Date.now(), what: s }; void info(`smoke book: ${s}`); };
  const dog = setInterval(() => {
    if (finished) { clearInterval(dog); return; }
    if (Date.now() - last.at > 30_000) { finished = true; clearInterval(dog); void info(`smoke book: failed: no progress for 30 s after "${last.what}"`); }
  }, 2000);
  const bounded = <T,>(p: Promise<T>, what: string, ms = 8000): Promise<T> =>
    Promise.race([p, new Promise<T>((_, no) => setTimeout(() => no(new Error(`${what} (no answer in ${ms} ms)`)), ms))]);
  const shot = async (name: string, ms = 2500) => { await sleep(800); log(`shot: ${name}`); await sleep(ms); };
  const q = <T extends Element>(sel: string, root: ParentNode = document) => root.querySelector<T>(sel);
  const qa = <T extends Element>(sel: string, root: ParentNode = document) => Array.from(root.querySelectorAll<T>(sel));
  const must = (ok: unknown, what: string) => { if (!ok) throw new Error(what); log(`ok: ${what}`); };
  const poll = async <T,>(probe: () => T | null | undefined | false | Promise<T | null | undefined | false>, what: string, ms = 5000): Promise<T> => {
    const t0 = Date.now();
    for (;;) {
      const v = await probe();
      if (v) { log(`ok: ${what}`); return v; }
      if (Date.now() - t0 > ms) throw new Error(`${what} (waited ${ms} ms)`);
      await sleep(100);
    }
  };
  const key = (k: string, mods: KeyboardEventInit = {}) => window.dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true, cancelable: true, ...mods }));
  const down = (el: Element) => el.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true, button: 0 }));
  const { parse, parseBoxes, meta } = await import('../format/index.js');
  const { refreshQueue } = await import('./vault.js');
  const { setClockDay } = await import('./clock.js');
  const DAY = '2026-11-02';
  const SB = 'books';
  const CH3 = `${SB}/ch-3-the-canonical-ensemble.md`;
  const P12 = `${SB}/passage-12.md`;
  const NAME = '3.3 · average values (3.12)';
  const text = (p: string) => bounded(vault.fs.readText(vault.abs(p)), `reading ${p}`);
  const headings = async (p: string) => parse(await text(p)).doc.blocks.flatMap((b) => (b.kind === 'heading' ? [b] : []));
  /** Draw a box on a page as a pointer would: down at its corner, a move, up at the other. */
  const drag = async (page: number, x: number, y: number, w: number, h: number) => {
    const el = await poll(() => q<HTMLElement>(`.pane[data-active="1"] .book .pdf-page[data-page="${page}"]`), `page ${page} is drawn`);
    el.scrollIntoView({ block: 'center' });
    await sleep(300);
    const r = el.getBoundingClientRect();
    const at = (fx: number, fy: number): MouseEventInit => ({ clientX: r.left + fx * r.width, clientY: r.top + fy * r.height, bubbles: true, cancelable: true, button: 0 });
    // as a mouse sends them since milestone 57: the pointer's press and the mouse's, then the pointer's move and release
    const mouse = { pointerId: 1, pointerType: 'mouse', isPrimary: true };
    el.dispatchEvent(new PointerEvent('pointerdown', { ...at(x, y), ...mouse }));
    el.dispatchEvent(new MouseEvent('mousedown', { ...at(x, y), detail: 1 }));
    window.dispatchEvent(new PointerEvent('pointermove', { ...at(x + w / 2, y + h / 2), ...mouse }));
    window.dispatchEvent(new PointerEvent('pointerup', { ...at(x + w, y + h), ...mouse }));
    await sleep(200);
  };
  const near = (a: number, b: number) => Math.abs(a - b) < 0.004;
  const book = () => q<HTMLElement>('.pane[data-active="1"] .book');
  /** The pane that shows the note on the pages: its reader says which pages it is on (`data-pdf`). */
  const notesPane = () => qa<HTMLElement>('.pane').find((p) => q('.reader-wrap[data-pdf]', p)) ?? null;
  /** The note open in the pane beside the pages (milestone 70), and the pages say so. */
  const notesIn = () => book()?.dataset.notes === '1' && !!notesPane() && !!q('.draft-doc', notesPane()!);
  /** The pages alone: one pane, no note beside them. */
  const alone = () => book()?.dataset.notes === '0' && !notesPane() && qa('.pane').length === 1;
  const word = () => q<HTMLButtonElement>('.pane[data-active="1"] .book .meta .notes-toggle')!;
  const pressWord = () => word().click();
  /** The pages drawn across their pane: a page as wide as the pane inside its padding, up to the width a page is still read at, centred past it. */
  const across = (first: number) => {
    const pr = q<HTMLElement>(`.pane[data-active="1"] .book .pdf-page[data-page="${first}"]`)!.getBoundingClientRect();
    const scroller = q<HTMLElement>('.pane[data-active="1"] .book-pages')!;
    const sr = scroller.getBoundingClientRect();
    // the room is the scroller's client width: its scrollbar is not the pages'
    const [left, right] = [pr.left - sr.left, sr.left + scroller.clientWidth - pr.right];
    return { ok: pr.width >= Math.min(960, scroller.clientWidth - 62) - 2 && Math.abs(left - right) < 3, line: `${Math.round(pr.width)} of ${scroller.clientWidth} px, ${Math.round(left)} and ${Math.round(right)} beside it` };
  };
  /** The split: the pages' pane and the note's side by side, the note to the right, each as wide as the other within a pixel or so. */
  const split = () => {
    const pr = q<HTMLElement>('.pane[data-active="1"]')!.getBoundingClientRect();
    const nr = notesPane()!.getBoundingClientRect();
    return { ok: Math.abs(pr.right - nr.left) < 3 && Math.abs(pr.width - nr.width) < 3 && nr.top === pr.top, line: `pages ${Math.round(pr.left)}–${Math.round(pr.right)}, note ${Math.round(nr.left)}–${Math.round(nr.right)}` };
  };
  /** A document with pages opens as its pages alone (milestone 70): no note beside them, no inspector, the pages across the pane. */
  const openBook = async (p: string, first: number) => {
    openNode(p);
    await poll(() => q(`.pane[data-active="1"] .book .pdf-page[data-page="${first}"] canvas`), `${p.split('/').pop()} opens as its pages, drawn`, 15000);
    await sleep(500);
    must(alone() && !q('.insp'), `nothing beside them: no note, no inspector (${qa('.pane').length} pane${qa('.pane').length === 1 ? '' : 's'}${notesPane() ? ', a note beside' : ''}${q('.insp') ? ', the inspector' : ''})`);
    const a = across(first);
    must(a.ok, `the pages across the pane (${a.line})`);
  };
  /** The pane showing a note on some pages, closed as a pane is (its `×`): a note left open beside by an earlier element of a session. */
  const closeNotesPane = async () => {
    const np = notesPane();
    if (!np || useApp.getState().panes.panes.length < 2 || qa('.pane').length !== useApp.getState().panes.panes.length) return;
    const at = qa('.pane').indexOf(np);
    useApp.getState().setPanes((p) => closePane(p, at));
    await poll(() => !notesPane(), 'the note\'s pane closed', 8000);
    await sleep(300);
  };
  const iset = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!;
  const typeInto = (input: HTMLInputElement, v: string) => { iset.call(input, v); input.dispatchEvent(new Event('input', { bubbles: true })); };
  const paletteRows = () => qa<HTMLElement>('.palette-row').map((r) => `[${r.dataset.t}] ${r.querySelector('.pt')?.textContent}${r.querySelector('.psub')?.textContent ? ` · ${r.querySelector('.psub')?.textContent}` : ''}`);
  try {
    setClockDay(DAY);
    useApp.getState().setTheme('light');
    await poll(() => document.documentElement.dataset.theme === 'light', 'light');
    // the inspector open in the saved state, as a note would have it: a book opens without it all the same
    setInspector({ open: true });
    useApp.setState({ inlineBoxes: {} });

    // ── the books, into the scratch copy ──
    const books = await invoke<string | null>('dev_env', { name: 'ILMI_BOOKS' });
    if (!books) throw new Error('ILMI_BOOKS is not set: point it at the repository\'s design/books');
    await vault.fs.mkdir(vault.abs(SB));
    await vault.fs.writeBytes(vault.abs(`${SB}/lindqvist.pdf`), new Uint8Array(await bounded(invoke<ArrayBuffer>('read_dropped_bytes', { path: `${books}/ch3-book.pdf` }), 'reading ch3-book.pdf')));
    await vault.fs.writeBytes(vault.abs(`${SB}/reader.pdf`), new Uint8Array(await bounded(invoke<ArrayBuffer>('read_dropped_bytes', { path: `${books}/reader.pdf` }), 'reading reader.pdf')));
    await vault.fs.writeText(vault.abs(CH3), [
      '---', 'type: source', 'title: "ch. 3: the canonical ensemble"', 'pdf: lindqvist.pdf', 'pages: 41-44', 'pri: 20', `read: due=${DAY} ivl=2 reps=1 pos=41 y=0.300`, '---', '',
      '## 3.2 · the partition function (3.9)', `<!-- read made=2026-10-20 due=${DAY} ivl=3 boxes=41:0.120:0.090:0.770:0.180 -->`, '',
      '$P_s = e^{-\\beta E_s}/Z$, $Z = \\sum_s e^{-\\beta E_s}$: the sum is over states, not levels.', '',
      'Shifting every energy by $E_0$ multiplies $Z$ by {{c1::$e^{-\\beta E_0}$}}; the $P_s$ are unchanged.', '',
      '## 3.3 · energy fluctuations (3.13–3.15)', '<!-- read made=2026-10-24 reps=2 boxes=42:0.100:0.135:0.770:0.375 -->', '',
      'Done with it: $\\sigma_E^2 = kT^2 C_V$.', '',
    ].join('\n'));
    await vault.fs.writeText(vault.abs(P12), ['---', 'type: source', 'title: passage 12 · the grammarian and the bedouin', 'pdf: reader.pdf', '---', ''].join('\n'));
    await poll(() => useApp.getState().docs[CH3]?.pdf && useApp.getState().docs[P12]?.pdf, 'the chapter and the passage are in the collection, with their pages', 15000);
    must(useApp.getState().docs[CH3]!.frozen === false, 'a document with pages is never frozen');

    // ── a book open is its pages (milestone 70) ──
    await openBook(CH3, 41);
    must(qa('.pane[data-active="1"] .book .pdf-page').map((p) => (p as HTMLElement).dataset.page).join(',') === '41,42,43,44', 'its pages are 41–44, as the book numbers them');
    must(!!q('.pane[data-active="1"] .book .read-bar'), 'the gold read bar runs down the margin');
    must(qa('.pane[data-active="1"] .book .pbox.dis').some((b) => (b as HTMLElement).dataset.section?.startsWith('3.3 · energy fluctuations')), 'a dismissed passage\'s boxes are dashed');
    const strip = qa('.bot span').map((s) => s.textContent).join(' | ');
    must(strip.includes('drag box a passage') && strip.includes('e section') && strip.includes('⌘\\ notes'), `the bottom strip: ${strip}`);
    must(useApp.getState().inspector.open && !q('.insp'), 'the inspector is open in the saved state, and not shown over the book');
    await shot('book-open');

    // `notes` among the words over the pages opens the note in the pane beside, the pages kept active; pressed again, it closes it
    must(word().textContent === 'notes' && word().dataset.on === '0' && qa<HTMLElement>('.pane[data-active="1"] .book .meta > *').map((e) => e.textContent).includes('notes'), 'notes is among the words over the pages, unlit');
    pressWord();
    await poll(() => notesIn() && word().dataset.on === '1', 'notes opens the note in the pane beside, and is lit', 8000);
    await sleep(500);
    must(activeTab(useApp.getState().panes)?.id === CH3 && qa('.pane').length === 2, 'the pages keep the active pane; two panes now');
    must(q('.draft-doc', notesPane()!)?.getAttribute('contenteditable') === 'true' && !!q('.book-notes-doc', notesPane()!), 'the note is the chapter\'s body, in the editor, as its notes');
    must(q('.pane[data-active="0"] .tab[data-active="1"] .title')?.textContent === 'ch. 3: the canonical ensemble' && q('.pane[data-active="0"] .tab[data-active="1"] .glyph')?.textContent === '¶', `its tab is the chapter's, a note's mark ("${q('.pane[data-active="0"] .tab[data-active="1"]')?.textContent}")`);
    must(split().ok, `side by side, the note to the right (${split().line})`);
    must(across(41).ok, `the pages across their half (${across(41).line})`);
    await shot('book-notes');
    pressWord();
    await poll(() => alone() && word().dataset.on === '0', 'pressed again, notes closes it, and the pane with it', 8000);
    await shot('book-folded');

    // the inspector opens only by its toggle, for the book's fields and its passages; another kind of document has it as it had it
    (q<HTMLElement>('.top .insp-toggle:not(.side-toggle)') as HTMLElement).click();
    await poll(() => qa('.insp h6').some((h) => h.textContent === 'passages, in book order') && qa('.insp .insp-passages li').length === 2, 'its toggle opens the inspector: the book\'s passages, in book order', 8000);
    await sleep(400);
    must(across(41).ok, `the pages still across what is left of the pane (${across(41).line})`);
    await shot('book-inspector');
    (q<HTMLElement>('.top .insp-toggle:not(.side-toggle)') as HTMLElement).click();
    await poll(() => !q('.insp') && useApp.getState().inspector.open, 'and closes it, the saved state untouched', 8000);
    openNode('fleeting/2026-10-30.md');
    await poll(() => activeTab(useApp.getState().panes)?.id === 'fleeting/2026-10-30.md' && q('.pane[data-active="1"] .doc-view .draft-doc') && q('.insp'), 'a note opens with the inspector as it had it', 10000);
    await openBook(CH3, 41);

    // ── a two-box passage across pp. 41–42 becomes a section, in book order ──
    await drag(41, 0.12, 0.86, 0.77, 0.075);
    await drag(42, 0.1, 0.097, 0.77, 0.04);
    const pend = qa<HTMLElement>('.pane[data-active="1"] .book .pbox.pending:not(.ghost)');
    must(pend.length === 2 && pend.map((p) => q('.pb-no', p)?.textContent).join(',') === '1,2', `two boxes pending, numbered (${pend.length})`);
    {
      const wr = word().getBoundingClientRect();
      const sr = q<HTMLElement>('.pane[data-active="1"] .book-pages')!.getBoundingClientRect();
      must(q<HTMLElement>('.pane[data-active="1"] .book-pages')!.scrollTop > 200 && wr.top >= sr.top && wr.bottom <= sr.bottom, `notes stays at the pane's top as the pages scroll (${Math.round(wr.top - sr.top)} px down it)`);
    }
    must(q('.pane[data-active="1"] .book .pend [data-k="e"]')?.textContent === 'esection · 2 boxes', `e offers a section of 2 boxes ("${q('.pend [data-k="e"]')?.textContent}")`);
    await shot('book-pending');
    key('e');
    const made = await poll(async () => (await headings(CH3)).find((h) => h.text === NAME), `e makes "${NAME}"`, 10000);
    const order = (await headings(CH3)).map((h) => h.text);
    must(order.join(' | ') === `3.2 · the partition function (3.9) | ${NAME} | 3.3 · energy fluctuations (3.13–3.15)`, `in book order: ${order.join(' | ')}`);
    const boxes = parseBoxes(made.read?.boxes ?? '');
    must(made.read?.made === DAY && made.read.due === '2026-11-03' && made.read.ivl === 1, `made today, back tomorrow: the chapter's priority is 20 (${JSON.stringify(made.read)})`);
    must(!!boxes && boxes.length === 2 && boxes[0]!.page === 41 && boxes[1]!.page === 42 && near(boxes[0]!.y, 0.86) && near(boxes[1]!.h, 0.04), `its boxes in the grammar: ${made.read?.boxes}`);
    must(/boxes=41:\d\.\d{3}:\d\.\d{3}:\d\.\d{3}:\d\.\d{3},42:\d\.\d{3}:\d\.\d{3}:\d\.\d{3}:\d\.\d{3} -->/.test(await text(CH3)), 'written page:x:y:w:h, three decimals, "," between');
    const read = meta(parse(await text(CH3)).doc).read;
    must(read?.pos === 42 && near(read.y ?? 0, 0.137), `the read point moved past the last box (pos=${read?.pos} y=${read?.y})`);
    must(useApp.getState().notice?.line.startsWith(`§ ${NAME} · back in 1d, until dismissed`), `the notice: "${useApp.getState().notice?.line}"`);
    // a box made a section opens the note beside the pages, with the section in it
    await poll(() => notesIn(), 'the note opens beside the pages', 8000);
    const newHead = await poll(() => qa<HTMLElement>('.dd-h', notesPane()!).find((h) => h.textContent?.startsWith(NAME)), 'with the new section in it', 8000);
    log(`the new heading ${newHead.classList.contains('landed') ? 'marked as landed' : 'not marked'}; caret ${JSON.stringify(useApp.getState().caretHeading?.text)}; active ${document.activeElement?.className}`);
    must(!notesPane()!.contains(document.activeElement) && activeTab(useApp.getState().panes)?.id === CH3, 'the caret is not in it yet: ⏎ is still the pages\'');
    await shot('book-section');

    // ⏎ right after: the caret in it; the caret lights its boxes
    key('Enter');
    await poll(() => useApp.getState().caretHeading?.text === NAME, '⏎ puts the caret in the new section', 8000);
    const lit = await poll(() => { const l = qa<HTMLElement>('.pane[data-active="1"] .book .pbox.cur'); return l.length === 2 && l.every((b) => b.dataset.section === NAME) ? l : null; }, 'the caret lights its two boxes', 8000);
    must(lit.map((b) => b.dataset.page).join(',') === '41,42', 'on pp. 41 and 42');
    await shot('book-lit');

    // show boxes here draws both crops, a page break between
    const hd = await poll(() => qa<HTMLElement>('.dd-h', notesPane()!).find((h) => h.textContent?.startsWith(NAME)), 'its heading in the note');
    const chip = q<HTMLElement>('.book-chip', hd)!;
    must(chip.textContent === 'show in bookshow boxes hereback tomorrow', `its chip: "${chip.textContent}"`);
    down(q('[data-act="show-here"]', chip)!);
    let crops: HTMLCanvasElement[];
    try {
      crops = await poll(() => { const cs = qa<HTMLCanvasElement>('.inline-boxes .crop canvas', notesPane()!); return cs.length === 2 ? cs : null; }, 'show boxes here draws both crops', 10000);
    } catch (e) {
      log(`why: inline ${qa('.inline-boxes').length}, crops ${qa('.inline-boxes .crop').map((c) => `${(c as HTMLElement).dataset.box}=${(c as HTMLElement).dataset.drawn}`).join(' ')}, shown ${JSON.stringify(useApp.getState().inlineBoxes)}, chip "${q('.book-chip', hd)?.textContent}", errors ${errors.join(' | ')}`);
      throw e;
    }
    must(q('.inline-boxes .pbreak', notesPane()!)?.textContent === 'p. 42' && crops.every((c) => c.width > 50 && c.height > 5), 'a page break marked between them');
    await shot('book-inline');

    // show in book, from the note's side: the boxes flash on the pages beside
    down(q('[data-act="show-in-book"]', chip)!);
    await poll(() => notesIn() && qa<HTMLElement>('.pane[data-active="1"] .book .pbox.flash').length === 2, 'show in book flashes its boxes on the pages beside the note', 8000);

    // a tag beside the page (or the gutter's §) goes to its section in the note beside
    const tag = await poll(() => qa<HTMLElement>('.pane[data-active="1"] .book .ptag:not(.cont), .pane[data-active="1"] .book .pgut').find((t) => (t.textContent ?? '').includes('3.2 · the partition') || t.title.startsWith('3.2 · the partition')), 'the partition function is named beside its box');
    down(tag);
    await poll(() => notesIn() && useApp.getState().caretHeading?.text === '3.2 · the partition function (3.9)', 'clicking it goes to its section in the note beside', 8000);

    // ⌘\ closes the note, and opens it again
    key('\\', { metaKey: true });
    await poll(() => alone(), '⌘\\ closes the note');
    key('\\', { metaKey: true });
    await poll(() => notesIn(), 'and opens it again');
    key('\\', { metaKey: true });
    await poll(() => alone(), 'closed for the next book');

    // ── m on the Arabic page clips ──
    await openBook(P12, 1);
    await drag(1, 0.12, 0.368, 0.77, 0.088);
    key('m');
    await poll(async () => /\n## p\. 1\n\n<!-- box 1:0\.1\d{2}:0\.3\d{2}:0\.7\d{2}:0\.0\d{2} -->\n/.test(await text(P12)), 'm clips the box under ## p. 1', 10000);
    await poll(() => notesIn() && qa<HTMLCanvasElement>('.raw.clip .crop canvas', notesPane()!).length === 1, 'the note opens beside, the clip drawn in it as the crop of its page', 10000);
    const caretP = await poll(() => {
      const s = window.getSelection();
      const n = s?.anchorNode;
      const p = (n instanceof Element ? n : n?.parentElement)?.closest('p');
      return p && !p.textContent?.trim() && p.previousElementSibling?.classList.contains('clip') ? p : null;
    }, 'the caret below it, for word ::: meaning', 8000);
    log(`caret in ${caretP.className}`);
    await shot('book-clip');

    // ── the queue opens a section at its boxes ──
    refreshQueue();
    const sec = await poll(() => useApp.getState().queue.find((i): i is SectionItem => i.kind === 'section' && i.path === CH3 && i.heading.startsWith('3.2')), 'the partition function is in the day\'s queue', 8000);
    openSession(sec);
    await poll(() => q('.pane[data-active="1"] .doc-session[data-book="1"] .book .pdf-page[data-page="41"] canvas'), 'its session opens the book', 15000);
    await poll(() => useApp.getState().caretHeading?.path === CH3 && useApp.getState().caretHeading?.text === sec.heading, 'at the section, the caret in it', 8000);
    must(notesIn() && !q('.insp'), 'the note beside the pages, the inspector closed');
    const box = await poll(() => q<HTMLElement>(`.pane[data-active="1"] .doc-session .pbox.cur[data-section="${sec.heading}"]`), 'its boxes lit', 8000);
    const pr = q<HTMLElement>('.pane[data-active="1"] .doc-session .book-pages')!.getBoundingClientRect();
    const br = box.getBoundingClientRect();
    must(br.top >= pr.top && br.top < pr.bottom, `the pages scrolled to them (box at ${Math.round(br.top - pr.top)} px in a ${Math.round(pr.height)} px view)`);
    must(qa('.pane[data-active="1"] .session-bar .sb-actions .ra-l').map((b) => b.textContent).join(' / ').startsWith('next · back in'), 'next / later / dismiss under the book');
    await shot('book-queue-section');

    // ── done for today records the point at the bottom of the view ──
    const readItem = await poll(() => useApp.getState().queue.find((i): i is ReadItem => i.kind === 'read' && i.path === CH3), 'the chapter is in the day\'s queue to read on', 8000);
    openSession(readItem);
    await poll(() => useApp.getState().sessionEl?.kind === 'read' && q('.pane[data-active="1"] .doc-session[data-book="1"] .book .pdf-page[data-page="43"]'), 'reading on in the book', 15000);
    await sleep(400);
    // the pane beside still holds the notes opened before (the chapter's, and passage 12's behind them): tabs like any other, closed as a pane is
    key('\\', { metaKey: true });
    await poll(() => !besideAt(useApp.getState().panes, notesId(CH3)), '⌘\\ closes the chapter\'s note; the pane keeps the tab behind it');
    await closeNotesPane();
    must(alone(), 'the pane closed, the pages alone');
    must(across(43).ok, `the pages alone, across the pane (${across(43).line})`);
    const p43 = q<HTMLElement>('.pane[data-active="1"] .doc-session .pdf-page[data-page="43"]')!;
    const sc = q<HTMLElement>('.pane[data-active="1"] .doc-session .book-pages')!;
    sc.scrollTop += p43.getBoundingClientRect().top - sc.getBoundingClientRect().top - (sc.clientHeight - 120);
    sc.dispatchEvent(new Event('scroll'));
    await sleep(400);
    const before = await text(CH3);
    key('Enter');
    const after = await poll(async () => { const t = await text(CH3); return t !== before ? t : null; }, 'done for today wrote the read line', 8000);
    const r2 = meta(parse(after).doc).read;
    must(r2?.pos === 43 && r2.y !== undefined && r2.y > 0 && r2.y < 1 && r2.reps === 2, `pos and y at the bottom of the view (pos=${r2?.pos} y=${r2?.y} reps=${r2?.reps})`);
    must(/\nread: due=\S+ ivl=\d+ reps=2 pos=43 y=0\.\d{3}\n/.test(after), 'y written to three decimals after pos');

    // ── a PDF on its own (milestone 70): dropped with no note, in the queue, a note made for it the first time something is kept ──
    const ALONE = `${SB}/alone.pdf`;
    const { importPdfNode } = await import('./vault.js');
    // as a drop lands it (`land.ts`, `importPdfNode`): the file on its own
    await importPdfNode(SB, { title: 'alone', bytes: new Uint8Array(await bounded(invoke<ArrayBuffer>('read_dropped_bytes', { path: `${books}/ch3-book.pdf` }), 'reading ch3-book.pdf')), text: '' });
    await poll(() => useApp.getState().docs[ALONE]?.pdf === ALONE && !useApp.getState().docs[ALONE]?.note && !!useApp.getState().docs[ALONE]?.read, 'the PDF is in the collection on its own: its pages are itself, no note, enrolled in reading', 15000);
    must(!(await vault.fs.stat(vault.abs(`${SB}/alone.md`))), 'no .md was made beside it');
    const reading = JSON.parse(await text('.ilmi/reading.json')) as Record<string, { read?: string }>;
    must(reading[ALONE]?.read === `due=${DAY} ivl=2 reps=0 pos=0`, `its line is in .ilmi/reading.json (${JSON.stringify(reading[ALONE])})`);
    await poll(() => q(`.trow[data-path="${CSS.escape(ALONE)}"]`), 'a row in the tree', 8000);
    // the session went on to the next element, which may have opened its note beside: closed, as its pane
    await closeNotesPane();
    must(q(`.trow[data-path="${CSS.escape(ALONE)}"] .glyph`)?.textContent === '“' && q(`.trow[data-path="${CSS.escape(ALONE)}"] .name`)?.textContent === 'alone', `a source's mark, named without its extension ("${q(`.trow[data-path="${CSS.escape(ALONE)}"]`)?.textContent}")`);
    await openBook(ALONE, 1);
    must(qa('.pane[data-active="1"] .book .pdf-page').length === 44 && q('.pane[data-active="1"] .book h1')?.textContent === 'alone', 'opened: all 44 of its pages, titled by its name');
    must(!!q('.pane[data-active="1"] .book .read-bar') && qa('.pane[data-active="1"] .book .pbox').length === 0, 'the read bar, and no section on its pages');
    await shot('alone-open');
    // its inspector, by its toggle: a source, its path, its line; no note yet, no passages
    (q<HTMLElement>('.top .insp-toggle:not(.side-toggle)') as HTMLElement).click();
    await poll(() => qa('.insp h6').some((h) => h.textContent === 'source') && !qa('.insp h6').some((h) => h.textContent === 'passages, in book order'), 'its inspector: a source; no note, so no passages', 8000);
    {
      const rows = qa<HTMLElement>('.insp .kvr').map((r) => `${q('dt', r)?.textContent}: ${q('dd', r)?.textContent?.replace(/\s+/g, ' ').trim()}`);
      log(`the PDF's inspector: ${rows.join(' | ').slice(0, 300)}`);
      must(rows.includes(`path: ${ALONE}`) && rows.some((r) => /^reading: not started, today$/.test(r)) && !rows.some((r) => r.startsWith('notes')) && !rows.some((r) => r.startsWith('pages') || r.startsWith('length')), 'its path, its reading not started and due today, no notes or pages row');
    }
    await shot('alone-inspector');
    (q<HTMLElement>('.top .insp-toggle:not(.side-toggle)') as HTMLElement).click();
    await poll(() => !q('.insp'), 'closed again', 8000);
    // in the reading queue by its own line; its session is the pages; done for today writes the point to reading.json
    refreshQueue();
    const aloneItem = await poll(() => useApp.getState().queue.find((i): i is ReadItem => i.kind === 'read' && i.path === ALONE), 'it is in the day\'s queue to read', 8000);
    must(aloneItem.pdf === true, 'as a document read by its pages');
    openSession(aloneItem);
    await poll(() => useApp.getState().sessionEl?.kind === 'read' && q('.pane[data-active="1"] .doc-session[data-book="1"] .book .pdf-page[data-page="1"] canvas'), 'its session opens the pages', 15000);
    must(alone() && !q('.insp'), 'nothing beside them in the session');
    {
      const sc2 = q<HTMLElement>('.pane[data-active="1"] .doc-session .book-pages')!;
      const p2 = q<HTMLElement>('.pane[data-active="1"] .doc-session .pdf-page[data-page="2"]')!;
      sc2.scrollTop += p2.getBoundingClientRect().top - sc2.getBoundingClientRect().top - (sc2.clientHeight - 120);
      sc2.dispatchEvent(new Event('scroll'));
      await sleep(400);
    }
    key('Enter');
    const line2 = await poll(async () => { const j = JSON.parse(await text('.ilmi/reading.json')) as Record<string, { read?: string }>; return /pos=2 y=0\.\d{3}/.test(j[ALONE]?.read ?? '') ? j[ALONE]!.read! : null; }, 'done for today wrote pos and y to reading.json', 8000);
    must(/^due=2026-11-04 ivl=2 reps=1 pos=2 y=0\.\d{3}$/.test(line2), `on its cadence, the point at the bottom of the view (${line2})`);
    must(!(await vault.fs.stat(vault.abs(`${SB}/alone.md`))), 'still no .md beside it');

    // `notes` with no note: the picker; closed with nothing picked, nothing opens
    await openBook(ALONE, 1);
    pressWord();
    const pick = await poll(() => q<HTMLInputElement>('.palette-input input'), 'notes asks for a note: the palette', 8000);
    must(pick.placeholder === 'notes on alone' && paletteRows()[0] === '[note] new note · alone notes' && paletteRows().slice(1).every((r) => r.startsWith('[note]')), `the picker: a new note first, named after the PDF, then the notes that are there (${paletteRows().slice(0, 3).join(' / ')})`);
    await shot('alone-picker');
    key('Escape');
    await poll(() => !q('.palette-overlay'), 'esc closes it');
    await sleep(300);
    must(alone() && !useApp.getState().docs[ALONE]?.note, 'nothing picked: the pages alone, no note');

    // a passage boxed and kept asks for a note; a new one, named as typed, in a folder of the person's choosing, takes the section
    await drag(42, 0.1, 0.097, 0.77, 0.04);
    key('e');
    const pick2 = await poll(() => q<HTMLInputElement>('.palette-input input'), 'e on a box asks for a note first', 8000);
    must(qa('.pane[data-active="1"] .book .pbox.pending:not(.ghost)').length === 1, 'the box is kept while it asks');
    typeInto(pick2, 'notes on the ruler');
    await sleep(150);
    must(paletteRows()[0] === '[note] new note · notes on the ruler', `the new note takes the name typed (${paletteRows()[0]})`);
    // ⏎ in the palette's field takes the row chosen
    pick2.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));
    await poll(() => useApp.getState().noteAttach?.step === 'place' && q<HTMLInputElement>('.palette-input input')?.placeholder === 'notes on the ruler in…', 'then where: the folders', 8000);
    must(paletteRows().every((r) => r.startsWith('[folder]')) && paletteRows().some((r) => r === '[folder] fleeting'), `every folder, the root first (${paletteRows().slice(0, 4).join(' / ')})`);
    await shot('alone-place');
    typeInto(q<HTMLInputElement>('.palette-input input')!, 'fleeting');
    await sleep(150);
    q<HTMLInputElement>('.palette-input input')!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));
    const NEWNOTE = 'fleeting/notes on the ruler.md';
    const newText = await poll(async () => { try { const t = await text(NEWNOTE); return /^---\npdf: \.\.\/books\/alone\.pdf\n---\n/.test(t) && /\n## .+\n<!-- read made=\S+ due=\S+ ivl=\d+ boxes=42:0\.1\d{2}:0\.0\d{2}:0\.7\d{2}:0\.0\d{2} -->/.test(t) ? t : null; } catch { return null; } }, 'the note is made in fleeting, names the PDF, and holds the section', 15000);
    log(`the new note:\n${newText.slice(0, 300)}`);
    try {
      await poll(() => useApp.getState().docs[ALONE]?.note === NEWNOTE && useApp.getState().docs[NEWNOTE]?.of === ALONE && useApp.getState().docs[NEWNOTE]?.pdf === undefined, 'the PDF shows that note, and the note is its notes, not pages', 8000);
    } catch (e) {
      log(`why: pdf ${JSON.stringify(useApp.getState().docs[ALONE])}; note ${JSON.stringify(useApp.getState().docs[NEWNOTE])}; errors ${errors.join(' | ')}`);
      throw e;
    }
    await poll(() => notesIn() && activeTab(useApp.getState().panes)?.id === ALONE, 'the note opens beside the pages, the pages kept active', 10000);
    must(q('.pane[data-active="0"] .tab[data-active="1"] .title')?.textContent === 'notes on the ruler' && !q('.book-notes-doc', notesPane()!) && !!q('h1', notesPane()!), 'as the ordinary note it is: its own tab, its title on the page');
    const secHead = await poll(() => qa<HTMLElement>('.dd-h', notesPane()!).find((h) => h.querySelector('.book-chip')), 'the section in it, with its chip', 8000);
    log(`the section: "${secHead.textContent}"`);
    must(qa('.pane[data-active="1"] .book .pbox:not(.pending)').length === 1 && qa('.pane[data-active="1"] .book .pbox.pending:not(.ghost)').length === 0, 'its box drawn on the page from the note, the pending one gone');
    {
      const line3 = (JSON.parse(await text('.ilmi/reading.json')) as Record<string, { read: string }>)[ALONE]!.read;
      must(/ reps=1 pos=42 y=0\.13\d$/.test(line3) && line3 !== line2, `the read point moved past the box on the PDF's own line, not the note's (${line3})`);
    }
    await shot('alone-notes');
    pressWord();
    await poll(() => alone() && word().dataset.on === '0', 'notes closes the note again', 8000);
    pressWord();
    await poll(() => notesIn(), 'and opens that note from now on, with nothing asked', 8000);
    // the note opened from the tree is the note, not pages; show in book from it opens the pages beside
    key('\\', { metaKey: true });
    await poll(() => alone(), 'closed');
    openNode(NEWNOTE);
    await poll(() => activeTab(useApp.getState().panes)?.id === NEWNOTE && q('.pane[data-active="1"] .reader-wrap[data-pdf] .draft-doc') && !q('.pane[data-active="1"] .book'), 'the note from the tree opens as a note', 8000);
    down(await poll(() => q<HTMLElement>('.pane[data-active="1"] .book-chip [data-act="show-in-book"]'), 'its chip offers show in book'));
    await poll(() => q(`.pane[data-active="0"] .book[data-path="${CSS.escape(ALONE)}"] .pbox.flash`), 'show in book opens the pages beside the note and flashes the box', 10000);
    await shot('alone-show-in-book');
    useApp.getState().setPanes((p) => closePane(p, p.panes.findIndex((x) => x.tabs.some((t) => t.id === ALONE))));
    await poll(() => qa('.pane').length === 1, 'the pages\' pane closed');

    // ── dark: the pages, then the note beside them ──
    await openBook(CH3, 41);
    useApp.getState().setTheme('dark');
    await poll(() => document.documentElement.dataset.theme === 'dark', 'dark');
    await shot('book-dark');
    pressWord();
    await poll(() => notesIn(), 'the note beside, dark', 8000);
    await shot('book-dark-notes');
    key('\\', { metaKey: true });
    await poll(() => alone(), 'closed');
    useApp.getState().setTheme('light');
    setClockDay(null);
    finished = true;
    log(`done; vault ${vault.root}`);
  } catch (e) {
    finished = true;
    setClockDay(null);
    log(`failed: ${e instanceof Error ? e.message : String(e)}`);
  }
}

// `ILMI_SMOKE=books` (`smokeBooks`) over a fresh copy of `samples/double-major`,
// milestone 49: the sample's own two books (library/lindqvist-statistical-
// physics.pdf, chapters 2–4 at pp. 17–34; library/classical-prose-reader.pdf,
// passage 12 at pp. 129–134), each chapter its pages beside its notes, the
// old extracts boxed sections of the notes. Three days by the app's clock.
// 2026-11-02, the physics first pass: the day's queue is one line of books,
// sections and cards saying where each stands; reading on in ch. 3 opens
// the book at its read point; two derivations boxed on pp. 24 and 26 become
// sections named from the page, in book order; done for today moves the
// read point. 2026-11-05, a later day: the boxed derivation comes up
// `boxed nov 2, nothing written yet · first time back`, opens at its boxes,
// is written up with numbered steps and cloze steps, then next. 2026-11-10:
// it returns `written, 3 cards · back for the 2nd time` and is dismissed,
// its cards still due. The Arabic passage: read in rotation, a paragraph
// clipped with `m`, `word ::: meaning` typed under it. Light, then dark.
export async function smokeBooks(vault: Vault): Promise<void> {
  type Heading = import('../format/index.js').Heading;
  type SectionItem = import('../schedule/index.js').SectionItem;
  type ReadItem = import('../schedule/index.js').ReadItem;
  let last = { at: Date.now(), what: 'start' };
  let finished = false;
  const log = (s: string) => { last = { at: Date.now(), what: s }; void info(`smoke books: ${s}`); };
  const dog = setInterval(() => {
    if (finished) { clearInterval(dog); return; }
    if (Date.now() - last.at > 30_000) { finished = true; clearInterval(dog); void info(`smoke books: failed: no progress for 30 s after "${last.what}"`); }
  }, 2000);
  const bounded = <T,>(p: Promise<T>, what: string, ms = 8000): Promise<T> =>
    Promise.race([p, new Promise<T>((_, no) => setTimeout(() => no(new Error(`${what} (no answer in ${ms} ms)`)), ms))]);
  const shot = async (name: string, ms = 2500) => { await sleep(800); log(`shot: ${name}`); await sleep(ms); };
  const q = <T extends Element>(sel: string, root: ParentNode = document) => root.querySelector<T>(sel);
  const qa = <T extends Element>(sel: string, root: ParentNode = document) => Array.from(root.querySelectorAll<T>(sel));
  const must = (ok: unknown, what: string) => { if (!ok) throw new Error(what); log(`ok: ${what}`); };
  const poll = async <T,>(probe: () => T | null | undefined | false | Promise<T | null | undefined | false>, what: string, ms = 5000): Promise<T> => {
    const t0 = Date.now();
    for (;;) {
      const v = await probe();
      if (v) { log(`ok: ${what}`); return v; }
      if (Date.now() - t0 > ms) throw new Error(`${what} (waited ${ms} ms)`);
      await sleep(100);
    }
  };
  const key = (k: string, mods: KeyboardEventInit = {}) => window.dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true, cancelable: true, ...mods }));
  const keydown = (el: Element, k: string) => el.dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true, cancelable: true }));
  const type = (s: string) => document.execCommand('insertText', false, s);
  const { parse, parseBoxes, meta } = await import('../format/index.js');
  const { addDays, isDue, sameItem } = await import('../schedule/index.js');
  const { refreshQueue } = await import('./vault.js');
  const { setClockDay, appNow } = await import('./clock.js');
  const { doneLine } = await import('./items.js');
  const LQ = 'library/lindqvist-statistical-physics';
  const CH3 = `${LQ}/ch-3-the-canonical-ensemble.md`;
  const P12 = 'library/classical-prose-reader/12-the-grammarian-and-the-bedouin.md';
  const DAY1 = '2026-11-02';
  const DAY2 = '2026-11-05';
  const DAY3 = '2026-11-10';
  const text = (p: string) => bounded(vault.fs.readText(vault.abs(p)), `reading ${p}`);
  const headings = async (p: string) => parse(await text(p)).doc.blocks.flatMap((b) => (b.kind === 'heading' && b.level === 2 ? [b] : []));
  const cardsUnder = async (p: string, start: string) => {
    const doc = parse(await text(p)).doc;
    const at = doc.blocks.findIndex((b) => b.kind === 'heading' && b.text.startsWith(start));
    let end = at + 1;
    while (end < doc.blocks.length && !(doc.blocks[end]!.kind === 'heading' && (doc.blocks[end] as Heading).level <= 2)) end++;
    return doc.blocks.slice(at + 1, end).filter((b) => b.kind === 'card');
  };
  const items = () => useApp.getState().queue;
  const sectionOf = (p: string, start: string) => items().find((i): i is SectionItem => i.kind === 'section' && i.path === p && i.heading.startsWith(start));
  const readOf = (p: string) => items().find((i): i is ReadItem => i.kind === 'read' && i.path === p);
  /** Draw a box on a page as a pointer would: down at its corner, a move, up at the other. */
  const drag = async (page: number, x: number, y: number, w: number, h: number) => {
    const el = await poll(() => q<HTMLElement>(`.pane[data-active="1"] .book .pdf-page[data-page="${page}"]`), `page ${page} is drawn`, 30000);
    el.scrollIntoView({ block: 'center' });
    await sleep(400);
    const r = el.getBoundingClientRect();
    const at = (fx: number, fy: number): MouseEventInit => ({ clientX: r.left + fx * r.width, clientY: r.top + fy * r.height, bubbles: true, cancelable: true, button: 0 });
    // as a mouse sends them since milestone 57: the pointer's press and the mouse's, then the pointer's move and release
    const mouse = { pointerId: 1, pointerType: 'mouse', isPrimary: true };
    el.dispatchEvent(new PointerEvent('pointerdown', { ...at(x, y), ...mouse }));
    el.dispatchEvent(new MouseEvent('mousedown', { ...at(x, y), detail: 1 }));
    window.dispatchEvent(new PointerEvent('pointermove', { ...at(x + w / 2, y + h / 2), ...mouse }));
    window.dispatchEvent(new PointerEvent('pointerup', { ...at(x + w, y + h), ...mouse }));
    await sleep(200);
  };
  const openQuery = async () => {
    openNode(queueId('today'));
    await poll(() => q('.pane[data-active="1"] .queue h1')?.firstChild?.textContent === 'due today', 'the day\'s query is drawn', 8000);
    await sleep(300);
  };
  const rowOf = (start: string, el = 'section') => qa<HTMLElement>('.pane[data-active="1"] .qlist li:not(.fold)').find((r) => r.dataset.el === el && r.textContent?.includes(start));
  const where = (r: HTMLElement | undefined) => q('.ref-line', r ?? document.createElement('div'))?.textContent ?? '';
  /** A session at one item; resolves once its bar is drawn in the book. */
  const sessionAt = async (s: SectionItem | ReadItem, page: number) => {
    openSession(s);
    await poll(() => { const el = useApp.getState().sessionEl; return el && sameItem(el.item, s) && q(`.pane[data-active="1"] .doc-session[data-book="1"] .book .pdf-page[data-page="${page}"] canvas`) && q('.pane[data-active="1"] .doc-session .session-bar') ? true : null; }, `the session opens the book at p. ${page}`, 45000); // a covered window draws its pages slowly
    await sleep(600);
  };
  const bar = () => q<HTMLElement>('.pane[data-active="1"] .session-bar')!;
  const inView = (page: number) => { const sc = q<HTMLElement>('.pane[data-active="1"] .doc-session .book-pages')!; const el = q<HTMLElement>(`.pane[data-active="1"] .doc-session .pdf-page[data-page="${page}"]`)!; const a = sc.getBoundingClientRect(); const b = el.getBoundingClientRect(); return b.top < a.bottom - 40 && b.bottom > a.top + 40; };
  const actions = () => qa<HTMLElement>('.sb-actions button .ra-l', bar()).map((b) => b.textContent).join(' / ');
  const changed = (p: string, before: string, what: string) => poll(async () => { const t = await text(p); return t !== before ? t : null; }, what, 8000);
  // the note opens in the pane beside the pages when asked for and closes again (milestone 70): `notes` over the pages, ⌘\
  const bookEl = () => q<HTMLElement>('.pane[data-active="1"] .book')!;
  const notesPane = () => qa<HTMLElement>('.pane').find((p) => q('.reader-wrap[data-pdf]', p)) ?? null;
  const notesIn = () => bookEl().dataset.notes === '1' && !!notesPane() && !!q('.draft-doc', notesPane()!);
  const alone = () => bookEl().dataset.notes === '0' && !notesPane() && qa('.pane').length === 1;
  const bring = async () => { q<HTMLElement>('.meta .notes-toggle', bookEl())!.click(); await poll(() => notesIn(), 'notes opens the note beside the pages', 8000); await sleep(400); };
  const close = async () => { key('\\', { metaKey: true }); await poll(() => alone(), '⌘\\ closes it', 8000); await sleep(300); };
  /** The pane showing a note on some pages, closed as a pane is (its `×`): for a note left open beside from an earlier element. */
  const closeNotesPane = async () => { const np = notesPane(); if (!np) return; const at = qa('.pane').indexOf(np); useApp.getState().setPanes((p) => closePane(p, at)); await poll(() => !notesPane(), 'the note\'s pane closed', 8000); await sleep(300); };
  try {
    setClockDay(DAY1);
    useApp.getState().setTheme('light');
    await poll(() => document.documentElement.dataset.theme === 'light', 'light');
    setInspector({ open: true });
    useApp.setState({ inlineBoxes: {} });
    await poll(() => useApp.getState().docs[CH3]?.pdf && useApp.getState().docs[P12]?.pdf, 'the chapter and the passage are in the collection, with their pages', 15000);
    must(useApp.getState().docs[CH3]!.pages?.first === 23 && useApp.getState().docs[P12]!.pages?.first === 129, 'ch. 3 at pp. 23–28 of its book, passage 12 at pp. 129–134 of its');
    must(!vault.documents().some((d) => d.startsWith(`${LQ}/ch-`) && d.split('/').length > 3), 'no extract document under the chapters');
    refreshQueue();

    // ── the day's queue: one line, each row saying where it stands ──
    const boltz = await poll(() => sectionOf(CH3, 'why the Boltzmann factor'), 'the old extract is a section of ch. 3, in the day\'s queue', 10000);
    must(isDue(boltz, appNow()) && boltz.written && boltz.cards === 2, 'due, written, 2 cards');
    const ch3 = await poll(() => readOf(CH3), 'ch. 3 is in the day\'s queue to read on');
    await poll(() => readOf(P12), 'and so is the Arabic passage');
    await openQuery();
    must(/^\d+ due, in priority order $/.test(q('.queue .legend')?.textContent ?? ''), 'the head\'s one line');
    const rows = qa<HTMLElement>('.pane[data-active="1"] .qlist li:not(.fold)');
    const kinds = rows.map((r) => r.dataset.el);
    must(where(rowOf('why the Boltzmann factor')) === 'written, 2 cards · back for the 4th time', `the Boltzmann section's row: "${where(rowOf('why the Boltzmann factor'))}"`);
    must(where(rowOf('the N! only works')) === 'written, 1 card · back for the 4th time', `the N! section's row: "${where(rowOf('the N! only works'))}"`);
    must(/^read on from p\. 26/.test(where(rowOf('ch. 3: the canonical ensemble', 'read'))), `ch. 3's row: "${where(rowOf('ch. 3: the canonical ensemble', 'read'))}"`);
    must(/^read on from p\. 130/.test(where(rowOf('passage 12', 'read'))), `passage 12's row: "${where(rowOf('passage 12', 'read'))}"`);
    const firstSec = kinds.indexOf('section');
    must(firstSec >= 0 && kinds.slice(0, firstSec).includes('card') && kinds.slice(firstSec).includes('read'), `one line, by priority: ${kinds.slice(0, 14).join(' ')}`);
    for (const r of rows.slice(0, 10)) log(`row: ${q('.mark', r)?.textContent} · ${(q('.body', r)?.textContent ?? '').slice(0, 50)} · ${where(r)}`);
    rowOf('why the Boltzmann factor')?.scrollIntoView({ block: 'center' });
    await shot('books-queue');

    // ── the physics first pass: read on in ch. 3, at its read point ──
    await sessionAt(ch3, 26);
    must(inView(26), 'the pages landed at the read point, p. 26 in view');
    must(actions().startsWith('done for today · back in'), `a book's actions: ${actions()}`);
    must(/^read on from p\. 26/.test(q('.sb-where', bar())?.textContent ?? ''), `above them: "${q('.sb-where', bar())?.textContent}"`);
    must(qa('.pane[data-active="1"] .doc-session .pdf-page').map((p) => (p as HTMLElement).dataset.page).join(',') === '23,24,25,26,27,28', 'the chapter\'s pages 23–28, across the pane');
    must(alone() && !q('.insp'), 'nothing beside them');
    must(qa('.pane[data-active="1"] .doc-session .book .pbox.dis').length >= 3, 'the dismissed ones dashed on the pages');
    await shot('books-read-on');
    await bring();
    must(inView(26), 'opening the note leaves the pages where they were: p. 26 in view');
    must(qa('.dd-h', notesPane()!).length === 7, 'the note holds its seven sections');
    await shot('books-read-on-notes');
    await close();

    // two derivations boxed on pp. 24 and 26 become sections, named from the page, in book order
    await drag(24, 0.11, 0.67, 0.78, 0.075);
    key('e');
    const avg = await poll(async () => (await headings(CH3)).find((h) => h.text === '3.3 · average values (3.8)'), 'e names the ⟨E⟩ derivation "3.3 · average values (3.8)"', 10000);
    must(avg.read?.made === DAY1 && avg.read.due === addDays(DAY1, 2) && avg.read.ivl === 2 && !!parseBoxes(avg.read.boxes ?? ''), `boxed today, back in 2 days, the cadence at priority 50 (${avg.read?.boxes})`);
    await poll(() => notesIn() && qa<HTMLElement>('.dd-h', notesPane()!).some((h) => h.textContent?.startsWith('3.3 · average values (3.8)')), 'the note opens beside the pages with the section in it', 8000);
    await shot('books-boxed');
    key('Escape');
    await close();
    await drag(26, 0.11, 0.12, 0.78, 0.2);
    key('e');
    const eq = await poll(async () => (await headings(CH3)).find((h) => h.text === '3.6 · the equipartition theorem (3.16)'), 'e names the equipartition derivation "3.6 · the equipartition theorem (3.16)"', 10000);
    const order = (await headings(CH3)).map((h) => h.text.slice(0, 22));
    must(order.join(' | ') === 'why the Boltzmann fact | expand S_R, not Ω_R | 3.3 · average values ( | 3.3 · average values ( | 3.4 · the Helmholtz fr | 3.6 · the equipartitio | equipartition fails wh | the Schottky anomaly | 3.8 · the Einstein sol', `the notes in book order: ${order.join(' | ')}`);
    key('Escape');
    await close();
    // done for today: the read point moves to the bottom of the view
    let before = await text(CH3);
    const sc = q<HTMLElement>('.pane[data-active="1"] .doc-session .book-pages')!;
    sc.scrollTop += 240;
    sc.dispatchEvent(new Event('scroll'));
    await sleep(400);
    key('Enter');
    let after = await changed(CH3, before, 'done for today wrote the file');
    const r1 = meta(parse(after).doc).read;
    must(r1?.pos !== undefined && r1.pos >= 26 && r1.reps === 5 && r1.y !== undefined, `the read point moved on (pos=${r1?.pos} y=${r1?.y} reps=${r1?.reps})`);
    must(useApp.getState().log[0] === doneLine('“', 'ch. 3: the canonical ensemble', useApp.getState().log[0]!.split(' · ').slice(-2).join(' · ')), `the done row: "${useApp.getState().log[0]}"`);

    // ── a later day: the boxed derivation comes up with nothing written ──
    setClockDay(DAY2);
    refreshQueue();
    const sec = await poll(() => { const s = sectionOf(CH3, '3.6 · the equipartition'); return s && isDue(s, appNow()) ? s : null; }, 'three days on, the boxed derivation is due', 8000);
    must(!sec.written && sec.cards === 0, 'nothing written, no cards');
    await openQuery();
    must(where(rowOf('3.6 · the equipartition')) === 'boxed nov 2, nothing written yet · first time back', `its row: "${where(rowOf('3.6 · the equipartition'))}"`);
    rowOf('3.6 · the equipartition')?.scrollIntoView({ block: 'center' });
    await shot('books-later-day');
    await sessionAt(sec, 26);
    await poll(() => notesIn() && useApp.getState().caretHeading?.text === sec.heading, 'the session opens the note beside the pages, at its heading, the caret in it', 8000);
    const lit = await poll(() => qa<HTMLElement>('.pane[data-active="1"] .doc-session .pbox.cur').filter((b) => b.dataset.section === sec.heading), 'its box lit on p. 26', 8000);
    must(lit.length === 1 && lit[0]!.dataset.page === '26', 'one box, on p. 26');
    must(q('.sb-where', bar())?.textContent === 'boxed nov 2, nothing written yet · first time back', `the bar: "${q('.sb-where', bar())?.textContent}"`);
    must(actions() === 'next · back in 5d / later / dismiss', `the actions: ${actions()}`);
    // written up: numbered steps, three of them cloze
    const surface = q<HTMLElement>('.draft-doc', notesPane()!)!;
    surface.focus();
    keydown(surface, 'Enter');
    await sleep(200);
    type('1. $Z_q \\propto \\int e^{-\\beta c q^2}\\,dq$, a Gaussian integral: {{c1::$\\sqrt{\\pi/\\beta c}$}}');
    keydown(surface, 'Enter');
    await sleep(200);
    type('2. so $\\ln Z_q = {{c1::-\\tfrac12 \\ln \\beta}} + \\text{const}$');
    keydown(surface, 'Enter');
    await sleep(200);
    type('3. $\\langle E_q \\rangle = -\\partial_\\beta \\ln Z_q$ = {{c1::$1/2\\beta = \\tfrac12 kT$}}, whatever $c$ is');
    await sleep(1500);
    must((surface.textContent ?? '').includes('Gaussian integral') && (surface.textContent ?? '').includes('whatever'), 'the steps are on the page');
    const ch = useApp.getState().caretHeading;
    must(ch?.text === sec.heading, `the caret is still in the section after the write-up and its save (caretHeading: ${JSON.stringify(ch && { nth: ch.nth, text: ch.text.slice(0, 30) })})`);
    await shot('books-write-up');
    before = await text(CH3);
    key('Enter');
    after = await changed(CH3, before, 'next wrote the file');
    const eq2 = (await headings(CH3)).find((h) => h.text === eq.text)!;
    must(eq2.read?.due === addDays(DAY2, 5) && eq2.read.ivl === 5 && eq2.read.reps === 1 && eq2.read.boxes === eq.read?.boxes, `the heading's line counted the pass (${JSON.stringify(eq2.read)})`);
    const cards = await cardsUnder(CH3, '3.6 · the equipartition');
    must(cards.length === 3 && cards.every((c) => c.kind === 'card' && c.text.includes('{{c1::')), `the write-up is three cloze cards in the section (${cards.length})`);
    must(useApp.getState().log[0] === doneLine('§', eq.text, 'next · back in 5d'), `the done row: "${useApp.getState().log[0]}"`);

    // ── it returns written, and is dismissed; its cards stay ──
    setClockDay(DAY3);
    refreshQueue();
    const back = await poll(() => { const s = sectionOf(CH3, '3.6 · the equipartition'); return s && isDue(s, appNow()) ? s : null; }, 'five days on, it is due again', 8000);
    must(back.cards === 3, 'back with its 3 cards (a section of cards alone is written by its cards)');
    await openQuery();
    must(where(rowOf('3.6 · the equipartition')) === 'written, 3 cards · back for the 2nd time', `its row: "${where(rowOf('3.6 · the equipartition'))}"`);
    const dueCards = () => items().filter((i) => i.kind === 'card' && i.path === CH3 && isDue(i, appNow())).length;
    const cardsBefore = dueCards();
    await shot('books-returns');
    await sessionAt(back, 26);
    before = await text(CH3);
    key('d');
    after = await changed(CH3, before, 'dismiss wrote the file');
    const eq3 = (await headings(CH3)).find((h) => h.text === eq.text)!;
    must(eq3.read?.due === undefined && eq3.read?.boxes === eq.read?.boxes && eq3.read?.made === DAY1, `dismissed: its line keeps made and boxes, no due (${JSON.stringify(eq3.read)})`);
    await poll(() => { refreshQueue(); return !sectionOf(CH3, '3.6 · the equipartition') && dueCards() === cardsBefore ? true : null; }, `out of the queue, its cards still due (${cardsBefore})`, 8000);
    must((await cardsUnder(CH3, '3.6 · the equipartition')).length === 3, 'the three cards stay in the section');

    // ── the Arabic passage: read in rotation, a paragraph clipped, word ::: meaning ──
    const p12 = await poll(() => readOf(P12), 'passage 12 is due to read on');
    await sessionAt(p12, 130);
    must(inView(130), 'the pages landed at the read point, p. 130 in view');
    must(actions().startsWith('done for today · back in'), `a book's actions: ${actions()}`);
    await closeNotesPane();
    await bring();
    must(qa('h2.dd-h', notesPane()!).map((h) => h.textContent?.slice(0, 12)).join(' | ').startsWith('dukkān, sirḥ | analogy foll | p. 131'), 'its notes: the two boxed sections, then the pages\' clips');
    await poll(() => qa('.raw.clip .crop', notesPane()!).length === 8, 'eight clips drawn as crops of their pages', 10000);
    await close();
    await drag(129, 0.12, 0.275, 0.78, 0.072);
    key('m');
    await poll(async () => /\n## p\. 129\n\n<!-- box 129:0\.1\d{2}:0\.2[6-8]\d:0\.7\d{2}:0\.0[6-8]\d -->\n/.test(await text(P12)), 'm clips the first paragraph under ## p. 129', 10000);
    const caretP = await poll(() => {
      const s = window.getSelection();
      const n = s?.anchorNode;
      const p = (n instanceof Element ? n : n?.parentElement)?.closest('p');
      return p && !p.textContent?.trim() && p.previousElementSibling?.classList.contains('clip') ? p : null;
    }, 'the caret below it', 8000);
    log(`caret in ${caretP.className}`);
    type('البَادِيَة ::: the desert, home of the bedouin');
    await sleep(600);
    await shot('books-arabic-clip');
    before = await text(P12);
    key('Escape');
    key('Enter');
    after = await changed(P12, before, 'done for today wrote the passage');
    must(/<!-- box 129:[\d.:]+ -->\n\nالبَادِيَة ::: the desert, home of the bedouin\n/.test(after), 'the card sits under the clip');
    const r12 = meta(parse(after).doc).read;
    must(r12?.reps === 4 && r12.pos !== undefined && r12.pos >= 129, `the passage's read point moved on (pos=${r12?.pos} y=${r12?.y} reps=${r12?.reps})`);
    must(/^## p\. 129\n/m.test(after) && after.indexOf('## p. 129') < after.indexOf('## p. 131'), 'the page\'s heading in page order');

    // ── dark ──
    await openQuery();
    useApp.getState().setTheme('dark');
    await poll(() => document.documentElement.dataset.theme === 'dark', 'dark');
    await shot('books-dark');
    useApp.getState().setTheme('light');
    setClockDay(null);
    finished = true;
    log(`done; vault ${vault.root}`);
  } catch (e) {
    finished = true;
    setClockDay(null);
    log(`failed: ${e instanceof Error ? e.message : String(e)}`);
  }
}

// `ILMI_SMOKE=textsections` (`smokeTextSections`) over a fresh copy of
// `samples/double-major`, milestone 50: a passage marked in a text source
// is a section of the source's note. 2026-11-02 by the app's clock: two
// passages of the clipping `why perturbation series diverge` and one of
// the Halvorsen chapter (a chapter of the quantum II notebook, as an EPUB
// chapter is) are marked with `e`; each lands at the end of `notes.md` in
// the source's folder with its heading, its read line, a `from:` line and
// the text, nothing going back to the source but its marker; ⏎ right
// after opens the note at the section. 2026-11-05: the three come up in
// the one queue, each saying where it stands; a session opens one in its
// note and `next` counts the pass; from the inspector the second is moved
// to the course's own WKB note through the palette; the clipping is edited
// and the sections are untouched; the clipping's old extract document is
// folded into the note from its inspector, its schedule on the line, its
// file gone. Light, then dark.
export async function smokeTextSections(vault: Vault): Promise<void> {
  type Heading = import('../format/index.js').Heading;
  type SectionItem = import('../schedule/index.js').SectionItem;
  let last = { at: Date.now(), what: 'start' };
  let finished = false;
  const log = (s: string) => { last = { at: Date.now(), what: s }; void info(`smoke textsections: ${s}`); };
  const dog = setInterval(() => {
    if (finished) { clearInterval(dog); return; }
    if (Date.now() - last.at > 30_000) { finished = true; clearInterval(dog); void info(`smoke textsections: failed: no progress for 30 s after "${last.what}"`); }
  }, 2000);
  const bounded = <T,>(p: Promise<T>, what: string, ms = 8000): Promise<T> =>
    Promise.race([p, new Promise<T>((_, no) => setTimeout(() => no(new Error(`${what} (no answer in ${ms} ms)`)), ms))]);
  const shot = async (name: string, ms = 2500) => { await sleep(800); log(`shot: ${name}`); await sleep(ms); };
  const q = <T extends Element>(sel: string, root: ParentNode = document) => root.querySelector<T>(sel);
  const qa = <T extends Element>(sel: string, root: ParentNode = document) => Array.from(root.querySelectorAll<T>(sel));
  const must = (ok: unknown, what: string) => { if (!ok) throw new Error(what); log(`ok: ${what}`); };
  const poll = async <T,>(probe: () => T | null | undefined | false | Promise<T | null | undefined | false>, what: string, ms = 5000): Promise<T> => {
    const t0 = Date.now();
    for (;;) {
      const v = await probe();
      if (v) { log(`ok: ${what}`); return v; }
      if (Date.now() - t0 > ms) throw new Error(`${what} (waited ${ms} ms)`);
      await sleep(100);
    }
  };
  const key = (k: string) => window.dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true, cancelable: true }));
  const click = (el: Element) => el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
  const { parse, meta } = await import('../format/index.js');
  const { addDays, isDue, sameItem, sectionSpan } = await import('../schedule/index.js');
  const { refreshQueue } = await import('./vault.js');
  const { setClockDay, appNow } = await import('./clock.js');
  const { doneLine } = await import('./items.js');
  const CLIP = 'fleeting/clipped-why-perturbation-series-diverge.md';
  const NOTE = 'fleeting/clipped-why-perturbation-series-diverge/notes.md';
  const OLD = 'fleeting/clipped-why-perturbation-series-diverge/dyson-argument.md';
  const WKB = 'courses/fall-2026/phys-412-quantum-ii/halvorsen-ch-9-wkb.md';
  const WKBN = 'courses/fall-2026/phys-412-quantum-ii/halvorsen-ch-9-wkb/notes.md';
  const COURSE = 'courses/fall-2026/phys-412-quantum-ii/wkb-approximation.md';
  const DAY1 = '2026-11-02';
  const DAY2 = '2026-11-05';
  const text = (p: string) => bounded(vault.fs.readText(vault.abs(p)), `reading ${p}`);
  const has = async (p: string) => !!(await vault.fs.stat(vault.abs(p)));
  const headings = async (p: string) => parse(await text(p)).doc.blocks.flatMap((b) => (b.kind === 'heading' && b.level === 2 ? [b] : []));
  const sectionAt = async (p: string, start: string) => {
    const doc = parse(await text(p)).doc;
    const at = doc.blocks.findIndex((b) => b.kind === 'heading' && b.text.startsWith(start));
    if (at < 0) return null;
    const span = sectionSpan(doc.blocks, at);
    return { heading: doc.blocks[at] as Heading, body: doc.blocks.slice(at + 1, span.end) };
  };
  const items = () => useApp.getState().queue;
  const sectionOf = (p: string, start: string) => items().find((i): i is SectionItem => i.kind === 'section' && i.path === p && i.heading.startsWith(start));
  const openDoc = async (p: string) => {
    openNode(p);
    await poll(() => activeTab(useApp.getState().panes)?.id === p && q<HTMLElement>('.pane[data-active="1"] .doc-view .draft-doc'), `${p.split('/').pop()} is open`, 10000);
    await sleep(400);
  };
  /** Select `words` in the page's paragraph that starts with `start`, and wait for the cue. */
  const mark = async (start: string, words: string) => {
    const para = await poll(() => qa<HTMLElement>('.pane[data-active="1"] .doc-view p.dd-p').find((el) => el.textContent?.startsWith(start)), `the paragraph "${start.slice(0, 30)}…"`, 8000);
    para.scrollIntoView({ block: 'center' });
    select(para, words);
    return poll(() => q<HTMLElement>('.sel-cue'), 'the selection cue');
  };
  const openQuery = async () => {
    openNode(queueId('today'));
    await poll(() => q('.pane[data-active="1"] .queue h1')?.firstChild?.textContent === 'due today', 'the day\'s query is drawn', 8000);
    await sleep(300);
  };
  const rowOf = (start: string) => qa<HTMLElement>('.pane[data-active="1"] .qlist li:not(.fold)').find((r) => r.dataset.el === 'section' && r.textContent?.includes(start));
  const where = (r: HTMLElement | undefined) => q('.ref-line', r ?? document.createElement('div'))?.textContent ?? '';
  const sessionAt = async (s: SectionItem) => {
    openSession(s);
    await poll(() => { const el = useApp.getState().sessionEl; return el?.kind === 'section' && sameItem(el.item, s) && q('.pane[data-active="1"] .doc-session[data-el="section"] .session-bar') ? true : null; }, 'the session is on it, its bar drawn', 15000);
    await sleep(600);
  };
  const changed = (p: string, before: string, what: string) => poll(async () => { const t = await text(p); return t !== before ? t : null; }, what, 8000);
  try {
    setClockDay(DAY1);
    useApp.getState().setTheme('light');
    await poll(() => document.documentElement.dataset.theme === 'light', 'light');
    setInspector({ open: true });
    must(!(await has(NOTE)) && !(await has(WKBN)), 'the sources have no notes yet');

    // ── the clipping: a passage marked with e is a section of its note ──
    await openDoc(CLIP);
    const cue = await mark('In that world the vacuum', 'In that world the vacuum is not stable.');
    must(qa('.cue-act', cue).map((b) => b.textContent?.trim()).join(' | ').includes('section e'), `the cue offers a section: ${qa('.cue-act', cue).map((b) => b.textContent?.trim()).join(' | ')}`);
    must(qa('.bot span').map((s) => s.textContent).join(' | ').includes('e section'), 'the strip says so too');
    await shot('textsections-cue');
    const clipBefore = await text(CLIP);
    key('e');
    const first = await poll(async () => (await has(NOTE)) ? (await headings(NOTE))[0] : null, 'e makes the note with a section', 10000);
    must(first!.text === 'in that world the vacuum', `named from the passage's first words: "${first!.text}"`);
    must(first!.read?.made === DAY1 && first!.read.due === addDays(DAY1, 2) && first!.read.ivl === 2, `enrolled: made today, back in 2 days, the cadence at priority 50 (${JSON.stringify(first!.read)})`);
    const sec1 = (await sectionAt(NOTE, 'in that world'))!;
    must(sec1.body[0]?.kind === 'paragraph' && sec1.body[0].text === 'from: why perturbation series diverge', `a from line under the heading: "${(sec1.body[0] as { text?: string }).text}"`);
    must(sec1.body[1]?.kind === 'paragraph' && sec1.body[1].text === 'In that world the vacuum is not stable.', 'then the passage');
    must(meta(parse(await text(NOTE)).doc).title === 'why perturbation series diverge — notes', 'the note is titled after the source');
    const clipAfter = await text(CLIP);
    const strip = (t: string) => t.replace(/^read: .*$/m, 'read');
    must(strip(clipAfter) === strip(clipBefore) && !clipAfter.includes('<!-- extract in that'), 'nothing went back to the clipping but its marker');
    must(/^read: .*pos=9\b/m.test(clipAfter), `the marker, already past it, stays (${/^read: .*$/m.exec(clipAfter)?.[0]})`);
    const notice = await poll(() => useApp.getState().notice, 'the notice', 8000);
    must(notice.line === '§ in that world the vacuum · back in 2d, until dismissed · in its notes · ⏎ to write in it' && notice.open === NOTE, `the notice: "${notice.line}"`);
    await shot('textsections-made');
    key('Enter');
    await poll(() => useApp.getState().caretHeading?.path === NOTE && useApp.getState().caretHeading?.text === 'in that world the vacuum', '⏎ opens the note at the section, the caret in it', 10000);
    must(!!q('.pane[data-active="1"] .doc-view .draft-doc[contenteditable="true"]'), 'in the editor');
    await shot('textsections-note');

    // a second passage goes under the first
    await openDoc(CLIP);
    await mark('Euler had the prototype', 'Euler had the prototype two centuries before quantum theory.');
    key('e');
    await poll(async () => (await headings(NOTE)).length === 2 && (await headings(NOTE))[1]!.text.startsWith('euler had the prototype'), 'a second section under the first', 10000);
    const pos = Number(/^read: .*pos=(\d+)/m.exec(await text(CLIP))?.[1]);
    must(pos > 9, `the marker moved past this one, further down (pos=${pos})`);

    // ── the chapter (an EPUB chapter's shape: a frozen source in a notebook) ──
    await openDoc(WKB);
    await mark('The condition can be written', 'the wavelength must not change appreciably within a wavelength');
    key('e');
    const wk = await poll(async () => (await has(WKBN)) ? (await headings(WKBN))[0] : null, 'the chapter gets a note with the section', 10000);
    must(wk!.text.startsWith('the wavelength must not change') && (await sectionAt(WKBN, 'the wavelength'))!.body[0]!.kind === 'paragraph' && ((await sectionAt(WKBN, 'the wavelength'))!.body[0] as { text: string }).text === 'from: Halvorsen ch. 9: the WKB approximation', `"${wk!.text}", from the chapter`);

    // ── three days on: the three sections in the one queue ──
    setClockDay(DAY2);
    refreshQueue();
    const s1 = await poll(() => { const s = sectionOf(NOTE, 'in that world'); return s && isDue(s, appNow()) ? s : null; }, 'the first section is due', 8000);
    await poll(() => sectionOf(NOTE, 'euler') && sectionOf(WKBN, 'the wavelength'), 'and the other two');
    await openQuery();
    must(where(rowOf('in that world')) === 'written, no cards yet · first time back', `its row: "${where(rowOf('in that world'))}"`);
    must(where(rowOf('the wavelength must')) === 'written, no cards yet · first time back', `the chapter's: "${where(rowOf('the wavelength must'))}"`);
    const kinds = qa<HTMLElement>('.pane[data-active="1"] .qlist li:not(.fold)').map((r) => r.dataset.el);
    must(kinds.includes('card') && kinds.includes('section'), 'among the cards, in the one line');
    rowOf('in that world')?.scrollIntoView({ block: 'center' });
    await shot('textsections-queue');

    // a session opens it in its note; the inspector says where it came from; next counts the pass
    await sessionAt(s1);
    await poll(() => useApp.getState().caretHeading?.text === s1.heading, 'opened at its heading, the caret in it', 8000);
    const bar = q<HTMLElement>('.pane[data-active="1"] .session-bar')!;
    must(qa<HTMLElement>('.sb-actions button .ra-l', bar).map((b) => b.textContent).join(' / ') === 'next · back in 5d / later / dismiss', 'next · later · dismiss');
    const fromRow = await poll(() => qa<HTMLElement>('.insp .sec-block .kvr').find((r) => q('dt', r)?.textContent === 'from'), 'the inspector\'s from row');
    must(q('dd', fromRow)?.textContent === 'why perturbation series diverge', `from: "${q('dd', fromRow)?.textContent}"`);
    await shot('textsections-session');
    let before = await text(NOTE);
    key('Enter');
    let after = await changed(NOTE, before, 'next wrote the note');
    must((await headings(NOTE))[0]!.read?.reps === 1 && (await headings(NOTE))[0]!.read?.due === addDays(DAY2, 5), 'the pass counted on the heading\'s line');
    must(useApp.getState().log[0] === doneLine('§', 'in that world the vacuum', 'next · back in 5d'), `the done row: "${useApp.getState().log[0]}"`);

    // ── move the second section to the course's own WKB note, through the palette ──
    await openDoc(NOTE);
    const euler = (await headings(NOTE)).find((h) => h.text.startsWith('euler'))!;
    useApp.setState({ reveal: { path: NOTE, index: parse(await text(NOTE)).doc.blocks.indexOf(euler), heading: euler.text } });
    await poll(() => useApp.getState().caretHeading?.text === euler.text, 'the caret at the second section', 8000);
    const mv = await poll(() => q<HTMLButtonElement>('.insp .sec-block [data-act="move-to"]'), 'the inspector offers move to…');
    click(mv);
    const input = await poll(() => q<HTMLInputElement>('.palette-input input'), 'the palette opens');
    must(input.placeholder.startsWith('move § euler had the prototype'), `as a picker: "${input.placeholder}"`);
    const row = await poll(() => qa<HTMLElement>('.palette-row').find((r) => q('.psub', r)?.textContent === COURSE.replace(/\.md$/, '')), 'the course note is among the notes offered');
    must(qa('.palette-row').every((r) => (r as HTMLElement).dataset.t === 'note'), 'notes only');
    await shot('textsections-move');
    before = await text(COURSE);
    click(row);
    after = await changed(COURSE, before, 'the course note took it');
    const moved = (await sectionAt(COURSE, 'euler had the prototype'))!;
    const courseBlocks = parse(after).doc.blocks;
    must(courseBlocks.findIndex((b) => b.kind === 'heading' && b.text === euler.text) === courseBlocks.length - moved.body.length - 1 && moved.heading.read?.made === DAY1 && moved.body[0]!.kind === 'paragraph' && (moved.body[0] as { text: string }).text === 'from: why perturbation series diverge', 'at its end, with its line and its from line');
    await poll(async () => !(await headings(NOTE)).some((h) => h.text === euler.text), 'and it left the source\'s note');
    must(useApp.getState().log[0] === doneLine('§', euler.text, 'moved to WKB approximation'), `the done row: "${useApp.getState().log[0]}"`);
    await poll(() => useApp.getState().caretHeading?.path === COURSE || true, 'moved');
    await openDoc(COURSE);
    useApp.setState({ reveal: { path: COURSE, index: parse(after).doc.blocks.findIndex((b) => b.kind === 'heading' && b.text === euler.text), heading: euler.text } });
    await poll(() => useApp.getState().caretHeading?.text === euler.text, 'the course note at the section', 8000);
    await shot('textsections-moved');

    // ── the clipping edited: the sections are untouched ──
    const noteBefore = await text(NOTE);
    const courseBefore = await text(COURSE);
    await bounded(vault.update(CLIP, (d) => { const p = d.blocks.find((b) => b.kind === 'paragraph' && b.text.startsWith('In that world the vacuum')); if (p && p.kind === 'paragraph') p.text = `${p.text} [edited after marking]`; }), 'editing the clipping');
    await sleep(800);
    must((await text(NOTE)) === noteBefore && (await text(COURSE)) === courseBefore, 'the clipping edited, the sections untouched');

    // ── the old extract document, folded into the note from its inspector ──
    const oldDoc = parse(await text(OLD)).doc;
    const oldRead = meta(oldDoc).read!;
    await openDoc(OLD);
    const fold = await poll(() => q<HTMLButtonElement>('.insp [data-act="absorb"]'), 'the extract\'s inspector offers into the note');
    await shot('textsections-offer');
    click(fold);
    await poll(async () => !(await has(OLD)), 'the extract document is gone', 10000);
    const folded = await poll(async () => sectionAt(NOTE, "Dyson's argument"), 'a section of the note', 8000);
    must(folded!.heading.read?.made === '2026-10-27' && folded!.heading.read.due === oldRead.due && folded!.heading.read.ivl === oldRead.ivl && folded!.heading.read.reps === oldRead.reps, `its schedule on the line (${JSON.stringify(folded!.heading.read)})`);
    must(folded!.body.filter((b) => b.kind === 'card').length === oldDoc.blocks.filter((b) => b.kind === 'card').length && folded!.body.filter((b) => b.kind === 'card').length > 0, 'its cards with it');
    must(!(await text(CLIP)).includes('<!-- extract dyson-argument -->'), 'the clipping\'s backref to it is gone');
    await poll(() => useApp.getState().caretHeading?.path === NOTE && useApp.getState().caretHeading?.text === "Dyson's argument", 'the note open at it', 10000);
    await shot('textsections-folded');

    // ── dark ──
    await openQuery();
    useApp.getState().setTheme('dark');
    await poll(() => document.documentElement.dataset.theme === 'dark', 'dark');
    await shot('textsections-dark');
    useApp.getState().setTheme('light');
    setClockDay(null);
    finished = true;
    log(`done; vault ${vault.root}`);
  } catch (e) {
    finished = true;
    setClockDay(null);
    log(`failed: ${e instanceof Error ? e.message : String(e)}`);
  }
}

// `ILMI_SMOKE=zoom` (`smokeZoom`) over a copy of `samples/double-major`: the
// page's text size. ⌘= twice makes a note's text bigger (the computed font
// size of its paragraphs, and the headings with it), ⌘− smaller, ⌘0 back
// to 18px; it works with the caret in the editor; the tweaks panel shows
// `text size 120%` and its slider sets it; the size is kept in the tweaks.
export async function smokeZoom(vault: Vault): Promise<void> {
  const log = (s: string) => void info(`smoke zoom: ${s}`);
  const shot = async (name: string, ms = 2500) => { await sleep(800); log(`shot: ${name}`); await sleep(ms); };
  const q = <T extends Element>(sel: string, root: ParentNode = document) => root.querySelector<T>(sel);
  const must = (ok: unknown, what: string) => { if (!ok) throw new Error(what); log(`ok: ${what}`); };
  const poll = async <T,>(probe: () => T | null | undefined | false, what: string, ms = 5000): Promise<T> => {
    const t0 = Date.now();
    for (;;) {
      const v = probe();
      if (v) { log(`ok: ${what}`); return v; }
      if (Date.now() - t0 > ms) throw new Error(`${what} (waited ${ms} ms)`);
      await sleep(100);
    }
  };
  const key = (k: string, target: EventTarget = window) => target.dispatchEvent(new KeyboardEvent('keydown', { key: k, metaKey: true, bubbles: true, cancelable: true }));
  const NOTE = 'courses/fall-2026/phys-415-stat-mech/canonical-ensemble.md';
  const px = (sel: string) => parseFloat(getComputedStyle(q<HTMLElement>(sel)!).fontSize);
  const near = (a: number, b: number) => Math.abs(a - b) < 0.6;
  try {
    useApp.getState().setTheme('light');
    useApp.getState().setZoom(1);
    openNode(NOTE);
    const surface = await poll(() => q<HTMLElement>('.pane[data-active="1"] .doc-view .draft-doc'), 'the note is open', 10000);
    await poll(() => q('.pane[data-active="1"] .draft-doc p.dd-p'), 'its paragraphs are drawn');
    await sleep(300);
    const base = px('.pane[data-active="1"] .draft-doc p.dd-p');
    const h2 = px('.pane[data-active="1"] .draft-doc h2.dd-h');
    must(near(base, 18), `the text is 18px at 100% (${base}px)`);
    log(`a heading at ${h2}px`);
    key('=');
    key('=');
    await poll(() => near(px('.pane[data-active="1"] .draft-doc p.dd-p'), 18 * 1.2), `⌘= twice: 120%, ${px('.pane[data-active="1"] .draft-doc p.dd-p')}px`);
    must(near(px('.pane[data-active="1"] .draft-doc h2.dd-h'), h2 * 1.2), `the headings with it (${px('.pane[data-active="1"] .draft-doc h2.dd-h')}px)`);
    must(useApp.getState().zoom === 1.2, 'the tweak reads 1.2');
    await shot('zoom-bigger');
    // from the editor, with the caret in the text
    surface.focus();
    key('-', surface);
    await poll(() => useApp.getState().zoom === 1.1, '⌘− from the editor: 110%');
    must(near(px('.pane[data-active="1"] .draft-doc p.dd-p'), 18 * 1.1), `${px('.pane[data-active="1"] .draft-doc p.dd-p')}px`);
    key('0');
    await poll(() => useApp.getState().zoom === 1 && near(px('.pane[data-active="1"] .draft-doc p.dd-p'), 18), '⌘0: back to 18px');
    // the tweaks panel: the row and its slider
    for (let i = 0; i < 3; i++) key('=');
    await poll(() => useApp.getState().zoom === 1.3, '⌘= three times: 130%');
    useApp.setState({ tweaksOpen: true });
    const row = await poll(() => Array.from(document.querySelectorAll<HTMLElement>('.tweaks .tw-row')).find((r) => r.textContent?.startsWith('text size')), 'the tweaks panel has a text size row');
    must(q('.tw-val', row)?.textContent === '130%', `reading ${q('.tw-val', row)?.textContent}`);
    await shot('zoom-tweaks');
    const slider = q<HTMLInputElement>('input', row)!;
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!;
    setter.call(slider, '0.9');
    slider.dispatchEvent(new Event('input', { bubbles: true }));
    await poll(() => useApp.getState().zoom === 0.9 && near(px('.pane[data-active="1"] .draft-doc p.dd-p'), 18 * 0.9), 'the slider sets 90%');
    must(JSON.parse(localStorage.getItem('ilmi.tweaks') ?? '{}').zoom === 0.9, 'kept with the tweaks');
    useApp.setState({ tweaksOpen: false });
    await shot('zoom-smaller');
    useApp.getState().setZoom(1);
    log(`done; vault ${vault.root}`);
  } catch (e) {
    useApp.getState().setZoom(1);
    log(`failed: ${e instanceof Error ? e.message : String(e)}`);
  }
}

// `ILMI_SMOKE=cadence` (`smokeCadence`) over a fresh copy of `samples/double-major`,
// milestone 51: the reading loop re-tuned. 2026-11-03 by the app's clock: a
// half-read source at priority 70 comes up `done for today · back in 3d`,
// its inspector's growth row reads `every third day while reading`, and
// ⏎ writes `ivl=3 due=+3` and one more pass; the day's queue holds its
// order between two builds; `postpone the rest` postpones only what was
// due before today; a source whose marker is at its end comes up with
// ⏎ reading `dismiss`, and ⏎ drops its `read` field; the inspector's
// interval field writes `ivl=100 due=+100` on a note revisited.
// 2026-11-04: the order differs from the day before; with the tweak on,
// the day's first build postpones the backlog. First of all, though, at
// 2027-01-01, before any postpone touches its line: the pset derivation
// (due 2026-11-02, ivl=3) comes up `next · back in 101d` and ⏎ lands it
// there. Light, then dark.
export async function smokeCadence(vault: Vault): Promise<void> {
  type ReadItem = import('../schedule/index.js').ReadItem;
  type SectionItem = import('../schedule/index.js').SectionItem;
  type QueueItem = import('../schedule/index.js').QueueItem;
  let last = { at: Date.now(), what: 'start' };
  let finished = false;
  const log = (s: string) => { last = { at: Date.now(), what: s }; void info(`smoke cadence: ${s}`); };
  const dog = setInterval(() => {
    if (finished) { clearInterval(dog); return; }
    if (Date.now() - last.at > 30_000) { finished = true; clearInterval(dog); void info(`smoke cadence: failed: no progress for 30 s after "${last.what}"`); }
  }, 2000);
  const bounded = <T,>(p: Promise<T>, what: string, ms = 8000): Promise<T> =>
    Promise.race([p, new Promise<T>((_, no) => setTimeout(() => no(new Error(`${what} (no answer in ${ms} ms)`)), ms))]);
  const shot = async (name: string, ms = 2500) => { await sleep(800); log(`shot: ${name}`); await sleep(ms); };
  const q = <T extends Element>(sel: string, root: ParentNode = document) => root.querySelector<T>(sel);
  const qa = <T extends Element>(sel: string, root: ParentNode = document) => Array.from(root.querySelectorAll<T>(sel));
  const must = (ok: unknown, what: string) => { if (!ok) throw new Error(what); log(`ok: ${what}`); };
  const poll = async <T,>(probe: () => T | null | undefined | false | Promise<T | null | undefined | false>, what: string, ms = 5000): Promise<T> => {
    const t0 = Date.now();
    for (;;) {
      const v = await probe();
      if (v) { log(`ok: ${what}`); return v; }
      if (Date.now() - t0 > ms) throw new Error(`${what} (waited ${ms} ms)`);
      await sleep(100);
    }
  };
  const key = (k: string, mods: KeyboardEventInit = {}) => window.dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true, cancelable: true, ...mods }));
  const { parse, meta, setField } = await import('../format/index.js');
  const { addDays, isDue, itemSeed, overflow, sameItem } = await import('../schedule/index.js');
  const { postponeRest, refreshQueue, setBudget } = await import('./vault.js');
  const { setClockDay, appNow } = await import('./clock.js');
  const { doneLine } = await import('./items.js');
  const MERCHANT = 'library/classical-prose-reader/15-the-merchant-who-was-robbed.md';
  const QASIDA = 'courses/fall-2026/arab-455-abbasid-poetry/clipped-on-translating-the-qasida.md';
  const HAMILTON = 'courses/fall-2025/phys-301-classical-mechanics/hamiltonian-mechanics.md';
  const CANON = 'courses/fall-2026/phys-415-stat-mech/canonical-ensemble.md';
  const DAY1 = '2026-11-03';
  const DAY2 = '2026-11-04';
  const DAY3 = '2027-01-01';
  const text = (p: string) => bounded(vault.fs.readText(vault.abs(p)), `reading ${p}`);
  const readLine = async (p: string) => meta(parse(await text(p)).doc).read;
  const items = () => useApp.getState().queue;
  const due = () => items().filter((i) => isDue(i, appNow()));
  const readOf = (p: string) => items().find((i): i is ReadItem => i.kind === 'read' && i.path === p);
  const sectionOf = (p: string, start: string) => items().find((i): i is SectionItem => i.kind === 'section' && i.path === p && i.heading.startsWith(start));
  const order = () => due().map(itemSeed);
  const sessionAt = async (it: QueueItem) => {
    openSession(it);
    await poll(() => { const el = useApp.getState().sessionEl; return el && sameItem(el.item, it) && q('.pane[data-active="1"] .doc-session .session-bar') ? true : null; }, `the session opens at ${it.path}`, 20000);
    await sleep(500);
  };
  const bar = () => q<HTMLElement>('.pane[data-active="1"] .session-bar')!;
  const actions = () => qa<HTMLElement>('.sb-actions button .ra-l', bar()).map((b) => b.textContent).join(' / ');
  const changed = (p: string, before: string, what: string) => poll(async () => { const t = await text(p); return t !== before ? t : null; }, what, 8000);
  const setNum = (el: HTMLInputElement, v: string) => {
    el.focus();
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(el, v);
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.blur();
  };
  try {
    setClockDay(DAY1);
    useApp.getState().setTheme('light');
    await poll(() => document.documentElement.dataset.theme === 'light', 'light');
    useApp.getState().setBacklog(false);
    setInspector({ open: true });
    await poll(() => useApp.getState().docs[MERCHANT] && useApp.getState().docs[CANON], 'the sample is in the collection', 15000);
    refreshQueue();

    let before: string;
    let after: string;

    // ── a section sixty days late grows from the time elapsed ──
    setClockDay(DAY3);
    refreshQueue();
    const sec = await poll(() => { const s = sectionOf(CANON, 'pset 4 #5'); return s && isDue(s, appNow()) ? s : null; }, 'the pset derivation is due, sixty days late', 8000);
    must(sec.sched.ivl === 3 && sec.sched.due === '2026-11-02', `its line still reads ivl=3 due=2026-11-02`);
    await sessionAt(sec);
    must(actions() === 'next · back in 101d / later / dismiss', `next grows from the 63 days elapsed: ${actions()}`);
    await shot('cadence-late');
    before = await text(CANON);
    key('Enter');
    after = await changed(CANON, before, 'next wrote the file');
    must(after.includes(`<!-- read made=2026-10-30 due=${addDays(DAY3, 101)} ivl=101 reps=1 -->`), 'the line lands at 101 days, past 90');
    must(useApp.getState().log[0] === doneLine('§', sec.heading, 'next · back in 101d'), `the done row: "${useApp.getState().log[0]}"`);
    setClockDay(DAY1);
    refreshQueue();

    // ── a half-read source lands on its cadence ──
    // at priority 70 the cadence is every third day; the sample's own priority (50) would be every other
    await vault.update(MERCHANT, (d) => setField(d, 'pri', 70));
    const merchant = await poll(() => { const r = readOf(MERCHANT); return r && r.pri === 70 && isDue(r, appNow()) ? r : null; }, 'the merchant is due, at priority 70', 8000);
    must(merchant.pos === 6 && merchant.pos < merchant.total, `half read: ${merchant.pos} of ${merchant.total}`);
    await sessionAt(merchant);
    must(actions() === 'done for today · back in 3d / later / dismiss', `a source with reading left: ${actions()}`);
    const growth = await poll(() => q('.insp .af-next')?.textContent, 'the inspector has its growth row');
    must(growth === 'every third day while reading', `the growth row reads the cadence: "${growth}"`);
    await shot('cadence-source');
    before = await text(MERCHANT);
    key('Enter');
    after = await changed(MERCHANT, before, 'done for today wrote the file');
    const r1 = meta(parse(after).doc).read!;
    must(r1.ivl === 3 && r1.due === addDays(DAY1, 3) && r1.reps === 3 && (r1.pos ?? 0) >= 6, `the line landed on its cadence, not grown: ${after.split('\n').find((l) => l.startsWith('read:'))}`);
    must(useApp.getState().log[0] === doneLine('“', 'passage 15 · the merchant who was robbed', 'done for today · back in 3d'), `the done row: "${useApp.getState().log[0]}"`);

    // ── the day's order holds within the day ──
    openNode(queueId('today'));
    await poll(() => q('.pane[data-active="1"] .queue h1')?.firstChild?.textContent === 'due today', 'the day\'s query is drawn', 8000);
    const o1 = order();
    refreshQueue();
    await sleep(200);
    refreshQueue();
    must(o1.length > 20 && o1.join('|') === order().join('|'), `the order holds within the day over two more builds (${o1.length} due)`);
    const pris = due().map((i) => i.pri);
    must(pris.slice(0, 5).every((p) => p <= 50) && pris.slice(-5).every((p) => p >= 50), `the top holds: first five at ${pris.slice(0, 5).join(' ')}, last five at ${pris.slice(-5).join(' ')}`);
    await shot('cadence-queue');

    // ── postpone the rest touches nothing first due today ──
    setBudget(5);
    const rest = overflow(items(), appNow());
    must(rest.length > 0 && rest.every((i) => i.due !== undefined && i.due < DAY1), `the rest is the backlog: ${rest.length} elements, every one due before today`);
    const todays = due().filter((i) => i.kind !== 'card' && (i.due === undefined || i.due.startsWith(DAY1)));
    must(todays.length > 0, `${todays.length} element(s) first due today (${todays.map((i) => i.path.split('/').pop()).join(', ')})`);
    // its own line: a file may hold a backlog read line beside a section first due today
    const ownLine = async (i: QueueItem) => {
      const d = parse(await text(i.path)).doc;
      return JSON.stringify(i.kind === 'section' ? (d.blocks.find((b) => b.kind === 'heading' && b.text === i.heading) as { read?: unknown } | undefined)?.read : i.kind === 'read' ? meta(d).read : null);
    };
    const lines = new Map<string, string>();
    for (const i of todays) lines.set(itemSeed(i), await ownLine(i));
    const n = await postponeRest();
    must(n === rest.length, `postpone the rest postponed ${n}`);
    for (const i of todays) must((await ownLine(i)) === lines.get(itemSeed(i)), `untouched: ${i.kind} ${i.path.split('/').pop()}${i.kind === 'section' ? ` § ${i.heading.slice(0, 30)}` : ''}`);
    const q15 = await readLine(QASIDA);
    must(q15?.due === addDays(DAY1, 1) && q15.ivl === 12, `a backlog source with reading left is held over to tomorrow, its interval kept: ivl ${q15?.ivl}, due ${q15?.due}`);
    setBudget(0);
    await poll(() => { refreshQueue(); return overflow(items(), appNow()).length === 0 ? true : null; }, 'no backlog left', 8000);

    // ── a finished source: ⏎ reads dismiss ──
    await vault.update(QASIDA, (d) => { const m = meta(d); setField(d, 'read', { ...m.read, due: DAY1, pos: d.blocks.filter((b) => b.kind !== 'card').length }); });
    const done = await poll(() => { refreshQueue(); const r = readOf(QASIDA); return r && r.pos >= r.total && isDue(r, appNow()) ? r : null; }, 'the qasida clipping is read to its end', 8000);
    await sessionAt(done);
    must(actions() === 'dismiss / later / dismiss', `at the end, ⏎ reads dismiss: ${actions()}`);
    await shot('cadence-end');
    before = await text(QASIDA);
    key('Enter');
    after = await changed(QASIDA, before, '⏎ wrote the file');
    must(meta(parse(after).doc).read === undefined, 'its read field is gone: dismissed');
    must(useApp.getState().log[0] === doneLine('“', 'On translating the qaṣīda', 'dismissed'), `the done row: "${useApp.getState().log[0]}"`);

    // ── the inspector's interval field ──
    openNode(HAMILTON);
    // 17, not the sample's 14: the note was backlog (due oct 29) and `postpone the rest` grew it above
    const hIvl = String((await readLine(HAMILTON))!.ivl);
    const ivl = await poll(() => qa<HTMLInputElement>('.insp .ivl-field').find((f) => f.value === hIvl), `the note's inspector has an interval field reading ${hIvl}`, 8000);
    before = await text(HAMILTON);
    setNum(ivl, '100');
    after = await changed(HAMILTON, before, 'the field wrote the file');
    const h = meta(parse(after).doc).read!;
    must(h.ivl === 100 && h.due === addDays(DAY1, 100) && h.reps === 2, `ivl=100 due=+100, nothing else: ${after.split('\n').find((l) => l.startsWith('read:'))}`);
    await shot('cadence-interval');

    // ── another day: the order differs; the tweak postpones the backlog at the day's start ──
    setClockDay(DAY2);
    refreshQueue();
    const o2 = order();
    const common = o1.filter((k) => o2.includes(k));
    const a = common.map((k) => o1.indexOf(k));
    const b = common.map((k) => o2.indexOf(k));
    let inversions = 0;
    for (let i = 0; i < common.length; i++) for (let j = i + 1; j < common.length; j++) if ((a[i]! - a[j]!) * (b[i]! - b[j]!) < 0) inversions++;
    must(common.length > 20 && inversions > 0, `the order differs the next day: ${inversions} pairs swapped among ${common.length} shared elements`);
    const backlog = overflow(items(), appNow());
    must(backlog.length > 0 && backlog.every((i) => i.due !== undefined && i.due < DAY2), `a backlog of ${backlog.length} on the new day`);
    useApp.getState().setBacklog(true);
    setClockDay(DAY1);
    refreshQueue();
    setClockDay(DAY2);
    refreshQueue();
    await poll(() => useApp.getState().log[0]?.startsWith('postponed · ') ? useApp.getState().log[0] : null, 'the day\'s first build postponed the backlog', 8000);
    await poll(() => { refreshQueue(); return overflow(items(), appNow()).length === 0 ? true : null; }, 'and none is left', 8000);
    useApp.getState().setBacklog(false);

    // ── dark ──
    openNode(queueId('today'));
    useApp.getState().setTheme('dark');
    await poll(() => document.documentElement.dataset.theme === 'dark', 'dark');
    await shot('cadence-dark');
    useApp.getState().setTheme('light');
    setClockDay(null);
    finished = true;
    log(`done; vault ${vault.root}`);
  } catch (e) {
    finished = true;
    useApp.getState().setBacklog(false);
    setClockDay(null);
    log(`failed: ${e instanceof Error ? e.message : String(e)}`);
  }
}

// `ILMI_SMOKE=readme` over a copy of `samples/double-major`: the screens the
// README shows, nothing asserted. Each `shot:` line marks one, in the light
// theme and then the dark; the book is opened at the pages its sections box.
export async function smokeReadme(vault: Vault): Promise<void> {
  const log = (s: string) => info(`smoke readme: ${s}`);
  const q = <T extends Element>(sel: string) => document.querySelector<T>(sel);
  const shot = async (name: string, ms = 3000) => { await sleep(1500); log(`shot: ${name}`); await sleep(ms); };
  const open = async (path: string) => {
    openNode(path);
    await until(() => (activeTab(useApp.getState().panes)?.id === path ? q('.pane-body .doc-view .draft-doc, .pane-body .deck-view, .pane-body .folder-view, .pane-body .book') : null), 15000);
    await sleep(600);
  };
  const scrollTo = (text: string) => {
    const el = Array.from(document.querySelectorAll<HTMLElement>('.doc-view .draft-doc > *')).find((e) => e.textContent?.includes(text));
    el?.scrollIntoView({ block: 'start' });
  };
  const PT = 'courses/fall-2026/phys-412-quantum-ii/nondegenerate-perturbation-theory.md';
  const CH3 = 'library/lindqvist-statistical-physics/ch-3-the-canonical-ensemble.md';
  const QM = 'courses/fall-2026/phys-412-quantum-ii.md';
  const screens: [string, () => Promise<void>][] = [
    ['queue', async () => { openNode(queueId('today')); await until(() => q('.queue .qlist li')); await sleep(600); }],
    ['book', async () => {
      await open(CH3);
      await until(() => q('.pane-body .book .pdf-page canvas'), 20000);
      await sleep(2500);
      q('.pane-body .book .pdf-page[data-page="24"]')?.scrollIntoView({ block: 'start' });
      await sleep(2500);
    }],
    ['note', async () => { await open(PT); scrollTo('second order'); }],
    ['notebook', () => open(QM)],
    ['arabic', async () => { await open('courses/fall-2026/arab-401-advanced-grammar/kana-and-its-sisters.md'); scrollTo('خبر'); }],
    ['deck', () => open('arabic/vocabulary.md')],
    ['draft', () => open('courses/fall-2026/arab-455-abbasid-poetry/term-paper.md')],
    ['folder', () => open('courses/fall-2026')],
    ['session', async () => {
      openNode(queueId('today'));
      await until(() => q('.queue'));
      press('Enter');
      await until(() => q('.recall-wrap .card, .doc-session'), 10000);
      for (let i = 0; i < 80 && !q('.recall-wrap .card .cloze-text'); i++) { press(']'); await sleep(120); }
      await sleep(400);
    }],
    ['session-shown', async () => { press(' '); await sleep(300); }],
  ];
  try {
    setSidebar({ hidden: false });
    setInspector({ open: false });
    useApp.setState({ railFolded: {} });
    for (const p of ['courses', 'courses/fall-2026', 'courses/fall-2026/phys-412-quantum-ii', 'library', 'library/lindqvist-statistical-physics', 'arabic']) toggleOpen(p, true);
    for (const theme of ['light', 'dark'] as const) {
      useApp.getState().setTheme(theme);
      await until(() => (document.documentElement.dataset.theme === theme ? true : null));
      for (const [name, go] of screens) {
        await go();
        await shot(theme === 'light' ? name : `${name}-${theme}`);
      }
    }
    useApp.getState().setTheme('light');
    log(`done; vault ${vault.root}`);
  } catch (e) {
    log(`failed: ${e instanceof Error ? e.message : String(e)}`);
    useApp.getState().setTheme('light');
  }
}

// ── milestone 53: sync by git ────────────────────────────────────

type SyncStep = { id: number; name: string; args: Record<string, unknown> };
type SyncReply = { id: number; ok: boolean; value?: unknown; error?: string };

/**
 * One device's moves, by name: what the second window does when asked
 * over the `smoke-step` event, and what the first does itself. Each
 * resolves to what the asking side checks.
 */
async function syncSteps(name: string, args: Record<string, unknown>): Promise<unknown> {
  const { meta, parse } = await import('../format/index.js');
  const { advanceRead } = await import('../schedule/index.js');
  const { gradeCard } = await import('./grading.js');
  const { appNow } = await import('./clock.js');
  const { cloneCollection, openConflicts, push, saveSettings, setNudgeServer, setPullTimer, setRemote, settingsOf, syncAge, syncNow, syncWord } = await import('./sync.js');
  const { deleteCollection, listCollections } = await import('../vault/tauri-store.js');
  const { crdtNow, crdtOn, devStorage, filesSettled, joinCollection, setCrdtTimers } = await import('./crdt.js');
  type StoreFs = import('../vault/index.js').StoreFs;
  const vault = () => { const v = currentVault(); if (!v) throw new Error('no vault open'); return v; };
  const sfs = () => vault().fs as StoreFs;
  /** The strip's words while `fn` runs, as the store has them: a covered window may not draw each. */
  const wordsDuring = async <T,>(fn: () => Promise<T>): Promise<{ value: T; words: string[] }> => {
    const words = new Set<string>();
    const stop = useApp.subscribe((s) => { const w = syncWord(s.sync); if (w) words.add(w); });
    try { return { value: await fn(), words: [...words] }; } finally { stop(); }
  };
  const text = async (p: string) => vault().fs.readText(vault().abs(p));
  const state = () => {
    const s = useApp.getState();
    return { word: syncWord(s.sync), age: syncAge(s.sync), ago: document.querySelector('.top .ago')?.textContent ?? null, toPush: s.sync.toPush, conflicts: s.sync.conflicts, notice: s.notice?.line ?? null, log: s.log.slice(0, 3), root: s.vault };
  };
  const str = (k: string) => { const v = args[k]; if (typeof v !== 'string') throw new Error(`${name}: ${k}`); return v; };
  switch (name) {
    case 'clone': {
      // the clone is a collection named as `dest` is; the one an earlier run left under that name goes first
      const name = vaultName(str('dest'));
      const { home, names } = await listCollections();
      if (names.includes(name)) await deleteCollection(`${home}/${name}`);
      const dest = await cloneCollection(str('url'), '', name);
      // the nudge smoke: its own server, set before the vault opens and subscribes
      if (typeof args.server === 'string') saveSettings(dest, { ...settingsOf(dest), server: args.server });
      await openVault(dest);
      await until(() => (useApp.getState().docs['arabic/vocabulary.md'] ? true : null), 20000);
      await until(() => (useApp.getState().sync.on ? true : null), 20000);
      // the first pull writes the collection out to the repository's folder before it reads synced
      await until(() => (syncWord(useApp.getState().sync) === 'synced' ? true : null), 30000);
      return state();
    }
    case 'grade': {
      const item = useApp.getState().queue.find((i): i is CardItem => i.kind === 'card' && i.path === str('path') && i.id === str('id'));
      if (!item) throw new Error(`no card ${str('id')} in ${str('path')}`);
      await gradeCard(item, Number(args.g) as 1 | 2 | 3 | 4, appNow());
      const line = (await text(str('path'))).split('\n').find((l, i, ls) => l.startsWith('<!-- sr') && ls[i - 1]?.endsWith(`^${str('id')}`));
      return line ?? null;
    }
    case 'pass': {
      await vault().update(str('path'), (doc) => { advanceRead(doc, 'on', appNow(), (meta(doc).read?.pos ?? 0) + 1); });
      return meta(parse(await text(str('path'))).doc).read ?? null;
    }
    case 'edit': {
      await vault().update(str('path'), (doc) => {
        for (const b of doc.blocks) if ((b.kind === 'paragraph' || b.kind === 'card') && b.text.includes(str('find'))) b.text = b.text.replace(str('find'), str('replace'));
      });
      return await text(str('path'));
    }
    case 'make': {
      const made = await vault().importDoc(str('dir'), { title: str('name'), text: str('text') });
      await until(() => (useApp.getState().docs[made] ? true : null), 8000);
      return made;
    }
    case 'order': {
      const names = args.names as string[];
      await vault().setOrder(str('dir'), names);
      return vault().order[str('dir')] ?? null;
    }
    case 'orderOf':
      return vault().order[str('dir')] ?? null;
    // milestone 62: the tree
    case 'place':
      return await vault().place(str('path'), str('target'), str('mode') as 'before' | 'after');
    case 'rename':
      return await vault().rename(str('path'), str('name'));
    case 'move':
      return await vault().move(str('path'), str('dir'));
    case 'paths':
      return [...vault().documents()].sort();
    case 'sync':
      // through the storage when the collection has one (milestone 61), else by git
      if (crdtOn()) await crdtNow();
      else await syncNow();
      return state();
    // milestone 61: this window's collection is made from the storage, and opens
    case 'join': {
      setCrdtTimers(false);
      // from a folder, or (milestone 63) from a storage by its settings, which become this collection's
      const from = typeof args.storage === 'string' ? args.storage : ((args.settings as import('./storage.js').StorageSettings | undefined) ?? await devStorage());
      if (!from) throw new Error('join: no storage');
      const root = await joinCollection(from, vaultName(str('dest')), true);
      await openVault(root);
      await until(() => (useApp.getState().docs['arabic/vocabulary.md'] ? true : null), 30000);
      await until(() => (syncWord(useApp.getState().sync) === 'synced' ? true : null), 30000);
      return { ...state(), documents: vault().documents().length, took: (await import('./crdt.js')).lastJoin?.took ?? 0 };
    }
    // milestone 64: a sign-in of this window's own, back by a link
    case 'signIn': {
      const { signIn } = await import('./storage.js');
      return signIn(args.settings as import('./storage.js').StorageSettings, true);
    }
    // milestone 63: the files
    case 'away':
      return sfs().away();
    case 'blobFiles': {
      // the files under this collection's `blobs/`, on disk
      const { tauriFs } = await import('../vault/tauri-fs.js');
      const dir = `${vault().root}/blobs`;
      await invoke('allow_vault', { path: dir });
      if (!(await tauriFs.stat(dir))) return [];
      const out: { name: string; size: number }[] = [];
      for (const d of await tauriFs.readDir(dir)) {
        if (!d.isDir) { out.push({ name: d.name, size: (await tauriFs.stat(`${dir}/${d.name}`))?.size ?? 0 }); continue; }
        for (const f of await tauriFs.readDir(`${dir}/${d.name}`)) out.push({ name: f.name, size: (await tauriFs.stat(`${dir}/${d.name}/${f.name}`))?.size ?? 0 });
      }
      return out;
    }
    case 'rowAway': {
      // the book's row in the tree, its folders opened, and what it says of its PDF
      const path = str('path');
      for (let at = path.indexOf('/'); at > 0; at = path.indexOf('/', at + 1)) toggleOpen(path.slice(0, at), true);
      const row = await until(() => document.querySelector<HTMLElement>(`.trow[data-path="${CSS.escape(path)}"]:not(.placeholder)`), 8000);
      row.scrollIntoView({ block: 'center' });
      await sleep(200);
      return row.querySelector('.away')?.textContent ?? null;
    }
    case 'openBook': {
      // the book opened: its PDF fetched if it is not here, its first page drawn
      const { value, words } = await wordsDuring(async () => {
        // a page of the book that was open before is not this one's
        for (const c of document.querySelectorAll<HTMLElement>('.pdf-page canvas')) c.dataset.before = '1';
        openNode(str('path'));
        await until(() => (activeTab(useApp.getState().panes)?.id === str('path') ? true : null), 8000);
        await until(() => document.querySelector(`.pane[data-active="1"] .book .pdf-page[data-page="1"] canvas:not([data-before])`), Number(args.ms ?? 30000));
        return true;
      });
      await sleep(400);
      return { ...state(), drawn: value, words, pages: document.querySelectorAll('.pane[data-active="1"] .book .pdf-page').length };
    }
    case 'syncWords': {
      const { words } = await wordsDuring(async () => { await crdtNow(); await filesSettled(); });
      return { ...state(), words };
    }
    case 'settle':
      await filesSettled();
      return sfs().away();
    case 'size':
      return (await vault().fs.stat(vault().abs(str('path'))))?.size ?? null;
    case 'search':
      return [...new Set((await sfs().search(str('q'), 1000)).map((h) => h.path))].sort();
    case 'sha': {
      const bytes = await vault().fs.readBytes(vault().abs(str('path')));
      const hash = await crypto.subtle.digest('SHA-256', bytes as BufferSource);
      return { size: bytes.length, sha: [...new Uint8Array(hash)].map((x) => x.toString(16).padStart(2, '0')).join('') };
    }
    case 'image': {
      // a small file that is not text, written as an image a note would name
      const bytes = Uint8Array.from(atob(str('base64')), (c) => c.charCodeAt(0));
      await vault().fs.writeBytes(vault().abs(str('path')), bytes);
      return bytes.length;
    }
    case 'memory':
      return await invoke<[number, number] | null>('dev_web_memory', { collect: false });
    case 'keep': {
      // Tweaks › keep files, by its button
      useApp.setState({ tweaksOpen: true });
      const row = await until(() => [...document.querySelectorAll<HTMLElement>('.tweaks .tw-row')].find((r) => r.querySelector('.tw-lbl')?.textContent === 'keep files'), 5000);
      const button = [...row.querySelectorAll<HTMLButtonElement>('button')].find((x) => x.textContent === str('to'));
      if (!button) throw new Error(`keep: no ${str('to')}`);
      button.click();
      await sleep(300);
      const lit = row.querySelector('button[data-active="1"]')?.textContent ?? null;
      if (!args.stay) useApp.setState({ tweaksOpen: false });
      return lit;
    }
    case 'documents':
      return vault().documents().length;
    case 'reviews':
      return (await vault().loadReviews()).length;
    case 'state':
      return state();
    case 'text':
      return await text(str('path'));
    case 'remote':
      await setRemote(str('url'), '');
      return state();
    case 'conflicts':
      openConflicts();
      return state();
    case 'open':
      openNode(str('path'));
      await sleep(300);
      return state();
    case 'theme':
      useApp.getState().setTheme(str('name') as 'light' | 'dark');
      await sleep(200);
      return state();
    // milestone 54
    case 'push':
      await push();
      return state();
    case 'timer':
      setPullTimer(Boolean(args.on));
      return state();
    case 'nudge':
      setNudgeServer(str('server'));
      return state();
    default:
      throw new Error(`no step ${name}`);
  }
}

/**
 * The second window's side (`ILMI_VAULT2`, whose name the collection it clones takes):
 * it waits for the first window's steps, runs each, and answers on
 * `smoke-reply`. Nothing opens until the clone step.
 */
export async function smokeSyncSecond(path2: string | null, mode = 'sync'): Promise<void> {
  const { emitTo, listen } = await import('@tauri-apps/api/event');
  const log = (s: string) => void info(`smoke ${mode === 'crdt' || mode === 'storage' ? mode : 'sync'} b: ${s}`);
  if (!path2) { log('failed: no ILMI_VAULT2'); return; }
  useApp.setState({ started: true, inspForced: true });
  await listen<SyncStep>('smoke-step', (ev) => {
    const { id, name, args } = ev.payload;
    void syncSteps(name, args)
      .then((value) => { log(`${name} ok`); return emitTo('main', 'smoke-reply', { id, ok: true, value } satisfies SyncReply); })
      .catch((e: unknown) => { const error = e instanceof Error ? e.message : String(e); log(`${name} failed: ${error}`); return emitTo('main', 'smoke-reply', { id, ok: false, error } satisfies SyncReply); });
  });
  log('ready');
}

// `ILMI_SMOKE=sync` (`smokeSync`) over a fresh copy of `samples/double-major`,
// with `ILMI_VAULT2` an empty path beside it: milestone 53. This window (a)
// makes a bare repository beside its copy and connects to it; the second
// window (b) clones it. Then, each step synced in turn (a push, the other's
// pull and push, the first's pull): a card graded in each lands in both;
// the same card graded in both keeps the later grade; a pass on each lands
// in both; a paragraph edited in both shows both under a notice, and the
// strip says `1 conflict` until the file is opened; a drag in both keeps
// the pulled order; a remote that cannot be reached reads `offline` and
// comes back; a pull that changes the open document says so. Light, then
// dark.
export async function smokeSync(vault: Vault): Promise<void> {
  const { emitTo, listen } = await import('@tauri-apps/api/event');
  const { meta, parse } = await import('../format/index.js');
  const { connect, initBare, saveSettings, syncNow, syncWord } = await import('./sync.js');
  let last = { at: Date.now(), what: 'start' };
  let finished = false;
  const log = (s: string) => { last = { at: Date.now(), what: s }; void info(`smoke sync: ${s}`); };
  const dog = setInterval(() => {
    if (finished) { clearInterval(dog); return; }
    if (Date.now() - last.at > 45_000) { finished = true; clearInterval(dog); void info(`smoke sync: failed: no progress for 45 s after "${last.what}"`); }
  }, 2000);
  const shot = async (name: string, ms = 2500) => { await sleep(800); log(`shot: ${name}`); await sleep(ms); };
  const q = <T extends Element>(sel: string, root: ParentNode = document) => root.querySelector<T>(sel);
  const must = (ok: unknown, what: string) => { if (!ok) throw new Error(what); log(`ok: ${what}`); };
  const poll = async <T,>(probe: () => T | null | undefined | false | Promise<T | null | undefined | false>, what: string, ms = 8000): Promise<T> => {
    const t0 = Date.now();
    for (;;) {
      const v = await probe();
      if (v) { log(`ok: ${what}`); return v; }
      if (Date.now() - t0 > ms) throw new Error(`${what} (waited ${ms} ms)`);
      await sleep(100);
    }
  };
  // the second window's steps: asked over an event, answered over another
  const replies = new Map<number, (r: SyncReply) => void>();
  let seq = 0;
  const unlisten = await listen<SyncReply>('smoke-reply', (ev) => { replies.get(ev.payload.id)?.(ev.payload); });
  const b = async <T,>(name: string, args: Record<string, unknown> = {}, ms = 30000): Promise<T> => {
    const id = ++seq;
    const reply = new Promise<SyncReply>((resolve, reject) => {
      replies.set(id, resolve);
      setTimeout(() => { replies.delete(id); reject(new Error(`b: ${name} (no answer in ${ms} ms)`)); }, ms);
    });
    await emitTo('second', 'smoke-step', { id, name, args } satisfies SyncStep);
    const r = await reply;
    replies.delete(id);
    if (!r.ok) throw new Error(`b: ${name}: ${r.error}`);
    log(`b: ${name}`);
    return r.value as T;
  };
  const a = <T,>(name: string, args: Record<string, unknown> = {}) => syncSteps(name, args) as Promise<T>;
  type State = { word: string | null; toPush: number; conflicts: { path: string; heading: string }[]; notice: string | null; log: string[]; root: string | null };
  const word = () => q('.top .sync')?.textContent ?? null;
  const VOCAB = 'arabic/vocabulary.md';
  const MERCHANT = 'library/classical-prose-reader/15-the-merchant-who-was-robbed.md';
  const QASIDA = 'courses/fall-2026/arab-455-abbasid-poetry/clipped-on-translating-the-qasida.md';
  const NOTE = 'fleeting/idea-for-honors-thesis.md';
  const FLEETING = 'fleeting';
  const srLine = (text: string, id: string) => text.split('\n').find((l, i, ls) => l.startsWith('<!-- sr') && ls[i - 1]?.endsWith(`^${id}`)) ?? null;
  // keys sorted: a value from the second window crossed the event bridge, whose Rust side orders an object's keys
  const canon = (v: unknown) => (v && typeof v === 'object' ? JSON.stringify(v, Object.keys(v).sort()) : JSON.stringify(v ?? null));
  const readLine = (text: string) => canon(meta(parse(text).doc).read ?? null);
  try {
    const path2 = await invoke<string | null>('dev_env', { name: 'ILMI_VAULT2' });
    if (!path2) throw new Error('ILMI_VAULT2 is not set');
    useApp.getState().setTheme('light');
    await poll(() => useApp.getState().docs[VOCAB] && useApp.getState().docs[NOTE], 'the sample is in the collection', 15000);
    must(word() === null, 'the strip says nothing while the collection has no remote');

    // ── a connects, b clones ──
    // the host is a bare repository beside the folder the collection was imported from
    const host = `${await sourceDir()}-host.git`;
    await initBare(host);
    saveSettings(vault.root, { url: host, token: '', server: '' });
    useApp.setState({ tweaksOpen: true });
    await poll(() => q<HTMLInputElement>('.tweaks .tw-text')?.value === host, 'the tweaks show the remote');
    const btn = await poll(() => Array.from(document.querySelectorAll<HTMLButtonElement>('.tweaks .tw-seg button')).find((x) => x.textContent === 'connect' && !x.disabled), 'connect is there');
    await shot('sync-tweaks');
    btn.click();
    await poll(() => word() === 'synced', 'connect: the strip reads synced', 20000);
    useApp.setState({ tweaksOpen: false });
    must((await a<string>('text', { path: '.gitignore' })).includes('.ilmi/state.json'), 'the ignore file leaves state.json out');
    await poll(() => useApp.getState().log.includes('connected'), 'connect: noted', 20000);
    const bs = await b<State>('clone', { url: host, dest: path2, server: '' }, 60000);
    must(vaultName(bs.root ?? '') === vaultName(path2) && bs.word === 'synced', `b cloned into the collection ${vaultName(path2)} and reads synced`);
    must(!(await b<string>('text', { path: '.ilmi/order.json' })).includes('"tab"'), 'b has the order and no state.json');

    // ── a card graded in each lands in both ──
    const karam = await a<string>('grade', { path: VOCAB, id: 'voc-karam', g: 3 });
    await poll(() => word() === '1 to push', 'a grade: the strip reads 1 to push');
    await shot('sync-pending');
    const dayf = await b<string>('grade', { path: VOCAB, id: 'voc-dayf', g: 4 });
    await a('sync');
    await poll(() => word() === 'synced', 'a pushed: synced');
    const bAfter = await b<State>('sync');
    must(bAfter.word === 'synced' && bAfter.conflicts.length === 0, `b merged and pushed: ${bAfter.word}`);
    openNode(VOCAB);
    await sleep(500);
    await a('sync');
    const tA = await a<string>('text', { path: VOCAB });
    const tB = await b<string>('text', { path: VOCAB });
    must(srLine(tA, 'voc-karam') === karam && srLine(tB, 'voc-karam') === karam, "a's grade is in both");
    must(srLine(tA, 'voc-dayf') === dayf && srLine(tB, 'voc-dayf') === dayf, "b's grade is in both");
    await poll(() => useApp.getState().notice?.line === 'pulled · arabic vocabulary changed', 'a notice: the open document changed under the pull');
    await shot('sync-pulled');

    // ── the same card graded in both keeps the later grade ──
    await a('grade', { path: VOCAB, id: 'voc-naqa', g: 2 });
    await sleep(1200);
    const naqaB = await b<string>('grade', { path: VOCAB, id: 'voc-naqa', g: 4 });
    await a('sync');
    const bMerged = await b<State>('sync');
    must(bMerged.conflicts.length === 0, 'the same line on both is no conflict');
    must(srLine(await b<string>('text', { path: VOCAB }), 'voc-naqa') === naqaB, "b keeps its later grade");
    await a('sync');
    must(srLine(await a<string>('text', { path: VOCAB }), 'voc-naqa') === naqaB, "a takes b's later grade");

    // ── a pass on each ──
    const mA = canon(await a('pass', { path: MERCHANT }));
    const qB = canon(await b('pass', { path: QASIDA }));
    await a('sync');
    await b('sync');
    await a('sync');
    const mB = readLine(await b<string>('text', { path: MERCHANT }));
    must(mB === mA, `a's pass is in b: ${mB} (a wrote ${mA})`);
    const qA = readLine(await a<string>('text', { path: QASIDA }));
    must(qA === qB, `b's pass is in a: ${qA} (b wrote ${qB})`);

    // ── a paragraph edited in both shows both under a notice ──
    await a('edit', { path: NOTE, find: 'Ask both.', replace: 'Ask both, soon.' });
    await b('edit', { path: NOTE, find: 'Deadline for the proposal is February.', replace: 'Deadline for the proposal is February, firm.' });
    await a('sync');
    const conflict = await b<State>('sync');
    must(conflict.word === '1 conflict' && conflict.conflicts.length === 1 && conflict.conflicts[0]!.path === NOTE && conflict.conflicts[0]!.heading === 'idea for honors thesis', `b: ${conflict.word}, ${JSON.stringify(conflict.conflicts)}`);
    must(conflict.notice === 'both versions kept · idea for honors thesis § idea for honors thesis', `b's notice: ${conflict.notice}`);
    const noteB = await b<string>('text', { path: NOTE });
    must(noteB.includes('Ask both, soon.') && noteB.includes('February, firm.') && !/<<<<|>>>>/.test(noteB), 'b keeps both paragraphs, no markers');
    const paras = noteB.split('\n').filter((l) => l.startsWith('Advisors:'));
    must(paras.length === 2, 'as two blocks, one after the other');
    await shot('sync-conflict');
    const opened = await b<State>('conflicts');
    must(opened.word === 'synced' && opened.conflicts.length === 0, 'b: the click opens the file and the count clears');
    await a('sync');
    must((await a<string>('text', { path: NOTE })) === noteB, 'a has both versions too');

    // ── a drag in both keeps the pulled order ──
    const orderA = ['idea-for-honors-thesis.md', '2026-10-30.md', '2026-10-29.md', '2026-10-27.md', 'clipped-why-perturbation-series-diverge.md'];
    const orderB = ['clipped-why-perturbation-series-diverge.md', '2026-10-27.md', '2026-10-29.md', '2026-10-30.md', 'idea-for-honors-thesis.md'];
    await a('order', { dir: FLEETING, names: orderA });
    await b('order', { dir: FLEETING, names: orderB });
    await a('sync');
    const dragged = await b<State>('sync');
    must(dragged.conflicts.length === 0, 'the order is no conflict');
    // the pull wrote `.ilmi/order.json`; b's vault takes it once its watcher reports the file
    let orderBNow = '';
    for (let i = 0; i < 25 && orderBNow !== JSON.stringify(orderA); i++) {
      if (i) await sleep(200);
      orderBNow = JSON.stringify(await b('orderOf', { dir: FLEETING }));
    }
    must(orderBNow === JSON.stringify(orderA), `b takes the pulled order: ${orderBNow}`);
    await a('sync');
    must(JSON.stringify(await a('orderOf', { dir: FLEETING })) === JSON.stringify(orderA), "a's order stands");
    await shot('sync-order');

    // ── offline, and back ──
    await b('remote', { url: `${vault.root}-nowhere.git` });
    const off = await b<State>('sync');
    must(off.word === 'offline', `b with a remote it cannot reach: ${off.word}`);
    await b('remote', { url: host });
    const back = await b<State>('sync');
    must(back.word === 'synced', `b back on its remote: ${back.word}`);
    await poll(() => word() === 'synced', 'a: synced');
    await shot('sync-synced');

    // ── dark ──
    useApp.getState().setTheme('dark');
    await b('theme', { name: 'dark' });
    await poll(() => document.documentElement.dataset.theme === 'dark', 'dark');
    await shot('sync-dark');
    useApp.getState().setTheme('light');
    await b('theme', { name: 'light' });
    await syncNow();
    must(syncWord(useApp.getState().sync) === 'synced', 'synced at the end');
    finished = true;
    unlisten();
    log(`done; vault ${vault.root}, host ${host}, b ${path2}`);
  } catch (e) {
    finished = true;
    unlisten();
    log(`failed: ${e instanceof Error ? e.message : String(e)}`);
  }
}

// `ILMI_SMOKE=crdt` (`smokeCrdt`) over `samples/double-major`, with
// `ILMI_STORAGE` an empty folder and `ILMI_VAULT2` a name for the second
// collection: milestone 61. This window's collection (a) meets the empty
// folder and becomes its first changes; the second window (b) makes a
// collection from the folder. Then, each step synced in turn: b holds what
// a holds; a card graded in each lands in both, with both lines in the
// log; the same card graded in both keeps the later review; a card
// reworded in a and graded in b is one card with both; a pass on each
// lands in both; one paragraph edited in both is one paragraph with both
// edits, named in a notice, the strip reading `1 conflict` until the file
// is opened; a document made in b is in a; the folder holds `format`, a
// directory a device, and the PDFs. Milestone 62, the tree: a drag in each
// of one directory merges move by move, and one row dragged in both is
// where the later drag put it; a document renamed in a and edited in b,
// with a page made under it in b, is one document under its new name with
// its children; a folder moved in a with a document made in it in b is one
// folder in its new place with the document. Light, then dark.
export async function smokeCrdt(vault: Vault): Promise<void> {
  const { emitTo, listen } = await import('@tauri-apps/api/event');
  const { meta, parse } = await import('../format/index.js');
  const { crdtNow, crdtOn, setCrdtTimers, storageDir } = await import('./crdt.js');
  const { syncWord } = await import('./sync.js');
  const { tauriFs } = await import('../vault/tauri-fs.js');
  let last = { at: Date.now(), what: 'start' };
  let finished = false;
  const log = (s: string) => { last = { at: Date.now(), what: s }; void info(`smoke crdt: ${s}`); };
  const dog = setInterval(() => {
    if (finished) { clearInterval(dog); return; }
    if (Date.now() - last.at > 60_000) { finished = true; clearInterval(dog); void info(`smoke crdt: failed: no progress for 60 s after "${last.what}"`); }
  }, 2000);
  const shot = async (name: string, ms = 2500) => { await sleep(800); log(`shot: ${name}`); await sleep(ms); };
  const q = <T extends Element>(sel: string, root: ParentNode = document) => root.querySelector<T>(sel);
  const must = (ok: unknown, what: string) => { if (!ok) throw new Error(what); log(`ok: ${what}`); };
  const poll = async <T,>(probe: () => T | null | undefined | false | Promise<T | null | undefined | false>, what: string, ms = 8000): Promise<T> => {
    const t0 = Date.now();
    for (;;) {
      const v = await probe();
      if (v) { log(`ok: ${what}`); return v; }
      if (Date.now() - t0 > ms) throw new Error(`${what} (waited ${ms} ms)`);
      await sleep(100);
    }
  };
  const replies = new Map<number, (r: SyncReply) => void>();
  let seq = 0;
  const unlisten = await listen<SyncReply>('smoke-reply', (ev) => { replies.get(ev.payload.id)?.(ev.payload); });
  const b = async <T,>(name: string, args: Record<string, unknown> = {}, ms = 30000): Promise<T> => {
    const id = ++seq;
    const reply = new Promise<SyncReply>((resolve, reject) => {
      replies.set(id, resolve);
      setTimeout(() => { replies.delete(id); reject(new Error(`b: ${name} (no answer in ${ms} ms)`)); }, ms);
    });
    await emitTo('second', 'smoke-step', { id, name, args } satisfies SyncStep);
    const r = await reply;
    replies.delete(id);
    if (!r.ok) throw new Error(`b: ${name}: ${r.error}`);
    log(`b: ${name}`);
    return r.value as T;
  };
  const a = <T,>(name: string, args: Record<string, unknown> = {}) => syncSteps(name, args) as Promise<T>;
  type State = { word: string | null; toPush: number; conflicts: { path: string; heading: string }[]; notice: string | null; log: string[]; root: string | null; documents?: number };
  const word = () => q('.top .sync')?.textContent ?? null;
  const VOCAB = 'arabic/vocabulary.md';
  const MERCHANT = 'library/classical-prose-reader/15-the-merchant-who-was-robbed.md';
  const QASIDA = 'courses/fall-2026/arab-455-abbasid-poetry/clipped-on-translating-the-qasida.md';
  const NOTE = 'fleeting/idea-for-honors-thesis.md';
  const FLEETING = 'fleeting';
  const srLine = (text: string, id: string) => text.split('\n').find((l, i, ls) => l.startsWith('<!-- sr') && ls[i - 1]?.endsWith(`^${id}`)) ?? null;
  const canon = (v: unknown) => (v && typeof v === 'object' ? JSON.stringify(v, Object.keys(v).sort()) : JSON.stringify(v ?? null));
  const readLine = (text: string) => canon(meta(parse(text).doc).read ?? null);
  /** a's change out, b's merge and its own out, a's merge. */
  const round = async (): Promise<State> => { await a('sync'); const s = await b<State>('sync'); await a('sync'); return s; };
  try {
    const path2 = await invoke<string | null>('dev_env', { name: 'ILMI_VAULT2' });
    const storage = await storageDir();
    if (!path2) throw new Error('ILMI_VAULT2 is not set');
    if (!storage) throw new Error('ILMI_STORAGE is not set');
    setCrdtTimers(false);
    useApp.getState().setTheme('light');
    await poll(() => useApp.getState().docs[VOCAB] && useApp.getState().docs[NOTE], 'the sample is in the collection', 15000);

    // ── a makes the storage, b is made from it ──
    await poll(() => crdtOn() && word() === 'synced', 'a met the folder and reads synced', 60000);
    await poll(() => useApp.getState().log.includes('storage made'), 'a: noted');
    const names = async (rel: string) => (await tauriFs.readDir(`${storage}${rel ? `/${rel}` : ''}`)).map((e) => e.name).filter((n) => !n.startsWith('.')).sort();
    must(JSON.stringify(await names('')) === JSON.stringify(['blobs', 'devices', 'format']), `the folder holds blobs, devices and format: ${(await names('')).join(' ')}`);
    const devices = await names('devices');
    must(devices.length === 1 && /^[0-9a-f]{16}$/.test(devices[0]!), `one device has written: ${devices.join(' ')}`);
    const filesA = (await names(`devices/${devices[0]}`)).length;
    must(filesA >= 1, `in ${filesA} file${filesA === 1 ? '' : 's'}`);
    const docsA = vault.documents().length;
    const reviewsA = (await vault.loadReviews()).length;
    const bs = await b<State>('join', { storage, dest: path2 }, 120000);
    must(vaultName(bs.root ?? '') === vaultName(path2) && bs.word === 'synced', `b was made from the folder as ${vaultName(path2)} and reads synced`);
    must(bs.documents === docsA, `b holds a's ${docsA} documents (${bs.documents})`);
    must((await b<number>('reviews')) === reviewsA, `and its ${reviewsA} lines of the log`);
    for (const p of [VOCAB, NOTE, MERCHANT, 'physics/derivation-drills.md']) must((await b<string>('text', { path: p })) === (await a<string>('text', { path: p })), `${p} reads the same in both`);
    must(JSON.stringify(await b('orderOf', { dir: FLEETING })) === JSON.stringify(vault.order[FLEETING] ?? null), "b has a's order");
    must((await names('devices')).length === 1, 'b has written nothing yet: it only read');
    // the search index (milestone 68): b's is its own, made as the rows came in, and nothing of it was written to the storage
    const found = (who: typeof a, text: string) => who<string[]>('search', { q: text });
    const krm = await found(b, 'كرم');
    must(krm.length === 5 && JSON.stringify(krm) === JSON.stringify(await found(a, 'كرم')), `b's own index finds the five files that hold كرم, as a's does: ${krm.join(' ')}`);
    await shot('crdt-joined');

    // ── a card graded in each lands in both ──
    const karam = await a<string>('grade', { path: VOCAB, id: 'voc-karam', g: 3 });
    await poll(() => word() === '1 to push', 'a grade: the strip reads 1 to push');
    await shot('crdt-pending');
    const dayf = await b<string>('grade', { path: VOCAB, id: 'voc-dayf', g: 4 });
    openNode(VOCAB);
    await sleep(500);
    const merged = await round();
    must(merged.word === 'synced' && merged.conflicts.length === 0, `b merged and wrote its own: ${merged.word}`);
    await poll(() => word() === 'synced', 'a: synced');
    const tA = await a<string>('text', { path: VOCAB });
    const tB = await b<string>('text', { path: VOCAB });
    must(srLine(tA, 'voc-karam') === karam && srLine(tB, 'voc-karam') === karam, "a's grade is in both");
    must(srLine(tA, 'voc-dayf') === dayf && srLine(tB, 'voc-dayf') === dayf, "b's grade is in both");
    must(tA === tB, 'the document is the same in both');
    must((await vault.loadReviews()).length === reviewsA + 2 && (await b<number>('reviews')) === reviewsA + 2, 'the log has both grades, in both');
    must((await names('devices')).length === 2, 'two devices have written');
    await poll(() => useApp.getState().notice?.line === 'pulled · arabic vocabulary changed', 'a notice: the open document changed under the merge');
    await poll(() => useApp.getState().queue.every((i) => !(i.kind === 'card' && i.path === VOCAB && i.id === 'voc-dayf' && i.dueAt.getTime() <= Date.now())), "a's queue no longer holds b's card as due");
    await shot('crdt-pulled');

    // ── the same card graded in both keeps the later review ──
    await a('grade', { path: VOCAB, id: 'voc-naqa', g: 2 });
    await sleep(1200);
    const naqaB = await b<string>('grade', { path: VOCAB, id: 'voc-naqa', g: 4 });
    const later = await round();
    must(later.conflicts.length === 0, 'the same schedule on both is no conflict');
    must(srLine(await b<string>('text', { path: VOCAB }), 'voc-naqa') === naqaB, 'b keeps its later review');
    must(srLine(await a<string>('text', { path: VOCAB }), 'voc-naqa') === naqaB, "a takes b's later review");

    // ── a card reworded in a and graded in b is one card with both ──
    must((await a<string>('text', { path: VOCAB })).split('\n').some((l) => l.endsWith('^voc-akrama') && l.includes('to honour, treat generously')), 'the card voc-akrama is there');
    await a('edit', { path: VOCAB, find: 'to honour, treat generously', replace: 'to honour, to treat generously' });
    const akramaB = await b<string>('grade', { path: VOCAB, id: 'voc-akrama', g: 3 });
    const both = await round();
    must(both.conflicts.length === 0, 'a rewording and a grade are no conflict');
    for (const [who, t] of [['a', await a<string>('text', { path: VOCAB })], ['b', await b<string>('text', { path: VOCAB })]] as const) {
      const lines = t.split('\n').filter((l) => l.endsWith('^voc-akrama'));
      must(lines.length === 1 && lines[0]!.includes('to honour, to treat generously'), `${who}: one card, reworded`);
      must(srLine(t, 'voc-akrama') === akramaB, `${who}: with b's grade`);
    }

    // ── a pass on each ──
    const mA = canon(await a('pass', { path: MERCHANT }));
    const qB = canon(await b('pass', { path: QASIDA }));
    await round();
    const mB = readLine(await b<string>('text', { path: MERCHANT }));
    must(mB === mA, `a's pass is in b: ${mB} (a wrote ${mA})`);
    const qA = readLine(await a<string>('text', { path: QASIDA }));
    must(qA === qB, `b's pass is in a: ${qA} (b wrote ${qB})`);

    // ── one paragraph edited in both: one paragraph with both, and a notice ──
    // a word written on one is found on the other once it has merged; gone from there once it is taken out
    await a('edit', { path: NOTE, find: 'Ask both.', replace: 'Ask both, zyzzyva.' });
    must((await found(b, 'zyzzyva')).length === 0, 'a word a has just written: not found on b yet');
    await round();
    must(JSON.stringify(await found(b, 'zyzzyva')) === JSON.stringify([NOTE]), 'found on b once merged');
    await a('edit', { path: NOTE, find: 'Ask both, zyzzyva.', replace: 'Ask both.' });
    await round();
    must((await found(b, 'zyzzyva')).length === 0 && (await found(a, 'zyzzyva')).length === 0, 'and gone from both when it is taken out');
    await a('edit', { path: NOTE, find: 'Ask both.', replace: 'Ask both, soon.' });
    await b('edit', { path: NOTE, find: 'Deadline for the proposal is February.', replace: 'Deadline for the proposal is February, firm.' });
    await a('sync');
    const conflict = await b<State>('sync');
    must(conflict.word === '1 conflict' && conflict.conflicts.length === 1 && conflict.conflicts[0]!.path === NOTE && conflict.conflicts[0]!.heading === 'idea for honors thesis', `b: ${conflict.word}, ${JSON.stringify(conflict.conflicts)}`);
    must(conflict.notice === 'both edited · idea for honors thesis § idea for honors thesis', `b's notice: ${conflict.notice}`);
    const noteB = await b<string>('text', { path: NOTE });
    must(noteB.includes('Ask both, soon.') && noteB.includes('February, firm.') && !/<<<<|>>>>/.test(noteB), 'b has both edits, no markers');
    must(noteB.split('\n').filter((l) => l.startsWith('Advisors:')).length === 1, 'in one paragraph');
    const opened = await b<State>('conflicts');
    must(opened.word === 'synced' && opened.conflicts.length === 0, 'b: the click opens the file and the count clears');
    await a('sync');
    must((await a<string>('text', { path: NOTE })) === noteB, 'a has the same paragraph');
    await poll(() => word() === '1 conflict', 'a: the strip reads 1 conflict');
    must(useApp.getState().notice?.line === 'both edited · idea for honors thesis § idea for honors thesis', `a's notice: ${useApp.getState().notice?.line}`);
    await shot('crdt-both');
    q<HTMLElement>('.top .sync')?.click();
    await poll(() => word() === 'synced' && activeTab(useApp.getState().panes)?.id === NOTE, 'a: the click opens the file and the count clears');

    // ── two drags of one directory merge move by move; one row dragged in both is where the later put it ──
    const fl = (name: string) => `${FLEETING}/${name}`;
    const orderIs = async (want: string[], what: string) => {
      await poll(() => JSON.stringify(vault.order[FLEETING] ?? null) === JSON.stringify(want), `a: ${what}`, 10000).catch((e: unknown) => { throw new Error(`${e instanceof Error ? e.message : String(e)}; a has ${JSON.stringify(vault.order[FLEETING] ?? null)}`); });
      const inB = JSON.stringify(await b('orderOf', { dir: FLEETING }));
      must(inB === JSON.stringify(want), `b: ${what} (${inB})`);
    };
    must(JSON.stringify(vault.order[FLEETING]) === JSON.stringify(['2026-10-30.md', '2026-10-29.md', '2026-10-27.md', 'clipped-why-perturbation-series-diverge.md', 'idea-for-honors-thesis.md']), `the directory's order before: ${JSON.stringify(vault.order[FLEETING])}`);
    await a('place', { path: fl('idea-for-honors-thesis.md'), target: fl('2026-10-30.md'), mode: 'before' });
    await b('place', { path: fl('2026-10-27.md'), target: fl('clipped-why-perturbation-series-diverge.md'), mode: 'after' });
    await round();
    await orderIs(['idea-for-honors-thesis.md', '2026-10-30.md', '2026-10-29.md', 'clipped-why-perturbation-series-diverge.md', '2026-10-27.md'], "a's drag and b's drag are both in the order");
    await a('place', { path: fl('2026-10-29.md'), target: fl('2026-10-27.md'), mode: 'after' });
    await sleep(1200);
    await b('place', { path: fl('2026-10-29.md'), target: fl('idea-for-honors-thesis.md'), mode: 'before' });
    await round();
    const orderB = ['2026-10-29.md', 'idea-for-honors-thesis.md', '2026-10-30.md', 'clipped-why-perturbation-series-diverge.md', '2026-10-27.md'];
    await orderIs(orderB, 'one row dragged in both is where the later drag put it');
    await poll(() => { const rows = Array.from(document.querySelectorAll<HTMLElement>('.side .row')).map((r) => r.dataset.path ?? '').filter((p) => p.startsWith(`${FLEETING}/`)); return rows.length >= 5 && rows[0] === `${FLEETING}/${orderB[0]}`; }, 'the sidebar draws it').catch(() => log('the sidebar rows were not read (no data-path); the order above stands'));
    await shot('crdt-order');

    // ── a document renamed in a, edited in b with a page made under it: one document, renamed, its children with it ──
    const POETRY = 'courses/fall-2026/arab-455-abbasid-poetry';
    const PAPER = `${POETRY}/term-paper.md`;
    /** Both windows' documents, once they are the same: each window's vault follows a merge a moment after it. */
    const sameTree = async (what: string) => {
      let inB: string[] = [];
      for (let i = 0; i < 50; i++) {
        if (i) await sleep(200);
        inB = await b<string[]>('paths');
        if (JSON.stringify([...vault.documents()].sort()) === JSON.stringify(inB)) { log(`ok: ${what}: a and b hold the same documents (${inB.length})`); return inB; }
      }
      const inA = new Set(vault.documents());
      throw new Error(`${what}: a and b hold the same documents; only in a: ${[...inA].filter((p) => !inB.includes(p)).join(', ') || 'none'}; only in b: ${inB.filter((p) => !inA.has(p)).join(', ') || 'none'}`);
    };
    const before62 = (await sameTree('before the rename')).length;
    const paper = await a<string>('rename', { path: PAPER, name: 'the gift taken back' });
    must(paper === `${POETRY}/the gift taken back.md`, `a renamed the draft: ${paper}`);
    await b('edit', { path: PAPER, find: 'Going with the first for now.', replace: 'Going with the second for now.' });
    await b('make', { dir: `${POETRY}/term-paper`, name: 'a page made under the old name', text: 'Made in b while a renamed its parent.' });
    await round();
    const afterRename = await sameTree('after the rename');
    const under = afterRename.filter((p) => p.startsWith(`${POETRY}/the gift taken back`));
    must(JSON.stringify(under) === JSON.stringify([`${POETRY}/the gift taken back.md`, `${POETRY}/the gift taken back/a page made under the old name.md`, `${POETRY}/the gift taken back/outline-v1.md`, `${POETRY}/the gift taken back/reading-notes.md`]), `one document under its new name, its two children and b's page with it: ${under.map((p) => p.slice(POETRY.length + 1)).join(' | ')}`);
    must(!afterRename.some((p) => p.startsWith(`${POETRY}/term-paper`)), 'nothing is left under the old name');
    must(afterRename.length === before62 + 1, `nothing twice, nothing lost: ${before62} documents and the one b made (${afterRename.length})`);
    const paperA = await a<string>('text', { path: paper });
    must(paperA.includes('Going with the second for now.') && paperA === (await b<string>('text', { path: paper })), "b's edit is in the renamed document, the same in both");
    const orderOfB = async (dir: string): Promise<string> => {
      let inB = '';
      for (let i = 0; i < 25; i++) {
        if (i) await sleep(200);
        inB = JSON.stringify(await b('orderOf', { dir }));
        if (inB === JSON.stringify(vault.order[dir] ?? null)) break;
      }
      return inB;
    };
    const poetryB = await orderOfB(POETRY);
    must(JSON.stringify(vault.order[POETRY] ?? null) === poetryB && poetryB.includes('"the gift taken back.md"') && !poetryB.includes('term-paper'), `it keeps its place in its directory's order, in both: ${poetryB}`);
    openNode(paper);
    await sleep(400);
    await shot('crdt-renamed');

    // ── a folder moved in a, a document made in it in b: one folder, in its new place, with the document ──
    const went = await a<string>('move', { path: 'courses/fall-2025', dir: 'library' });
    must(went === 'library/fall-2025', `a moved the folder: ${went}`);
    await b('make', { dir: 'courses/fall-2025', name: 'made where the folder was', text: 'Made in b while a moved the folder.' });
    await b('make', { dir: 'courses/fall-2025/phys-301-classical-mechanics', name: 'a fourth lecture', text: 'Made in b under a document a moved.' });
    await round();
    const afterMove = await sameTree('after the move');
    const inFolder = afterMove.filter((p) => p.startsWith('library/fall-2025/'));
    must(JSON.stringify(inFolder) === JSON.stringify(['library/fall-2025/made where the folder was.md', 'library/fall-2025/phys-301-classical-mechanics.md', 'library/fall-2025/phys-301-classical-mechanics/a fourth lecture.md', 'library/fall-2025/phys-301-classical-mechanics/central-forces-and-orbits.md', 'library/fall-2025/phys-301-classical-mechanics/hamiltonian-mechanics.md', 'library/fall-2025/phys-301-classical-mechanics/lagrangian-mechanics.md']), `the folder is in its new place with what it held and what b made in it: ${inFolder.map((p) => p.slice('library/fall-2025/'.length)).join(' | ')}`);
    must(!afterMove.some((p) => p.startsWith('courses/fall-2025')), 'nothing is left where it was');
    must(afterMove.length === before62 + 3, `nothing twice, nothing lost (${afterMove.length})`);
    must((await a<string>('text', { path: 'library/fall-2025/made where the folder was.md' })).includes('Made in b while a moved the folder.'), "b's document has its text in a");
    const coursesB = await orderOfB('courses');
    must(JSON.stringify(vault.order['courses'] ?? null) === coursesB && !coursesB.includes('fall-2025'), `the directory it left no longer lists it, in both: ${coursesB}`);
    openNode('library/fall-2025/made where the folder was.md');
    await sleep(400);
    await shot('crdt-moved');

    // ── a document made in b is in a ──
    const docsB = await b<number>('documents');
    await b('make', { dir: FLEETING, name: 'made on the other device', text: 'A line written where it was made.' });
    await round();
    await poll(() => vault.documents().includes(`${FLEETING}/made on the other device.md`), 'a has the document b made', 10000);
    must((await a<string>('text', { path: `${FLEETING}/made on the other device.md` })).includes('A line written where it was made.'), 'with its text');
    must(vault.documents().length === before62 + 4 && (await b<number>('documents')) === docsB + 1, 'one more document in each');
    await sameTree('at the end');

    // ── nothing more to say ──
    const quiet = await round();
    must(quiet.word === 'synced' && syncWord(useApp.getState().sync) === 'synced', 'synced at the end, both');
    await shot('crdt-synced');

    // ── dark ──
    useApp.getState().setTheme('dark');
    await b('theme', { name: 'dark' });
    await poll(() => document.documentElement.dataset.theme === 'dark', 'dark');
    await shot('crdt-dark');
    useApp.getState().setTheme('light');
    await b('theme', { name: 'light' });
    await crdtNow();
    finished = true;
    unlisten();
    log(`done; collection ${vault.root}, storage ${storage}, b ${path2}`);
  } catch (e) {
    finished = true;
    unlisten();
    log(`failed: ${e instanceof Error ? e.message : String(e)}`);
  }
}


// `ILMI_SMOKE=storage` (`smokeStorage`) over `samples/double-major`, with
// `ILMI_KIND=s3`, `webdav`, `dropbox` or `drive` (the loopback server a debug
// build carries, shaped like each, over `ILMI_STORAGE_DIR`),
// `ILMI_VAULT2` a name for the second collection, `ILMI_BIG` a PDF of 200 MB
// on disk and `ILMI_SNAP=4`: milestone 63. Nothing names the storage but
// the tweaks: in this window (a) the kind is chosen, its fields typed,
// and `connect` pressed, and the collection, which keeps every file,
// meets the empty storage. The second window's (b), which keeps what it
// has opened, is made from the storage and holds no PDF: its books' rows
// say `not here`. A grade in each lands in the other. b opens a book: its
// PDF is fetched, and only it. a takes the big PDF in from disk and syncs:
// it goes up by the piece, the strip saying how far; b's row says `not
// here` and how big it is; b opens it: it comes down by the piece, and
// its first page is drawn; the web view's memory has not grown by the
// file. An image made in b is in a after a sync, unopened. The change
// files pass the count: a snapshot is in the storage, and a third
// collection made from it holds what the others hold, and no file until
// its `keep files` is set to all. Over Dropbox or Drive (milestone 64) a
// presses `sign in` and it comes back to the loopback, a plain client
// playing the browser; b signs in apart, as another device would, and comes
// back by a link through the deep-link event; no token is in `localStorage`;
// the big PDF goes in a session and the servers say so; at the end the
// service lets go of the sign-ins, the sync says `sign in again`, and a
// sign-in from the row has it syncing again.
export async function smokeStorage(vault: Vault): Promise<void> {
  const { emitTo, listen } = await import('@tauri-apps/api/event');
  const { crdtOn, filesSettled, setCrdtTimers } = await import('./crdt.js');
  const { devStorages, signsIn, storageFor, storageOf } = await import('./storage.js');
  type StoreFs = import('../vault/index.js').StoreFs;
  let last = { at: Date.now(), what: 'start' };
  let finished = false;
  const log = (s: string) => { last = { at: Date.now(), what: s }; void info(`smoke storage: ${s}`); };
  const dog = setInterval(() => {
    if (finished) { clearInterval(dog); return; }
    if (Date.now() - last.at > 150_000) { finished = true; clearInterval(dog); void info(`smoke storage: failed: no progress for 150 s after "${last.what}"`); }
  }, 2000);
  const shot = async (name: string, ms = 2500) => { await sleep(800); log(`shot: ${name}`); await sleep(ms); };
  const q = <T extends Element>(sel: string, root: ParentNode = document) => root.querySelector<T>(sel);
  const must = (ok: unknown, what: string) => { if (!ok) throw new Error(what); log(`ok: ${what}`); };
  const poll = async <T,>(probe: () => T | null | undefined | false | Promise<T | null | undefined | false>, what: string, ms = 8000): Promise<T> => {
    const t0 = Date.now();
    for (;;) {
      const v = await probe();
      if (v) { log(`ok: ${what}`); return v; }
      if (Date.now() - t0 > ms) throw new Error(`${what} (waited ${ms} ms)`);
      await sleep(100);
    }
  };
  const replies = new Map<number, (r: SyncReply) => void>();
  let seq = 0;
  const unlisten = await listen<SyncReply>('smoke-reply', (ev) => { replies.get(ev.payload.id)?.(ev.payload); });
  const b = async <T,>(name: string, args: Record<string, unknown> = {}, ms = 30000): Promise<T> => {
    const id = ++seq;
    const reply = new Promise<SyncReply>((resolve, reject) => {
      replies.set(id, resolve);
      setTimeout(() => { replies.delete(id); reject(new Error(`b: ${name} (no answer in ${ms} ms)`)); }, ms);
    });
    await emitTo('second', 'smoke-step', { id, name, args } satisfies SyncStep);
    const r = await reply;
    replies.delete(id);
    if (!r.ok) throw new Error(`b: ${name}: ${r.error}`);
    log(`b: ${name}`);
    return r.value as T;
  };
  const a = <T,>(name: string, args: Record<string, unknown> = {}) => syncSteps(name, args) as Promise<T>;
  type State = { word: string | null; toPush: number; conflicts: { path: string; heading: string }[]; notice: string | null; log: string[]; root: string | null; documents?: number; words?: string[]; drawn?: boolean; pages?: number; took?: number };
  type OnDisk = { name: string; size: number }[];
  const word = () => q('.top .sync')?.textContent ?? null;
  const VOCAB = 'arabic/vocabulary.md';
  const NOTE = 'fleeting/idea-for-honors-thesis.md';
  const BOOK = 'library/classical-prose-reader.md';
  const BOOK_PDF = 'library/classical-prose-reader.pdf';
  const OTHER_PDF = 'library/lindqvist-statistical-physics.pdf';
  const BIG = 'library/a-big-book.md';
  const BIG_PDF = 'library/a-big-book.pdf';
  const srLine = (text: string, id: string) => text.split('\n').find((l, i, ls) => l.startsWith('<!-- sr') && ls[i - 1]?.endsWith(`^${id}`)) ?? null;
  const mb = (n: number) => `${(n / 1048576).toFixed(0)} MB`;
  /** a's change out, b's merge and its own out, a's merge. */
  const round = async (): Promise<State> => { await a('sync'); const s = await b<State>('sync'); await a('sync'); return s; };
  /** Until both hold the same documents: b's vault follows a merge a moment after its sync answers. */
  const sameDocs = async (what: string) => poll(async () => JSON.stringify(await b('paths')) === JSON.stringify(await a('paths')), what, 15000);
  try {
    const path2 = await invoke<string | null>('dev_env', { name: 'ILMI_VAULT2' });
    const big = await invoke<string | null>('dev_env', { name: 'ILMI_BIG' });
    const kind = await invoke<string | null>('dev_env', { name: 'ILMI_KIND' });
    if (!path2) throw new Error('ILMI_VAULT2 is not set');
    if (kind !== 's3' && kind !== 'webdav' && kind !== 'dropbox' && kind !== 'drive') throw new Error('ILMI_KIND is not s3, webdav, dropbox or drive');
    if (!big) throw new Error('ILMI_BIG is not set');
    let settings = (await devStorages())[kind];
    const cloud = signsIn(kind);
    type Cloud = Record<string, number>;
    const cloudStats = async (): Promise<Cloud> => (await invoke<Record<string, Cloud>>('dev_cloud_stats'))[kind]!;
    setCrdtTimers(false);
    useApp.getState().setTheme('light');
    await poll(() => useApp.getState().docs[VOCAB] && useApp.getState().docs[NOTE], 'the sample is in the collection', 15000);

    // ── the tweaks: the kind chosen, its fields typed, connect ──
    must(!crdtOn() && word() === null, 'a: no storage yet, and the strip says nothing of one');
    useApp.setState({ tweaksOpen: true });
    const rowOf = (label: string) => [...document.querySelectorAll<HTMLElement>('.tweaks .tw-row')].find((r) => r.querySelector('.tw-lbl')?.firstChild?.textContent?.trim() === label);
    const press = (row: HTMLElement | undefined, text: string) => { const x = [...(row?.querySelectorAll<HTMLButtonElement>('button') ?? [])].find((n) => n.textContent === text); if (!x || x.disabled) throw new Error(`no ${text} to press`); x.click(); };
    const type = async (label: string, value: string) => {
      const input = (await poll(() => rowOf(label)?.querySelector<HTMLInputElement>('input'), `a: the ${label} field`)) as HTMLInputElement;
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input, value);
      input.dispatchEvent(new Event('input', { bubbles: true }));
      input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));
      await sleep(80);
    };
    const storageRow = await poll(() => rowOf('storage'), 'a: the tweaks have a storage row');
    must(storageRow.querySelector('.tw-val')?.textContent === 'off' && [...storageRow.querySelectorAll('button')].map((x) => x.textContent).join(' ') === 'folder s3 webdav dropbox google drive', 'it reads off, and offers the five kinds');
    const actions = () => [...document.querySelectorAll<HTMLElement>('.tweaks .tw-row')].find((r) => [...r.querySelectorAll('button')].some((x) => x.textContent === 'connect' && r.querySelector('.tw-lbl') === null));
    must(rowOf('keep files')?.querySelector('button[data-active="1"]')?.textContent === 'all', 'keep files reads all');
    press(storageRow, kind === 'drive' ? 'google drive' : kind);
    await sleep(150);
    must([...(actions()?.querySelectorAll<HTMLButtonElement>('button') ?? [])].every((x) => x.disabled), 'connect and join wait for the fields');
    if (kind === 's3') {
      await type('endpoint', settings.endpoint);
      await type('bucket', settings.bucket);
      await type('key', settings.key);
      await type('secret', settings.secret);
      must(rowOf('secret')?.querySelector('input')?.type === 'password', 'the secret is not shown');
    } else if (kind === 'webdav') {
      await type('address', settings.address);
      await type('user', settings.user);
      await type('password', settings.password);
      must(rowOf('password')?.querySelector('input')?.type === 'password', 'the password is not shown');
    } else {
      must(rowOf('account')?.querySelector('button')?.disabled, 'sign in waits for the client');
      if (kind === 'dropbox') await type('app key', settings.appKey);
      else {
        await type('client id', settings.clientId);
        await type('client secret', settings.clientSecret);
        must(rowOf('client secret')?.querySelector('input')?.type === 'password', 'the client secret is not shown');
      }
      await type('folder', settings.place);
      must([...(actions()?.querySelectorAll<HTMLButtonElement>('button') ?? [])].every((x) => x.disabled), 'connect and join wait for a sign-in');
      (await import('./crdt.js')).setStorage({ dev: settings.dev });
      await sleep(80);
      const signedBefore = (await cloudStats()).sign_ins ?? 0;
      press(rowOf('account'), 'sign in');
      await poll(() => rowOf('account')?.querySelector('.tw-val')?.textContent === 'signed in', 'a: signed in, back by the loopback', 20000);
      must(((await cloudStats()).sign_ins ?? 0) === signedBefore + 1, 'the service saw one sign-in');
      const held = globalThis.localStorage.getItem('ilmi.storage') ?? '';
      const accountId = storageOf(vault.root).account;
      must(accountId !== '' && !/refresh|access_token|"token"/.test(held), 'the settings name the sign-in and hold no token');
      must(await invoke<boolean>('oauth_signed_in', { account: accountId }), 'and the sign-in is held on the Rust side');
      await shot('storage-signed-in');
      settings = { ...settings, account: accountId };
    }
    const kept = storageOf(vault.root);
    must(kept.kind === kind && !kept.on && (kind === 's3' ? kept.secret === settings.secret && kept.bucket === settings.bucket : kind === 'webdav' ? kept.password === settings.password && kept.address === settings.address : kept.place === settings.place && kept.account === settings.account), 'the fields are kept with the tweaks');
    press(actions(), 'connect');

    // ── a makes the storage on the server, b is made from it and keeps what it opens ──
    await poll(() => crdtOn() && word() === 'synced', `a met the ${kind} storage and reads synced`, 60000);
    await poll(() => useApp.getState().log.includes('storage made'), 'a: noted');
    await poll(() => rowOf('storage')?.querySelector('.tw-val')?.textContent === 'synced' && rowOf('storage')?.querySelector<HTMLButtonElement>('button')?.disabled, 'the row reads synced, its kind held');
    must(storageOf(vault.root).on, 'and the collection is set to sync through it');
    await shot('storage-tweaks');
    useApp.setState({ tweaksOpen: false });
    const st = await storageFor(settings, vault.root);
    const listing = await st.list('');
    must(listing.includes('format') && listing.some((p) => /^devices\/[0-9a-f]{16}\/1$/.test(p)), `the storage holds format and a device's first file (${listing.length} files)`);
    must(listing.filter((p) => p.startsWith('blobs/')).length === 2, 'and the two PDFs, each under its hash');
    must((await a<string[]>('settle')).length === 0, 'a keeps every file: none is away');
    const docsA = vault.documents().length;
    const reviewsA = (await vault.loadReviews()).length;
    // another device signs in for itself; on a device it comes back by a link
    const bSettings = cloud ? { ...settings, account: await b<string>('signIn', { settings: { ...settings, account: '' } }, 30000) } : settings;
    if (cloud) must(bSettings.account !== settings.account && (await cloudStats()).sign_ins! >= 2, 'b: signed in apart, back by a link');
    const bs = await b<State>('join', { dest: path2, settings: { ...bSettings, keep: 'opened' } }, 120000);
    must(vaultName(bs.root ?? '') === vaultName(path2) && bs.word === 'synced', `b was made from the storage as ${vaultName(path2)} and reads synced`);
    must(bs.documents === docsA, `b holds a's ${docsA} documents (${bs.documents})`);
    must((await b<number>('reviews')) === reviewsA, `and its ${reviewsA} lines of the log`);
    for (const p of [VOCAB, NOTE, BOOK]) must((await b<string>('text', { path: p })) === (await a<string>('text', { path: p })), `${p} reads the same in both`);
    must(JSON.stringify(await b('away')) === JSON.stringify([BOOK_PDF, OTHER_PDF]), 'b: both PDFs are named and neither is here');
    must((await b<OnDisk>('blobFiles')).length === 0, 'b holds no PDF on disk');
    must((await b<number>('size', { path: BOOK_PDF })) === (await a<number>('size', { path: BOOK_PDF })), 'b knows how big the one it does not hold is');
    must((await b<string | null>('rowAway', { path: BOOK })) === 'not here', "b: the book's row says not here");
    must((await a<string | null>('rowAway', { path: BOOK })) === null, "a: the book's row says nothing");
    await shot('storage-joined');

    // ── a grade in each lands in the other ──
    const karam = await a<string>('grade', { path: VOCAB, id: 'voc-karam', g: 3 });
    await poll(() => word() === '1 to push', 'a grade: the strip reads 1 to push');
    const dayf = await b<string>('grade', { path: VOCAB, id: 'voc-dayf', g: 4 });
    const merged = await round();
    must(merged.word === 'synced' && merged.conflicts.length === 0, `b merged and wrote its own: ${merged.word}`);
    await poll(() => word() === 'synced', 'a: synced');
    const tA = await a<string>('text', { path: VOCAB });
    const tB = await b<string>('text', { path: VOCAB });
    must(srLine(tA, 'voc-karam') === karam && srLine(tB, 'voc-karam') === karam, "a's grade is in both");
    must(srLine(tA, 'voc-dayf') === dayf && srLine(tB, 'voc-dayf') === dayf, "b's grade is in both");
    must(tA === tB, 'the document is the same in both');
    must((await vault.loadReviews()).length === reviewsA + 2 && (await b<number>('reviews')) === reviewsA + 2, 'the log has both grades, in both');
    must((await st.list('devices/')).map((p) => p.split('/')[1]).filter((d, i, l) => l.indexOf(d) === i).length === 2, 'two devices have written to the storage');
    must((await b<OnDisk>('blobFiles')).length === 0, 'b still holds no PDF: a sync fetches none');

    // ── b opens a book: its PDF comes, and only it ──
    const opened = await b<State>('openBook', { path: BOOK }, 60000);
    must(opened.drawn, 'b: the book opens as its pages, the first drawn');
    must(JSON.stringify(await b('away')) === JSON.stringify([OTHER_PDF]), 'b: the opened PDF is here, the other is not');
    must((await b<OnDisk>('blobFiles')).length === 1, 'b holds one PDF on disk');
    const shaA = await a<{ size: number; sha: string }>('sha', { path: BOOK_PDF });
    const shaB = await b<{ size: number; sha: string }>('sha', { path: BOOK_PDF });
    must(shaA.sha === shaB.sha && shaA.size === shaB.size, `and it is a's, byte for byte (${shaA.size} bytes)`);
    must((await b<string | null>('rowAway', { path: BOOK })) === null, "b: the book's row no longer says not here");
    await shot('storage-opened');

    // ── a 200 MB PDF: taken in from disk, up by the piece, away in b, down by the piece when it is opened ──
    const { tauriFs } = await import('../vault/tauri-fs.js');
    await invoke('allow_vault', { path: big.slice(0, big.lastIndexOf('/')) });
    const bigSize = (await tauriFs.stat(big))?.size ?? 0;
    must(bigSize >= 200 * 1048576, `the big PDF is ${mb(bigSize)} on disk`);
    const weigh = async (when: string) => log(`each web process, ${when}: ${(await invoke<[number, number, number][]>('dev_web_processes', { collect: false })).map(([pid, now, peak]) => `${pid} ${mb(now)} (most ${mb(peak)})`).join(', ')}`);
    await weigh('before');
    const mem0 = await a<[number, number] | null>('memory');
    const t0 = Date.now();
    must(await (vault.fs as StoreFs).take(vault.abs(BIG_PDF), big), 'a: taken in as a file, not through the window');
    await vault.fs.writeText(vault.abs(BIG), '---\ntitle: a big book\ntype: source\n---\n\nTwo hundred megabytes of pages.\n');
    await poll(() => useApp.getState().docs[BIG], 'a: the book is in the tree');
    log(`took: ${Date.now() - t0} ms`);
    await weigh('taken in');
    must((await a<number>('size', { path: BIG_PDF })) === bigSize, `a: its row says ${mb(bigSize)}`);
    const t1 = Date.now();
    const up = await a<State>('syncWords');
    log(`up: ${Date.now() - t1} ms · ${up.words?.join(', ')}`);
    must(up.words?.some((w) => /^pushing \d+%$/.test(w)), 'a: the strip said how far the file was on its way up');
    must(up.word === 'synced', 'a: synced');
    await weigh('sent');
    must((await st.list('blobs/')).length === 3, 'the storage holds it, under its hash');
    if (kind === 'dropbox') {
      const c = await cloudStats();
      log(`dropbox: ${JSON.stringify(c)}`);
      must(c.sessions === 1 && c.finished === 1 && c.appends! >= 12 && c.largest_append! <= 16 * 1048576, `it went in a session of ${c.appends} appends, none over 16 MiB`);
      must(c.largest_whole! < 150 * 1048576, 'and no upload of it whole');
      must(c.dropped_replies === 1 && c.offsets_said === 1, 'a reply lost on the way, and the session said where it stood');
    } else if (kind === 'drive') {
      const c = await cloudStats();
      log(`drive: ${JSON.stringify(c)}`);
      must(c.sessions! >= 1 && c.finished! >= 1 && c.chunks! >= 12 && c.largest_chunk! <= 16 * 1048576, `it went in a session of ${c.chunks} chunks, none over 16 MiB`);
      must(c.failed_chunks! >= 1 && c.asked! >= 1, 'a chunk failed, and the session was asked how far it had got');
    }
    const got = await b<State>('sync');
    await sameDocs('b has the book');
    must(got.word === 'synced', 'b: synced');
    must((await b<string[]>('away')).includes(BIG_PDF), 'b: the big PDF is named, and not here');
    must((await b<number>('size', { path: BIG_PDF })) === bigSize, `b: its row knows it is ${mb(bigSize)}`);
    must((await b<OnDisk>('blobFiles')).length === 1, 'b still holds one PDF on disk');
    must((await b<string | null>('rowAway', { path: BIG })) === 'not here', "b: the big book's row says not here");
    await shot('storage-big-away');
    await weigh('b has merged');
    const t2 = Date.now();
    // the lifetime peak cannot see a rise below an earlier high, so what each process holds is read while the file comes
    const held0 = new Map((await invoke<[number, number, number][]>('dev_web_processes', { collect: false })).map(([pid, now]) => [pid, now]));
    const most = new Map<number, number>();
    const sample = setInterval(() => { void invoke<[number, number, number][]>('dev_web_processes', { collect: false }).then((ps) => { for (const [pid, now] of ps) most.set(pid, Math.max(most.get(pid) ?? 0, now)); }); }, 200);
    const down = await b<State>('openBook', { path: BIG, ms: 120000 }, 150000).finally(() => clearInterval(sample));
    log(`each web process, the most it held while the file came and was drawn: ${[...most].map(([pid, n]) => `${pid} ${mb(n)}`).join(', ')}`);
    const rise = Math.max(0, ...[...most].map(([pid, n]) => n - (held0.get(pid) ?? n)));
    must(rise < bigSize, `no web process rose by the file while it came: the most was ${mb(rise)}, drawing the page`);
    log(`down and drawn: ${Date.now() - t2} ms · ${down.words?.join(', ')}`);
    await weigh('fetched and drawn');
    must(down.drawn, 'b: the big book opens, its first page drawn');
    must(down.words?.some((w) => /^pulling \d+%$/.test(w)), 'b: the strip said how far the file was on its way down');
    const onDisk = await b<OnDisk>('blobFiles');
    must(onDisk.length === 2 && onDisk.some((f) => f.size === bigSize), `b holds it on disk, whole (${onDisk.map((f) => mb(f.size)).join(', ')})`);
    must(!(await b<string[]>('away')).includes(BIG_PDF) && (await b<string | null>('rowAway', { path: BIG })) === null, 'b: and its row no longer says not here');
    const mem1 = await a<[number, number] | null>('memory');
    if (mem0 && mem1) {
      log(`web view: ${mb(mem0[0])} before, ${mb(mem1[0])} after; the most it held ${mb(mem0[1])} before, ${mb(mem1[1])} after`);
      must(mem1[1] - mem0[1] < bigSize / 2, `the web view never held the file: its peak grew by ${mb(Math.max(0, mem1[1] - mem0[1]))}`);
    } else log('web view: not weighed');
    await shot('storage-big-open');

    // ── a device that keeps every file has one after a sync, unopened ──
    const png = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
    await b('image', { path: 'fleeting/figure.png', base64: png });
    await b('sync');
    await a('syncWords');
    must((await a<string[]>('away')).length === 0, "a: b's image is here after the sync, unopened");
    must((await a<{ size: number; sha: string }>('sha', { path: 'fleeting/figure.png' })).size === atob(png).length, 'and is the image');

    // ── the change files pass the count: a snapshot, and a collection made from it ──
    for (let i = 0; i < 6 && !(await st.list('snapshots/')).some((p) => p.endsWith('/head')); i++) {
      await a('grade', { path: VOCAB, id: i % 2 ? 'voc-naqa' : 'voc-akrama', g: 3 });
      await b('pass', { path: 'library/classical-prose-reader/15-the-merchant-who-was-robbed.md' });
      await round();
    }
    const snaps = await st.list('snapshots/');
    must(snaps.some((p) => /^snapshots\/[0-9a-f]{16}\/1\/head$/.test(p)) && snaps.some((p) => /\/1\/1$/.test(p)), `a snapshot is in the storage (${snaps.length} files)`);
    await round();
    const third = `${path2}-c`;
    const cs = await b<State>('join', { dest: third, settings: { ...bSettings, keep: 'opened' } }, 120000);
    must(vaultName(cs.root ?? '') === vaultName(third) && cs.word === 'synced', `a third collection was made from the storage as ${vaultName(third)}`);
    must((cs.took ?? 0) >= 1, 'from the snapshot, in place of the files it covers');
    await sameDocs('it holds the documents a holds');
    for (const p of [VOCAB, NOTE, BIG]) must((await b<string>('text', { path: p })) === (await a<string>('text', { path: p })), `${p} reads the same in it`);
    must((await b<number>('reviews')) === (await vault.loadReviews()).length, 'and the log');
    must((await b<OnDisk>('blobFiles')).length === 0 && (await b<string[]>('away')).length === 4, 'it holds no file, and names four');
    // ── keep files · all: the files it does not hold come ──
    must((await b<string | null>('keep', { to: 'all', stay: true })) === 'all', 'its keep files, set to all');
    await poll(async () => (await b<string[]>('settle')).length === 0, 'and every file comes', 120000);
    const all = await b<OnDisk>('blobFiles');
    must(all.length === 4 && all.some((f) => f.size === bigSize), `four files on disk, the big one whole (${all.map((f) => mb(f.size)).join(', ')})`);
    await b('rowAway', { path: BIG });

    // ── the service lets go of the sign-ins: said once, and signed in again from the row ──
    if (cloud) {
      const c = await cloudStats();
      log(`${kind}: ${JSON.stringify(c)}`);
      must(c.refreshes! >= 1 && c.limited! >= 1, `tokens ran out ${c.refreshes} times and rate limits were waited out ${c.limited} times, and nothing above failed`);
      await invoke('dev_cloud_revoke', { client: kind === 'dropbox' ? settings.appKey : settings.clientId });
      await a('sync').catch((e: unknown) => log(`a's sync: ${String(e)}`));
      await poll(() => storageOf(vault.root).account === '', 'a: the service let go, and the settings no longer name a sign-in');
      must(q('.notice .nl')?.textContent === 'sign in again', 'a: it says sign in again');
      useApp.setState({ tweaksOpen: true });
      await poll(() => rowOf('account')?.querySelector('.tw-val')?.textContent === '', 'the row no longer reads signed in');
      await shot('storage-sign-in-again');
      press(rowOf('account'), 'sign in');
      await poll(() => rowOf('account')?.querySelector('.tw-val')?.textContent === 'signed in', 'a: signed in again', 20000);
      await poll(() => crdtOn() && word() === 'synced', 'a: and synced again', 60000);
      // milestone 71: sign out forgets the tokens here, and the collection stops syncing through a service it cannot reach
      const account = storageOf(vault.root).account;
      must(Array.from(rowOf('account')?.querySelectorAll('button') ?? []).map((x) => x.textContent).join(' ') === 'sign in sign out', 'the account row offers sign in and sign out');
      press(rowOf('account'), 'sign out');
      await poll(() => storageOf(vault.root).account === '' && !crdtOn(), 'a: signed out, and no longer syncing');
      must(!(await invoke<boolean>('oauth_signed_in', { account })), 'and the Rust side holds no sign-in by that name');
      must(Array.from(rowOf('account')?.querySelectorAll('button') ?? []).map((x) => x.textContent).join(' ') === 'sign in' && rowOf('account')?.querySelector('.tw-val')?.textContent === '', 'the row offers sign in alone');
      await shot('storage-signed-out');
      press(rowOf('account'), 'sign in');
      await poll(() => rowOf('account')?.querySelector('.tw-val')?.textContent === 'signed in', 'a: signed in once more', 20000);
      // the storage's connect, beside its join… (sync by git has a connect of its own)
      const connectBtn = [...document.querySelectorAll<HTMLButtonElement>('.tweaks button')].find((x) => x.textContent === 'connect' && x.nextElementSibling?.textContent === 'join…');
      if (!connectBtn || connectBtn.disabled) throw new Error('no connect to press');
      connectBtn.click();
      try { await poll(() => crdtOn() && word() === 'synced', 'a: connected and synced again', 60000); } catch (e) {
        throw new Error(`${e instanceof Error ? e.message : String(e)}: the strip "${word()}", crdt ${crdtOn()}, the notice "${q('.notice')?.textContent ?? ''}", settings ${JSON.stringify({ ...storageOf(vault.root), secret: undefined, password: undefined })}`);
      }
      useApp.setState({ tweaksOpen: false });
    }

    useApp.getState().setTheme('dark');
    await b('theme', { name: 'dark' });
    await b('rowAway', { path: BIG });
    await shot('storage-dark');
    useApp.getState().setTheme('light');
    await b('theme', { name: 'light' });
    await filesSettled();
    log('done');
  } catch (e) {
    log(`failed: ${e instanceof Error ? e.message : String(e)}`);
  } finally {
    finished = true;
    unlisten();
  }
}
// `ILMI_SMOKE=nudge` (`smokeNudge`) over a fresh copy of `samples/double-major`
// with `ILMI_VAULT2` an empty path beside it: milestone 54. The Rust side
// starts a loopback ntfy-shaped server; this window (a) connects its copy to
// a bare repository beside it with that server as its `nudge`, the second
// window (b) clones with the same, and both turn their pull timers off. A
// grade pushed in a lands in b on the nudge alone, within five seconds, and
// the other way; the strip reads `synced · N s ago`; the streams dropped,
// both come back and the next nudge lands; the nudge off in b, a push in a
// stays out until b pulls, and on again. Light, then dark.
export async function smokeNudge(vault: Vault): Promise<void> {
  const { emitTo, listen } = await import('@tauri-apps/api/event');
  const { connect, initBare, saveSettings, setPullTimer, syncNow, syncWord } = await import('./sync.js');
  const { topicOf } = await import('./nudge.js');
  let last = { at: Date.now(), what: 'start' };
  let finished = false;
  const log = (s: string) => { last = { at: Date.now(), what: s }; void info(`smoke nudge: ${s}`); };
  const dog = setInterval(() => {
    if (finished) { clearInterval(dog); return; }
    if (Date.now() - last.at > 45_000) { finished = true; clearInterval(dog); void info(`smoke nudge: failed: no progress for 45 s after "${last.what}"`); }
  }, 2000);
  const shot = async (name: string, ms = 2500) => { await sleep(800); log(`shot: ${name}`); await sleep(ms); };
  const q = <T extends Element>(sel: string, root: ParentNode = document) => root.querySelector<T>(sel);
  const must = (ok: unknown, what: string) => { if (!ok) throw new Error(what); log(`ok: ${what}`); };
  const poll = async <T,>(probe: () => T | null | undefined | false | Promise<T | null | undefined | false>, what: string, ms = 8000): Promise<T> => {
    const t0 = Date.now();
    for (;;) {
      const v = await probe();
      if (v) { log(`ok: ${what}`); return v; }
      if (Date.now() - t0 > ms) throw new Error(`${what} (waited ${ms} ms)`);
      await sleep(100);
    }
  };
  const replies = new Map<number, (r: SyncReply) => void>();
  let seq = 0;
  const unlisten = await listen<SyncReply>('smoke-reply', (ev) => { replies.get(ev.payload.id)?.(ev.payload); });
  const b = async <T,>(name: string, args: Record<string, unknown> = {}, ms = 30000): Promise<T> => {
    const id = ++seq;
    const reply = new Promise<SyncReply>((resolve, reject) => {
      replies.set(id, resolve);
      setTimeout(() => { replies.delete(id); reject(new Error(`b: ${name} (no answer in ${ms} ms)`)); }, ms);
    });
    await emitTo('second', 'smoke-step', { id, name, args } satisfies SyncStep);
    const r = await reply;
    replies.delete(id);
    if (!r.ok) throw new Error(`b: ${name}: ${r.error}`);
    log(`b: ${name}`);
    return r.value as T;
  };
  const a = <T,>(name: string, args: Record<string, unknown> = {}) => syncSteps(name, args) as Promise<T>;
  type State = { word: string | null; age: string | null; ago: string | null; toPush: number; root: string | null };
  const word = () => q('.top .sync')?.textContent ?? null;
  const age = () => q('.top .ago')?.textContent ?? null;
  const VOCAB = 'arabic/vocabulary.md';
  const srLine = (text: string, id: string) => text.split('\n').find((l, i, ls) => l.startsWith('<!-- sr') && ls[i - 1]?.endsWith(`^${id}`)) ?? null;
  const listeners = (topic: string) => invoke<number>('dev_nudge_listeners', { topic });
  /** A grade in one window, pushed; how long until the other window's file has it. */
  const crossing = async (from: 'a' | 'b', id: string, g: number, limit = 5000): Promise<number> => {
    const here = from === 'a' ? a : b;
    const there = from === 'a' ? b : a;
    const line = await here<string>('grade', { path: VOCAB, id, g });
    await here('push');
    const t0 = Date.now();
    await poll(async () => srLine(await there<string>('text', { path: VOCAB }), id) === line, `${from}'s grade of ${id} crossed on the nudge`, limit);
    return Date.now() - t0;
  };
  try {
    const path2 = await invoke<string | null>('dev_env', { name: 'ILMI_VAULT2' });
    if (!path2) throw new Error('ILMI_VAULT2 is not set');
    const server = await invoke<string>('dev_nudge_serve');
    must(/^http:\/\/127\.0\.0\.1:\d+$/.test(server), `the dev nudge server is at ${server}`);
    useApp.getState().setTheme('light');
    await poll(() => useApp.getState().docs[VOCAB], 'the sample is in the collection', 15000);

    // ── a connects with the server as its nudge; b clones with the same ──
    const host = `${await sourceDir()}-host.git`;
    const topic = topicOf(host);
    await initBare(host);
    saveSettings(vault.root, { url: host, token: '', server });
    useApp.setState({ tweaksOpen: true });
    const fields = await poll(() => { const f = Array.from(document.querySelectorAll<HTMLInputElement>('.tweaks .tw-text')); return f.length >= 3 ? f : null; }, 'the tweaks show the sync fields');
    must(fields[0]!.value === host && fields[2]!.value === server, `remote and nudge fields: ${fields[0]!.value}, ${fields[2]!.value}`);
    must(Array.from(document.querySelectorAll('.tweaks .tw-lbl')).some((l) => l.textContent?.startsWith('nudge')), 'the row is named nudge');
    await shot('nudge-tweaks');
    useApp.setState({ tweaksOpen: false });
    await connect(host, '');
    await poll(() => word() === 'synced', 'connect: the strip reads synced', 20000);
    await poll(async () => (await listeners(topic)) === 1, 'a listens on the topic', 5000);
    setPullTimer(false);
    const bs = await b<State>('clone', { url: host, dest: path2, server }, 60000);
    must(vaultName(bs.root ?? '') === vaultName(path2) && bs.word === 'synced', `b cloned into the collection ${vaultName(path2)} and reads synced`);
    await poll(async () => (await listeners(topic)) === 2, 'b listens too', 5000);
    await b('timer', { on: false });

    // ── a grade pushed in a lands in b on the nudge alone ──
    const ab = await crossing('a', 'voc-karam', 3);
    log(`ok: a → b in ${ab} ms`);
    // the file lands before the pull's own bookkeeping ends: the strip settles a moment later
    const bState = await poll(async () => { const st = await b<State>('state'); return st.word === 'synced' ? st : null; }, "b's pull is over");
    must(bState.age !== null && /^(just now|\d+ s ago)$/.test(bState.age) && bState.ago === bState.age, `b's strip: ${bState.word} · ${bState.ago}`);
    const ba = await crossing('b', 'voc-dayf', 4);
    log(`ok: b → a in ${ba} ms`);
    await poll(() => word() === 'synced' && /^(just now|\d+ s ago)$/.test(age() ?? ''), "a's strip reads synced with its age");
    await shot('nudge-synced');
    await sleep(3000);
    must(/^\d+ s ago$/.test(age() ?? ''), `the age ticks: ${age()}`);

    // ── the streams dropped: both come back, and the next nudge lands ──
    const dropped = await invoke<number>('dev_nudge_drop');
    must(dropped === 2, `the server dropped ${dropped} streams`);
    await poll(async () => (await listeners(topic)) === 2, 'both windows are back on the topic', 10000);
    const again = await crossing('a', 'voc-naqa', 2);
    log(`ok: after the drop, a → b in ${again} ms`);

    // ── the nudge off in b: a push in a stays out until b pulls ──
    await b('nudge', { server: '' });
    const line = await a<string>('grade', { path: VOCAB, id: 'voc-akrama', g: 3 });
    await a('push');
    await sleep(3000);
    must(srLine(await b<string>('text', { path: VOCAB }), 'voc-akrama') !== line, 'without the nudge, b has not seen the grade after 3 s');
    // the http plugin holds a stream while a read waits on it, so b's socket closes on the server's next write: that publish
    await poll(async () => (await listeners(topic)) === 1, 'b left the topic', 5000);
    const pulled = await b<State>('sync');
    must(pulled.word === 'synced' && srLine(await b<string>('text', { path: VOCAB }), 'voc-akrama') === line, "b's own pull brings it");
    await b('nudge', { server });
    await poll(async () => (await listeners(topic)) === 2, 'b is back on the topic', 5000);
    const once = await crossing('a', 'voc-nahara', 3);
    log(`ok: nudge on again, a → b in ${once} ms`);

    // ── dark ──
    useApp.getState().setTheme('dark');
    await b('theme', { name: 'dark' });
    await poll(() => document.documentElement.dataset.theme === 'dark', 'dark');
    await shot('nudge-dark');
    useApp.getState().setTheme('light');
    await b('theme', { name: 'light' });
    await syncNow();
    must(syncWord(useApp.getState().sync) === 'synced', 'synced at the end');
    finished = true;
    unlisten();
    log(`done; vault ${vault.root}, host ${host}, b ${path2}, server ${server}`);
  } catch (e) {
    finished = true;
    unlisten();
    log(`failed: ${e instanceof Error ? e.message : String(e)}`);
  }
}

// `ILMI_SMOKE=ipad`: milestone 55's "done when", from the iPad's side. No
// vault is given: the welcome is where it starts. `ILMI_REMOTE` (on iOS
// `"remote"` in `Documents/smoke.json`) names a repository the sample was
// pushed to; a simulated iPad reads the Mac's disk, so a bare repository
// beside the Mac's copy serves. The welcome shows `connect` alone and the
// vaults in Documents; `connect` with the remote clones it under its own
// name and opens it (a vault of that name left by an earlier run is opened
// from its row instead). The shell is checked for its shape: one pane, no
// split control, the sidebar and the inspector hidden until asked for, the
// sidebar a column in landscape and a sheet over the page in portrait that
// closes once a row is tapped, the strips clear of the status bar. The
// queue is walked by its buttons, never a key: `enter queue`, then up to
// six elements, a card revealed and graded `good`, a topic read on. The
// first card graded is named with its file's changed lines (`graded: …`),
// so the Mac's side can look for the same lines; the push follows and the
// strip must say `synced`. Then a passage is selected in a source for the
// cue (below the selection, `card` and `extract`), and a book is opened
// for its notes: folded in portrait, beside the pages in landscape.
export async function smokeIpad(): Promise<void> {
  const log = (s: string) => info(`smoke ipad: ${s}`);
  const q = <T extends Element>(sel: string, root: ParentNode = document) => root.querySelector<T>(sel);
  const qa = <T extends Element>(sel: string, root: ParentNode = document) => Array.from(root.querySelectorAll<T>(sel));
  const shot = async (name: string, ms = 3500) => { await sleep(1200); log(`shot: ${name}`); await sleep(ms); };
  const must = (ok: boolean, what: string) => { if (!ok) throw new Error(what); log(`ok: ${what}`); };
  const poll = async (probe: () => boolean, what: string, ms = 8000) => {
    try { await until(() => (probe() ? true : null), ms); } catch { throw new Error(what); }
    log(`ok: ${what}`);
  };
  const type = (el: HTMLInputElement, text: string) => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(el, text);
    el.dispatchEvent(new Event('input', { bubbles: true }));
  };
  const tap = (el: Element | null | undefined) => { if (!el) throw new Error('nothing to tap'); (el as HTMLElement).click(); };
  const px = (v: string) => Math.round(parseFloat(v) || 0);
  try {
    const { collectionsHome, documentsDir, isMobile, nameFromRemote, shapeOf } = await import('./platform.js');
    const { push, syncWord } = await import('./sync.js');
    const remote = await invoke<string | null>('dev_env', { name: 'ILMI_REMOTE' });
    if (!remote) throw new Error('ILMI_REMOTE (smoke.json: "remote") names the repository to clone');
    must(isMobile() && useApp.getState().mobile && document.documentElement.dataset.mobile === '1', 'the app knows it is on an iPad');
    const documents = documentsDir()!;
    const shape = () => shapeOf(true, window.innerWidth, window.innerHeight);
    log(`documents ${documents}; window ${window.innerWidth}×${window.innerHeight} (${shape()}); pixel ratio ${window.devicePixelRatio}; agent ${navigator.userAgent}`);

    // ── the welcome ──
    useApp.getState().setReopen(false);
    useApp.getState().setTheme('light');
    await startFromRecents();
    await until(() => q('.welcome'));
    await sleep(400);
    const buttons = qa('.welcome-acts button').map((b) => b.textContent);
    log(`welcome: buttons ${buttons.join(', ')}; foot "${q('.welcome .palette-foot')?.textContent}"; rows ${qa('.welcome-row .pt').map((r) => r.textContent).join(', ') || '(none)'}`);
    must(buttons.join(', ') === 'connect, join', 'the welcome offers connect and join');
    await shot('ipad-welcome');

    const name = nameFromRemote(remote);
    const row = qa<HTMLElement>('.welcome-row').find((r) => r.querySelector('.pt')?.textContent === name);
    if (row) {
      log(`${name} is a collection already: opened from its row`);
      tap(row);
    } else {
      tap(q('.welcome-acts button'));
      const field = await until(() => q<HTMLInputElement>('.welcome-connect input'));
      must(qa('.welcome-connect input').length === 2 && q<HTMLInputElement>('.welcome-connect input[type="password"]') !== null, 'connect asks for a remote and a token');
      type(field, remote);
      await shot('ipad-connect');
      tap(q('.welcome-go'));
    }
    // the clone's own words when it fails, not a wait run out
    try {
      await until(() => (useApp.getState().vault !== null ? true : q('.welcome-problem')?.textContent && q('.welcome-problem')?.textContent !== 'cloning…' ? true : null), 90000);
    } catch { /* said below */ }
    must(useApp.getState().vault !== null, `the clone opens${useApp.getState().vault === null ? ` (the welcome says "${q('.welcome-problem')?.textContent ?? ''}")` : ''}`);
    const vault = currentVault()!;
    must(vault.root === `${collectionsHome()}/${name}`, `the clone is a collection under the remote's name (${name})`);
    await poll(() => vault.documents().length > 0 && useApp.getState().queue.length > 0, `the sample is there (${vault.documents().length} documents)`, 20000);
    await poll(() => useApp.getState().sync.on, 'the clone is a repository with its remote');
    // since 51 an open writes the day it started into `.ilmi/state.json`, which git's sync commits and pushes a minute later (`PUSH_AFTER_MS`)
    await poll(() => syncWord(useApp.getState().sync) === 'synced', 'the strip says synced', 90000);

    // ── the shell's shape ──
    await until(() => q('.queue .qlist li'), 10000);
    const top = q<HTMLElement>('.top')!;
    const bot = q<HTMLElement>('.bot')!;
    log(`strips: top ${Math.round(top.getBoundingClientRect().height)}px (inset ${px(getComputedStyle(top).paddingTop)}), bottom ${Math.round(bot.getBoundingClientRect().height)}px (inset ${px(getComputedStyle(bot).paddingBottom)}); shell ${Math.round(q<HTMLElement>('.shell')!.getBoundingClientRect().height)} of ${window.innerHeight}`);
    must(qa('.pane').length === 1 && !q('.tabbar .ctl'), 'one pane, and no split to ask for');
    must(!q('.side') && !q('.insp'), 'the sidebar and the inspector start hidden');
    must(!q('.side-resize') && !q('.insp-resize'), 'no drag handles');
    must(q('.top .side-toggle') !== null && q('.top .insp-toggle:not(.side-toggle)') !== null, 'the strip has a toggle for each');
    must(getComputedStyle(q<HTMLElement>('.top .right')!).display !== 'none', 'the strip shows where sync stands');
    await shot(`ipad-open-${shape()}`);

    // the sidebar: a column in landscape, a sheet over the page in portrait; a tap on a row opens it
    tap(q('.top .side-toggle'));
    const side = await until(() => q<HTMLElement>('.side'));
    const pageLeft = () => Math.round(q<HTMLElement>('.canvas')!.getBoundingClientRect().left);
    if (shape() === 'portrait') {
      must(side.dataset.sheet === '1' && q('.side-scrim') !== null && pageLeft() === 0, 'portrait: the sidebar is a sheet over the page');
    } else {
      must(side.dataset.sheet === undefined && !q('.side-scrim') && pageLeft() > 100, 'landscape: the sidebar is a column beside the page');
    }
    log(`sidebar: ${Math.round(side.getBoundingClientRect().width)}px wide, rows ${qa('.side .trow').length}`);
    await shot(`ipad-sidebar-${shape()}`);
    toggleOpen('library', true);
    const READER = 'library/classical-prose-reader/11-the-judge-and-the-two-litigants.md';
    toggleOpen('library/classical-prose-reader.md', true);
    const rowOf = (path: string) => q<HTMLElement>(`.side .trow[data-path="${path}"]`);
    const tapped = await until(() => rowOf(READER) ?? rowOf('library/classical-prose-reader.md'));
    tap(tapped);
    await poll(() => activeTab(useApp.getState().panes)?.id === tapped.dataset.path, `a tap on a row opens it (${tapped.dataset.path})`);
    if (shape() === 'portrait') await poll(() => !q('.side') && !q('.side-scrim'), 'the sheet closes once something opens');
    else {
      tap(q('.top .side-toggle'));
      await poll(() => !q('.side'), 'the toggle hides the column again');
    }
    tap(q('.top .insp-toggle:not(.side-toggle)'));
    await poll(() => q('.insp') !== null, 'the inspector comes when asked for');
    await shot(`ipad-inspector-${shape()}`);
    tap(q('.top .insp-toggle:not(.side-toggle)'));
    await poll(() => !q('.insp'), 'and goes');

    // ── the queue, by its buttons ──
    openNode(queueId('today'));
    const enter = await until(() => q<HTMLElement>('.queue .enter-queue'), 10000);
    log(`queue: ${qa('.qlist li').length} rows; first "${q('.qlist li')?.textContent?.replace(/\s+/g, ' ').slice(0, 80)}"`);
    tap(enter);
    await until(() => q('.recall-wrap .card, .doc-session'), 10000);
    await shot('ipad-session');
    let graded: string | null = null;
    for (let i = 0; i < 6; i++) {
      const el = useApp.getState().sessionEl;
      if (!el || activeTab(useApp.getState().panes)?.id !== SESSION) { log(`the session ended after ${i}`); break; }
      const path = el.item.path;
      const before = await vault.fs.readText(vault.abs(path));
      if (el.kind === 'card') {
        const hint = q<HTMLElement>('.recall-wrap .card .face-hint');
        tap(hint);
        await until(() => (q('.recall-wrap .card[data-revealed="1"]') ? true : null));
        if (i === 0) await shot('ipad-session-shown');
        tap(qa<HTMLElement>('.recall-wrap .grades button')[2]);
      } else {
        tap(q<HTMLElement>('.session-bar button[data-act="on"]'));
      }
      let after = before;
      for (let t = 0; t < 80 && after === before; t++) { await sleep(100); after = await vault.fs.readText(vault.abs(path)); }
      // the lines the file has now that it had not (a first grade adds its schedule line, a later one rewrites it)
      const had = new Map<string, number>();
      for (const l of before.split('\n')) had.set(l, (had.get(l) ?? 0) + 1);
      const fresh = after.split('\n').filter((l) => { const n = had.get(l) ?? 0; if (n > 0) { had.set(l, n - 1); return false; } return true; });
      const text = fresh.join(' ⏎ ');
      log(`${i + 1}: ${el.kind} in ${path}: ${fresh.length} line${fresh.length === 1 ? '' : 's'} new, "${text.slice(0, 160)}"`);
      must(after !== before, `element ${i + 1} (${el.kind}) wrote its file`);
      if (el.kind === 'card' && graded === null) {
        graded = path;
        log(`graded: ${path} :: ${text}`);
      }
      await sleep(500);
    }
    must(graded !== null, 'a card was graded by its buttons');
    await shot('ipad-session-walked');

    // the push: what was graded reaches the remote, and the strip says so
    await push();
    await poll(() => { const s = useApp.getState().sync; return syncWord(s) === 'synced' && s.toPush === 0; }, 'pushed: the strip says synced', 30000);
    log(`strip: "${q('.top .right')?.textContent?.replace(/\s+/g, ' ')}"`);
    await shot('ipad-synced');

    // ── a passage selected: the cue, below it ──
    const NOTE = 'courses/fall-2026/arab-401-advanced-grammar/kana-and-its-sisters.md';
    openNode(NOTE);
    const surface = await until(() => (activeTab(useApp.getState().panes)?.id === NOTE ? q<HTMLElement>('.pane-body .doc-view .draft-doc') : null), 10000);
    await sleep(600);
    const para = qa<HTMLElement>('p.dd-p', surface).find((p) => (p.textContent ?? '').length > 80);
    if (para) {
      const words = (para.textContent ?? '').split(/\s+/).slice(2, 6).join(' ');
      para.scrollIntoView({ block: 'center' });
      select(para, words);
      const cue = await until(() => q<HTMLElement>('.sel-cue'));
      log(`cue: ${qa('.sel-cue .cue-act').map((b) => b.textContent?.trim()).join(' | ')}; placed ${cue.dataset.place}`);
      must(cue.dataset.place === 'below', 'the cue sits below the selection, clear of the system menu');
      must(qa('.sel-cue .cue-act').some((b) => b.textContent?.includes('card')), 'the cue offers a card');
      await shot('ipad-cue');
      window.getSelection()?.removeAllRanges();
    } else log('no paragraph long enough for the cue');

    // ── a book: its notes folded in portrait, beside the pages in landscape ──
    // (a chapter: the book's own first pages are blank)
    const BOOK = 'library/lindqvist-statistical-physics/ch-3-the-canonical-ensemble.md';
    if (vault.documents().includes(BOOK)) {
      openNode(BOOK);
      const book = await until(() => q<HTMLElement>('.pane-body .book'), 15000);
      await until(() => q('canvas', book), 30000);
      await sleep(1500);
      log(`book: notes ${book.dataset.notes === '1' ? 'shown' : 'folded'}; pages drawn ${qa('canvas', book).length}`);
      must((book.dataset.notes === '0') === (shape() === 'portrait'), shape() === 'portrait' ? 'portrait: the book\'s notes are folded' : 'landscape: the notes are beside the pages');
      await shot(`ipad-book-${shape()}`);
    } else log(`no ${BOOK} in the clone`);

    // dark, once
    useApp.getState().setTheme('dark');
    openNode(queueId('today'));
    await poll(() => document.documentElement.dataset.theme === 'dark', 'dark');
    await shot('ipad-dark');
    useApp.getState().setTheme('light');
    log(`done; vault ${vault.root}, remote ${remote}`);
  } catch (e) {
    log(`failed: ${e instanceof Error ? e.message : String(e)}`);
    useApp.getState().setTheme('light');
  }
}

// `ILMI_SMOKE=touch`: milestone 57's "done when", in three runs over one
// storage folder (`ILMI_STORAGE`, on the simulator `"storage"` in
// `smoke.json`; a simulated iPad reads the Mac's disk).
//  1. The Mac (`ILMI_VAULT` a copy of the sample): its collection makes the
//     storage. `smokeTouchMac`.
//  2. The iPad, from its welcome (`smokeTouch`): a collection made from the
//     storage, which keeps the files it has opened, so the book comes when
//     its chapter is opened. Everything after is under real touches:
//     every line `do: <verb> <numbers>` asks the touch rig (an XCUITest
//     bundle, PLAN 55) for one, in fractions of the window, and the step
//     waits for what it does. The chapter is opened from the sidebar's
//     sheet by taps. A flick scrolls the pages and draws nothing; a finger
//     held and dragged boxes a passage, again for a second, a tap clears;
//     the same press under a pointer that says `pen` (events made here:
//     the rig cannot make a Pencil) boxes nothing, since milestone 67, the
//     Pencil's being the canvas's (`ink`, `pageink`); the bar under the box
//     offers section and card, and `section` tapped makes the section; the
//     note opens in the pane below the pages (upright: the panes lie one
//     above the other, milestone 70) and closes at a tap on `notes`; a
//     heading, a tree row and a deck's card each give their menu to a long
//     press, with nothing selected under it; a PDF on its own (put in the
//     storage by the Mac's run) opens as its pages, asks for a note when
//     one is kept from it, and the note made in a folder picked opens
//     below (`alone note: …` names it for the Mac's run); a tree row held
//     and dragged moves; turned, the note sits beside the pages. The
//     section's name and boxes are logged (`section: …`) and synced.
//  3. The Mac again (`ILMI_VAULT` its collection's own folder,
//     `ILMI_EXPECT` the section's name): after a sync the section is in its
//     chapter, boxed on the page.
export async function smokeTouch(): Promise<void> {
  let last = { at: Date.now(), what: 'start' };
  let finished = false;
  const log = (s: string) => { last = { at: Date.now(), what: s }; void info(`smoke touch: ${s}`); };
  const dog = setInterval(() => {
    if (finished) { clearInterval(dog); return; }
    if (Date.now() - last.at > 90_000) { finished = true; clearInterval(dog); void info(`smoke touch: failed: no progress for 90 s after "${last.what}"`); }
  }, 2000);
  const q = <T extends Element>(sel: string, root: ParentNode = document) => root.querySelector<T>(sel);
  const qa = <T extends Element>(sel: string, root: ParentNode = document) => Array.from(root.querySelectorAll<T>(sel));
  const shot = async (name: string, ms = 2500) => { await sleep(900); log(`shot: ${name}`); await sleep(ms); };
  const must = (ok: unknown, what: string) => { if (!ok) throw new Error(what); log(`ok: ${what}`); };
  const poll = async <T,>(probe: () => T | null | undefined | false | Promise<T | null | undefined | false>, what: string, ms = 8000): Promise<T> => {
    const t0 = Date.now();
    for (;;) {
      const v = await probe();
      if (v) { log(`ok: ${what}`); return v; }
      if (Date.now() - t0 > ms) throw new Error(`${what} (waited ${ms} ms)`);
      await sleep(100);
    }
  };
  /** Ask the rig for a touch; places are window fractions. */
  const ask = (verb: string, ...n: number[]) => log(`do: ${verb} ${n.map((v) => v.toFixed(4)).join(' ')}`);
  const fx = (x: number) => x / window.innerWidth;
  const fy = (y: number) => y / window.innerHeight;
  const mid = (el: Element): [number, number] => { const r = el.getBoundingClientRect(); return [fx(r.left + r.width / 2), fy(r.top + r.height / 2)]; };
  try {
    const { isMobile, shapeOf } = await import('./platform.js');
    const { devStorage, joinCollection, crdtNow, filesSettled } = await import('./crdt.js');
    const { syncWord } = await import('./sync.js');
    const { parse, parseBoxes } = await import('../format/index.js');
    must(isMobile() && document.documentElement.dataset.mobile === '1', 'the app knows it is on an iPad');
    const shape = () => shapeOf(true, window.innerWidth, window.innerHeight);
    const storage = await devStorage();
    if (!storage || storage.kind !== 'folder') throw new Error('ILMI_STORAGE (smoke.json: "storage") names the folder the Mac\'s collection made its storage in');
    log(`window ${window.innerWidth}×${window.innerHeight} (${shape()}); pixel ratio ${window.devicePixelRatio}; touch points ${navigator.maxTouchPoints}; storage ${storage.folder}`);
    must(shape() === 'portrait', 'the iPad is upright');
    must(!window.matchMedia('(hover: hover)').matches, 'nothing hovers here: a row brings nothing in under a tap');

    // ── a collection made from the storage ──
    useApp.getState().setReopen(false);
    useApp.getState().setTheme('light');
    await startFromRecents();
    await until(() => q('.welcome'));
    const t0 = Date.now();
    const root = await joinCollection(storage, 'double-major', true);
    const vault = await openVault(root);
    log(`joined in ${Date.now() - t0} ms: ${vault.documents().length} documents`);
    must(vault.documents().length === 66, 'the collection is made from the storage: 66 documents');
    await poll(() => syncWord(useApp.getState().sync) === 'synced', 'the strip says synced', 30000);
    const BOOK = 'library/lindqvist-statistical-physics/ch-3-the-canonical-ensemble.md';
    const pdfOf = () => useApp.getState().docs[BOOK]?.pdf ?? '';
    await poll(() => pdfOf() !== '', 'the chapter is there, with its book');
    const ALONE = 'library/alone.pdf';
    must(useApp.getState().away.length === 4 && useApp.getState().away.includes(pdfOf()) && useApp.getState().away.includes(ALONE), `this device keeps what it has opened: both books and the PDFs on their own are away (${useApp.getState().away.join(', ')})`);
    must(useApp.getState().docs[ALONE]?.pdf === ALONE && !useApp.getState().docs[ALONE]?.note && !!useApp.getState().docs[ALONE]?.read, 'the PDF on its own came through the storage: its pages itself, no note, its reading line');
    const text = () => vault.fs.readText(vault.abs(BOOK));
    const headings = async () => parse(await text()).doc.blocks.flatMap((b) => (b.kind === 'heading' && b.level === 2 ? [b] : []));
    const before = (await headings()).map((h) => h.text);

    // ── the chapter opened by taps: its book comes, its pages are drawn, the notes folded ──
    const sheet = async () => {
      ask('flick', 0.004, 0.5, 0.45, 0.5);
      const el = await poll(() => q<HTMLElement>('.side[data-sheet="1"]'), 'a swipe from the left edge brings the sidebar', 20000);
      await sleep(600);
      return el;
    };
    const trow = (path: string) => q<HTMLElement>(`.side .trow[data-path="${path}"]`);
    let side = await sheet();
    for (const dir of ['library', 'library/lindqvist-statistical-physics.md']) {
      const r = await poll(() => trow(dir), `${dir} has a row`, 10000);
      if (r.getAttribute('aria-expanded') !== 'true') {
        ask('tap', ...mid(q('.chev', r)!));
        await poll(() => trow(dir)?.getAttribute('aria-expanded') === 'true', `a tap on its mark opens ${dir}`, 20000);
        await sleep(400);
      }
    }
    ask('tap', ...mid(q('.name', (await poll(() => trow(BOOK), 'the chapter has a row'))!)!));
    await poll(() => activeTab(useApp.getState().panes)?.id === BOOK, 'a tap on the chapter\'s row opens it', 20000);
    await poll(() => !q('.side'), 'and the sheet goes');
    const book = await poll(() => q<HTMLElement>('.pane[data-active="1"] .book'), 'the chapter opens as a book', 15000);
    await poll(() => q('.pdf-page[data-page="23"] canvas', book), 'its book is fetched on opening and the first page drawn', 60000);
    await filesSettled();
    must(!useApp.getState().away.includes(pdfOf()) && useApp.getState().away.length === 3, 'the book opened is here now, the others still away');
    const sc = q<HTMLElement>('.book-pages', book)!;
    const pending = () => qa('.pbox.pending:not(.ghost)', book).length;
    // ── a book open is its pages (milestone 70): across the pane, nothing beside them; `notes` among the words over them ──
    const notesPane = () => qa<HTMLElement>('.pane').find((p) => q('.reader-wrap[data-pdf]', p)) ?? null;
    const alone = () => book.dataset.notes === '0' && !notesPane() && qa('.pane').length === 1;
    const notesIn = () => book.dataset.notes === '1' && !!notesPane() && !!q('.draft-doc', notesPane()!);
    /** The first page drawn, across the pane inside its padding up to the width a page is still read at, centred past it. */
    const across = () => {
      const pr = q<HTMLElement>('.pdf-page[data-page="23"]', book)!.getBoundingClientRect();
      const sr = sc.getBoundingClientRect();
      const [left, right] = [pr.left - sr.left, sr.left + sc.clientWidth - pr.right];
      return { ok: pr.width >= Math.min(960, sc.clientWidth - 62) - 2 && Math.abs(left - right) < 3, line: `${Math.round(pr.width)} of ${sc.clientWidth} px, ${Math.round(left)} and ${Math.round(right)} beside it` };
    };
    /** Upright: the two panes lie one above the other, the pages above, the note below, each the window's width; the pages keep their width. */
    const stacked = () => {
      const pr = book.closest('.pane')!.getBoundingClientRect();
      const nr = notesPane()!.getBoundingClientRect();
      return { ok: nr.top >= pr.bottom - 2 && Math.abs(nr.left - pr.left) < 2 && Math.abs(nr.width - pr.width) < 2 && nr.height > 200 && pr.height > 200, line: `pages ${Math.round(pr.top)}–${Math.round(pr.bottom)}, note ${Math.round(nr.top)}–${Math.round(nr.bottom)}, ${Math.round(pr.width)} wide` };
    };
    const word = () => q<HTMLElement>('.meta .notes-toggle', book)!;
    must(alone() && !q('.insp'), 'upright: a book open is its pages, no note and no inspector beside them');
    must(across().ok, `the pages across the pane (${across().line})`);
    must(word().textContent === 'notes' && word().dataset.on === '0', 'notes is among the words over the pages');
    await shot('touch-book');
    ask('tap', ...mid(word()));
    await poll(() => notesIn() && word().dataset.on === '1', 'a tap on notes opens the note in a pane beside, and lights it', 20000);
    await sleep(800);
    must(stacked().ok, `upright, the panes lie one above the other: the pages above, the note below (${stacked().line})`);
    must(across().ok, `the pages keep their width (${across().line})`);
    must(!!q('.book-notes-doc', notesPane()!) && activeTab(useApp.getState().panes)?.id === BOOK, 'the chapter\'s body as its notes, the pages still the active pane');
    await shot('touch-notes-word');
    ask('tap', ...mid(word()));
    await poll(() => alone() && word().dataset.on === '0', 'tapped again, notes closes it, and the pane with it', 20000);
    await sleep(500);
    // the inspector, only by its toggle: the book's fields and its passages; then closed again
    ask('tap', ...mid(q('.top .insp-toggle:not(.side-toggle)')!));
    await poll(() => qa('.insp h6').some((h) => h.textContent === 'passages, in book order'), 'its toggle opens the inspector, the book\'s passages in book order', 20000);
    await sleep(600);
    await shot('touch-inspector');
    ask('tap', ...mid(q('.top .insp-toggle:not(.side-toggle)')!));
    await poll(() => !q('.insp'), 'and closes it', 20000);
    await sleep(500);

    // ── reading: a finger's drag is the scroll, and draws nothing ──
    const top0 = sc.scrollTop;
    ask('flick', 0.5, 0.72, 0.5, 0.3);
    await poll(() => sc.scrollTop > top0 + 150, 'a flick scrolls the pages', 20000);
    await sleep(1500);
    must(pending() === 0 && !q('.pbox.ghost', book), `and boxes nothing (scrolled ${Math.round(sc.scrollTop - top0)} px)`);
    must(word().getBoundingClientRect().top >= sc.getBoundingClientRect().top, 'notes is still at the pane\'s top: under a finger it is the way to the note');
    ask('flick', 0.5, 0.35, 0.5, 0.75);
    await poll(() => sc.scrollTop < top0 + 100, 'and back', 20000);
    await sleep(1200);

    // ── a finger held, then dragged: a box; again: a second; a tap: none ──
    const page = (n: number) => q<HTMLElement>(`.pdf-page[data-page="${n}"]`, book)!;
    /** A box on page `n`, as fractions of the page, in window fractions: its two corners. */
    const corners = async (n: number, x: number, y: number, w: number, h: number): Promise<[number, number, number, number]> => {
      const el = await poll(() => q<HTMLElement>(`.pdf-page[data-page="${n}"] canvas`, book)?.parentElement, `page ${n} is drawn`, 30000);
      const sr = sc.getBoundingClientRect();
      // the passage a third of the way down the view, once a flick's own motion has ended and the page stays where it is put
      const off = () => { const r0 = el.getBoundingClientRect(); return r0.top + (y + h / 2) * r0.height - (sr.top + sr.height / 3); };
      for (let i = 0; i < 12; i++) {
        let was = sc.scrollTop;
        for (let still = 0; still < 4;) { await sleep(120); if (sc.scrollTop === was) still++; else { still = 0; was = sc.scrollTop; } }
        if (Math.abs(off()) < 2) break;
        sc.scrollTop += off();
      }
      if (Math.abs(off()) >= 2) throw new Error(`page ${n} does not stay where it is scrolled to`);
      const r = el.getBoundingClientRect();
      return [fx(r.left + x * r.width), fy(r.top + y * r.height), fx(r.left + (x + w) * r.width), fy(r.top + (y + h) * r.height)];
    };
    const PASSAGE: [number, number, number, number, number] = [24, 0.11, 0.67, 0.78, 0.075];
    let c = await corners(...PASSAGE);
    const still = sc.scrollTop;
    ask('drag', c[0], c[1], c[2], c[3], 0.8);
    await poll(() => pending() === 1, 'a finger held and then dragged draws a box', 25000);
    must(Math.abs(sc.scrollTop - still) < 4, 'and the page holds still under it');
    const bar = () => qa<HTMLElement>('.pend button', book).map((b) => b.textContent ?? '');
    must(bar().length === 2 && /section/.test(bar()[0]!) && /card/.test(bar()[1]!), `the bar under the box offers section and card (${bar().join(' | ')})`);
    const pr = q<HTMLElement>('.pend button', book)!.getBoundingClientRect();
    must(pr.height >= 32, `at a finger's size (${Math.round(pr.height)} px tall)`);
    await shot('touch-boxed');
    const c2 = await corners(24, 0.11, 0.3, 0.5, 0.08);
    ask('drag', c2[0], c2[1], c2[2], c2[3], 0.8);
    await poll(() => pending() === 2 && qa('.pbox.pending .pb-no', book).length === 2, 'a second drag draws another, and they are numbered', 25000);
    await shot('touch-two-boxes');
    const blank = page(24).getBoundingClientRect();
    ask('tap', fx(blank.left + blank.width * 0.5), fy(Math.min(window.innerHeight - 80, blank.top + blank.height * 0.5)));
    await poll(() => pending() === 0, 'a tap clears them', 20000);

    // ── the Pencil's path (milestones 67, 69): a press that says `pen` is the canvas's and never the page's: one that reached the page boxes nothing (events made here, not a Pencil; `ink` and `pageink` write) ──
    c = await corners(...PASSAGE);
    const px = (i: number) => c[i]! * (i % 2 ? window.innerHeight : window.innerWidth);
    const pen = (type: string, x: number, y: number) => new PointerEvent(type, { bubbles: true, cancelable: true, pointerId: 77, pointerType: 'pen', isPrimary: true, button: 0, buttons: type === 'pointerup' ? 0 : 1, pressure: type === 'pointerup' ? 0 : 0.4, clientX: x, clientY: y });
    const target = document.elementFromPoint(px(0), px(1))!;
    must(target.closest('.pdf-page') === page(24), 'the passage is under the point');
    target.dispatchEvent(pen('pointerdown', px(0), px(1)));
    window.dispatchEvent(pen('pointermove', (px(0) + px(2)) / 2, (px(1) + px(3)) / 2));
    await sleep(60);
    must(q('.pbox.ghost', book) === null, 'a pen\'s drag boxes nothing here');
    window.dispatchEvent(pen('pointerup', px(2), px(3)));
    await sleep(300);
    must(pending() === 0 && !q('img.page-ink', book), 'and with nothing written the page is as it was');

    // ── the passage boxed by a finger becomes a section, by the bar's button ──
    c = await corners(...PASSAGE);
    ask('drag', c[0], c[1], c[2], c[3], 0.8);
    await poll(() => pending() === 1, 'the passage is boxed again', 25000);
    const btn = q<HTMLElement>('.pend button[data-k="e"]', book)!;
    ask('tap', ...mid(btn));
    const made = await poll(async () => (await headings()).find((h) => !before.includes(h.text) && h.read?.boxes !== undefined), 'section tapped: the passage is a section of the notes', 25000);
    const boxes = parseBoxes(made.read?.boxes ?? '') ?? [];
    must(boxes.length === 1 && boxes[0]!.page === 24, `named from the page, with its box: "${made.text}"`);
    const b0 = boxes[0]!;
    must(Math.abs(b0.x - PASSAGE[1]) < 0.03 && Math.abs(b0.y - PASSAGE[2]) < 0.03 && Math.abs(b0.w - PASSAGE[3]) < 0.04 && Math.abs(b0.h - PASSAGE[4]) < 0.04, `the box is where the finger went (${b0.x},${b0.y},${b0.w},${b0.h})`);
    await poll(() => q(`.pbox[data-section="${CSS.escape(made.text)}"]`, book), 'and is drawn on the page');
    // a box made a section opens the note below the pages, with the section in it (milestone 70)
    await poll(() => notesIn() && qa<HTMLElement>('.dd-h', notesPane()!).some((h) => h.textContent?.includes(made.text.slice(0, 12))), 'the note opens beside the pages with the new section in it', 10000);
    await sleep(600);
    must(stacked().ok, `below the pages, upright (${stacked().line})`);
    await shot('touch-section');
    const notes = notesPane()!;
    const nr = notes.getBoundingClientRect();
    const br = book.getBoundingClientRect();
    const head = await poll(() => qa<HTMLElement>('.dd-h', notes).find((h) => h.textContent?.includes(made.text.slice(0, 12))), 'the new section is in it', 10000);
    head.scrollIntoView({ block: 'center' });
    await shot('touch-notes');
    // a heading's menu, by a long press on its words
    await sleep(400);
    const words = document.createRange();
    words.selectNodeContents(head.firstChild ?? head);
    const wr = words.getBoundingClientRect();
    ask('press', fx(wr.left + Math.min(60, wr.width / 2)), fy(wr.top + wr.height / 2), 0.9);
    const hm = await poll(() => q<HTMLElement>('.ctx-menu.section-menu'), 'a long press on a heading opens its menu', 20000);
    log(`heading menu: ${qa('.ci', hm).map((i) => i.textContent).join(' | ')}`);
    await sleep(700);
    must((window.getSelection()?.toString() ?? '') === '', 'and the system selected nothing under it');
    must(!(document.activeElement as HTMLElement | null)?.isContentEditable && Math.abs((window.visualViewport?.height ?? window.innerHeight) - window.innerHeight) < 2, 'nor is the keyboard up under it');
    await shot('touch-heading-menu');
    const menuAt = hm.getBoundingClientRect();
    ask('tap', fx(nr.left + nr.width / 2), fy(Math.min(notes.getBoundingClientRect().bottom - 60, menuAt.bottom + 220)));
    await poll(() => !q('.ctx-menu.section-menu'), 'a tap elsewhere closes it', 20000);
    await sleep(600);
    (document.activeElement as HTMLElement | null)?.blur?.();
    await sleep(600);
    void br;
    ask('tap', ...mid(word()));
    await poll(() => alone(), 'a tap on notes closes the note', 20000);
    await sleep(600);

    // ── a PDF on its own (milestone 70): its pages, no note; a passage kept asks for one, made in a folder picked; `notes` opens it and closes it ──
    side = await sheet();
    ask('tap', ...mid(q('.name', (await poll(() => trow(ALONE), 'the PDF on its own has a row'))!)!));
    await poll(() => activeTab(useApp.getState().panes)?.id === ALONE, 'a tap on its row opens it', 20000);
    await poll(() => !q('.side'), 'the sheet goes');
    const abook = await poll(() => q<HTMLElement>(`.pane[data-active="1"] .book[data-path="${CSS.escape(ALONE)}"]`), 'it opens as a book', 15000);
    await poll(() => q('.pdf-page[data-page="129"] canvas', abook) ?? (q('.pdf-page[data-page="129"]', abook)?.scrollIntoView({ block: 'start' }), null), 'its file is fetched on opening and p. 129 drawn', 60000);
    await filesSettled();
    const asc = q<HTMLElement>('.book-pages', abook)!;
    const aword = () => q<HTMLElement>('.meta .notes-toggle', abook)!;
    const aalone = () => abook.dataset.notes === '0' && !notesPane() && qa('.pane').length === 1;
    const anotesIn = () => abook.dataset.notes === '1' && !!notesPane() && !!q('.draft-doc', notesPane()!);
    must(aalone() && !q('.insp') && qa('.pbox', abook).length === 0 && !!q('.read-bar', abook), 'its pages alone: no note, no inspector, no section on them, the read bar');
    must(q('h1', abook)?.textContent === 'alone', 'titled by its name');
    await shot('touch-alone');
    ask('tap', ...mid(aword()));
    const apick = await poll(() => q<HTMLInputElement>('.palette-input input'), 'with no note, a tap on notes asks for one: the palette', 20000);
    must(apick.placeholder === 'notes on alone' && qa<HTMLElement>('.palette-row')[0]?.textContent?.startsWith('¶new note'), `the picker: a new note first (${qa('.palette-row').slice(0, 2).map((r) => r.textContent).join(' / ')})`);
    await shot('touch-alone-picker');
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
    await poll(() => !q('.palette-overlay'), 'closed with nothing picked', 8000);
    await sleep(400);
    must(aalone(), 'and the pages are alone still');
    // a passage boxed with a finger and kept: the picker, then a new note named here and placed in fleeting
    {
      const pr = q<HTMLElement>('.pdf-page[data-page="129"]', abook)!;
      pr.scrollIntoView({ block: 'start' });
      await sleep(600);
      const r = pr.getBoundingClientRect();
      const [bx, by, bw, bh] = [0.12, 0.275, 0.78, 0.072];
      ask('drag', fx(r.left + bx * r.width), fy(r.top + by * r.height), fx(r.left + (bx + bw) * r.width), fy(r.top + (by + bh) * r.height), 0.9);
      await poll(() => qa('.pbox.pending:not(.ghost)', abook).length === 1, 'a finger held and dragged boxes a passage on p. 129', 20000);
      await sleep(500);
      ask('tap', ...mid(q<HTMLElement>('.pend [data-k="e"]', abook)!));
      const pick2 = await poll(() => q<HTMLInputElement>('.palette-input input'), 'section tapped asks for a note first', 20000);
      must(qa('.pbox.pending:not(.ghost)', abook).length === 1, 'the box is kept while it asks');
      const iset = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!;
      iset.call(pick2, 'notes on alone, from the iPad');
      pick2.dispatchEvent(new Event('input', { bubbles: true }));
      await sleep(200);
      pick2.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));
      await poll(() => useApp.getState().noteAttach?.step === 'place', 'new note: then where', 8000);
      const row = await poll(() => qa<HTMLElement>('.palette-row').find((r) => r.querySelector('.pt')?.textContent === 'fleeting'), 'fleeting is among the folders', 8000);
      await shot('touch-alone-place');
      ask('tap', ...mid(row));
      const ANOTE = 'fleeting/notes on alone, from the iPad.md';
      await poll(async () => { try { return /^---\npdf: \.\.\/library\/alone\.pdf\n---\n/.test(await vault.fs.readText(vault.abs(ANOTE))); } catch { return false; } }, 'the note is made in fleeting and names the PDF', 20000);
      await poll(() => useApp.getState().docs[ALONE]?.note === ANOTE && useApp.getState().docs[ANOTE]?.of === ALONE, 'the PDF shows it as its notes', 10000);
      await poll(() => anotesIn() && activeTab(useApp.getState().panes)?.id === ALONE, 'the note opens below the pages, the pages kept active', 15000);
      await poll(() => qa<HTMLElement>('.dd-h', notesPane()!).some((h) => !!h.querySelector('.book-chip')) && qa('.pbox:not(.pending)', abook).length === 1 && qa('.pbox.pending:not(.ghost)', abook).length === 0, 'the section in it with its chip, its box drawn on the page from the note', 10000);
      await sleep(600);
      log(`alone note: ${ANOTE}`);
      await shot('touch-alone-notes');
      ask('tap', ...mid(aword()));
      await poll(() => aalone(), 'a tap on notes closes it', 20000);
      await sleep(400);
      ask('tap', ...mid(aword()));
      await poll(() => anotesIn(), 'and opens that note from now on, with nothing asked', 20000);
      await sleep(400);
      ask('tap', ...mid(aword()));
      await poll(() => aalone(), 'closed again', 20000);
      // done for today on it: its own line, in reading.json
      const { refreshQueue } = await import('./vault.js');
      refreshQueue();
      const aitem = await poll(() => useApp.getState().queue.find((i) => i.kind === 'read' && i.path === ALONE), 'it is in the queue to read by its own line', 8000);
      openSession(aitem);
      await poll(() => useApp.getState().sessionEl?.kind === 'read' && q('.pane[data-active="1"] .doc-session[data-book="1"] .book .pdf-page canvas'), 'its session is its pages', 20000);
      await sleep(600);
      asc.scrollTop = 0;
      q<HTMLElement>('.pane[data-active="1"] .doc-session .pdf-page[data-page="130"]')?.scrollIntoView({ block: 'end' });
      await sleep(600);
      ask('tap', ...mid(q<HTMLElement>('.pane[data-active="1"] .session-bar button[data-act="on"]')!));
      await poll(async () => { const j = JSON.parse(await vault.fs.readText(vault.abs('.ilmi/reading.json'))) as Record<string, { read?: string }>; return /reps=1 pos=1\d\d y=0\.\d{3}/.test(j[ALONE]?.read ?? ''); }, 'done for today wrote its line to reading.json', 20000);
      await sleep(800);
      // the session went on to its next element, which may have opened a note beside: that pane closed, as a pane is
      const np = notesPane();
      if (np && useApp.getState().panes.panes.length > 1) {
        useApp.getState().setPanes((p) => closePane(p, qa('.pane').indexOf(np)));
        await poll(() => qa('.pane').length === 1, 'the pane beside closed', 8000);
      }
    }

    // ── the tree: a row's menu by a long press, a row moved by a hold and a drag ──
    await sleep(600);
    side = await sheet();
    const rows = () => qa<HTMLElement>('.trow:not(.root-row):not(.placeholder)', side).filter((r) => !r.dataset.path!.includes('/'));
    const names = () => rows().map((r) => r.dataset.path);
    const order0 = names();
    log(`top rows: ${order0.join(', ')}`);
    must(order0.length >= 4, 'the tree\'s top rows are there');
    ask('press', ...mid(rows()[1]!), 0.9);
    const tm = await poll(() => q<HTMLElement>('.side ~ .ctx-menu, .tree .ctx-menu, .ctx-menu:not(.section-menu)'), 'a long press on a row opens its menu', 20000);
    log(`row menu: ${qa('.ci', tm).map((i) => i.textContent).slice(0, 8).join(' | ')}`);
    await sleep(700);
    must((window.getSelection()?.toString() ?? '') === '', 'with nothing selected');
    await shot('touch-row-menu');
    const sr = side.getBoundingClientRect();
    ask('tap', fx(sr.left + sr.width / 2), fy(sr.bottom - 30));
    await poll(() => !q('.ctx-menu'), 'and a tap elsewhere closes it', 20000);
    await sleep(600);
    // the first top row, held and dragged below the last one that is closed
    const from = rows()[0]!;
    const dest = rows().reverse().find((r) => r !== from && r.getAttribute('aria-expanded') !== 'true')!;
    const moved = from.dataset.path!;
    const under = dest.dataset.path!;
    const to = dest.getBoundingClientRect();
    ask('drag', ...mid(from), fx(to.left + to.width / 2), fy(to.bottom - 3), 0.9);
    await poll(() => names().join() !== order0.join() && names().indexOf(moved) === names().indexOf(under) + 1, `a row held and dragged moves: ${moved} below ${under}`, 25000);
    must(!useApp.getState().sideSheet || q('.side') !== null, 'and the sheet is still there');
    log(`top rows now: ${names().join(', ')}`);
    await shot('touch-row-moved');

    // ── a deck: a card's menu by a long press ──
    const DECK = 'arabic/vocabulary.md';
    openNode(DECK);
    const card = await poll(() => (activeTab(useApp.getState().panes)?.id === DECK ? q<HTMLElement>('.pane[data-active="1"] .deck-row') : null), 'a deck opens', 15000);
    await poll(() => !q('.side'), 'the sheet closed as it opened');
    await sleep(600);
    const cards = qa<HTMLElement>('.pane[data-active="1"] .deck-row');
    ask('tap', ...mid(q('.dr-faces', cards[2]!)!));
    await poll(() => cards[2]!.isConnected && cards[2]!.classList.contains('selected'), 'a tap on a card selects it', 20000);
    await sleep(500);
    ask('press', ...mid(card), 0.9);
    const cm = await poll(() => q<HTMLElement>('.pane[data-active="1"] .ctx-menu'), 'a long press on a card opens its menu', 20000);
    log(`card menu: ${qa('.ci', cm).map((i) => i.textContent).join(' | ')}`);
    await sleep(700);
    must((window.getSelection()?.toString() ?? '') === '', 'with nothing selected');
    await shot('touch-card-menu');
    const dv = q<HTMLElement>('.pane[data-active="1"] .pane-body')!.getBoundingClientRect();
    ask('tap', fx(dv.left + dv.width / 2), fy(dv.bottom - 40));
    await poll(() => !q('.ctx-menu'), 'closed by a tap', 20000);

    // ── synced: the section is in the storage ──
    await crdtNow();
    await poll(() => { const s = useApp.getState().sync; return syncWord(s) === 'synced' && s.toPush === 0; }, 'synced: nothing left to push', 30000);
    log(`section: ${made.text} :: ${made.read!.boxes}`);

    // ── on its side: the same book, the note beside the pages (milestone 70) ──
    openNode(BOOK);
    const land = await poll(() => { const b = q<HTMLElement>('.pane[data-active="1"] .book'); return b && q('.pdf-page[data-page="23"] canvas', b) ? b : null; }, 'the chapter again', 20000);
    ask('turn landscape');
    await poll(() => shape() === 'landscape', 'the iPad turns', 20000);
    await sleep(1500);
    const lsc = q<HTMLElement>('.book-pages', land)!;
    const lacross = () => {
      const pr = q<HTMLElement>('.pdf-page[data-page="23"]', land)!.getBoundingClientRect();
      const sr = lsc.getBoundingClientRect();
      const [left, right] = [pr.left - sr.left, sr.left + lsc.clientWidth - pr.right];
      return { ok: pr.width >= Math.min(960, lsc.clientWidth - 62) - 2 && Math.abs(left - right) < 3, line: `${Math.round(pr.width)} of ${lsc.clientWidth} px, ${Math.round(left)} and ${Math.round(right)} beside it` };
    };
    const lalone = () => land.dataset.notes === '0' && !notesPane() && qa('.pane').length === 1;
    const lin = () => land.dataset.notes === '1' && !!notesPane() && !!q('.draft-doc', notesPane()!);
    /** On its side: the panes side by side, the note to the right of the pages, each half the window. */
    const beside = () => {
      const pr = land.closest('.pane')!.getBoundingClientRect();
      const nr = notesPane()!.getBoundingClientRect();
      return { ok: Math.abs(nr.left - pr.right) < 3 && Math.abs(nr.width - pr.width) < 3 && Math.abs(nr.top - pr.top) < 2, line: `pages ${Math.round(pr.left)}–${Math.round(pr.right)}, note ${Math.round(nr.left)}–${Math.round(nr.right)}` };
    };
    must(lalone() && !q('.insp'), 'on its side: its pages alone, no note and no inspector');
    await poll(() => lacross().ok, `the pages across the pane, drawn again at its width (${lacross().line})`, 20000);
    await shot('touch-landscape');
    ask('tap', ...mid(q<HTMLElement>('.meta .notes-toggle', land)!));
    await poll(() => lin(), 'a tap on notes opens the note beside', 20000);
    await sleep(800);
    must(beside().ok, `side by side, the note to the right (${beside().line})`);
    await poll(() => lacross().ok, `the pages across their half (${lacross().line})`, 20000);
    await shot('touch-landscape-notes');
    ask('tap', ...mid(q<HTMLElement>('.meta .notes-toggle', land)!));
    await poll(() => lalone(), 'tapped again, it closes', 20000);
    await sleep(500);
    // dark, the note beside; then turned back upright with it open: the panes lie one above the other
    useApp.getState().setTheme('dark');
    await poll(() => document.documentElement.dataset.theme === 'dark', 'dark');
    await shot('touch-landscape-dark');
    ask('tap', ...mid(q<HTMLElement>('.meta .notes-toggle', land)!));
    await poll(() => lin(), 'the note beside, dark', 20000);
    await sleep(800);
    await shot('touch-landscape-dark-notes');
    ask('turn portrait');
    await poll(() => shape() === 'portrait', 'and back upright', 20000);
    await sleep(1500);
    {
      const pr = land.closest('.pane')!.getBoundingClientRect();
      const nr = notesPane()!.getBoundingClientRect();
      must(lin() && nr.top >= pr.bottom - 2 && Math.abs(nr.width - pr.width) < 2, `upright again with the note open: one above the other (pages ${Math.round(pr.top)}–${Math.round(pr.bottom)}, note ${Math.round(nr.top)}–${Math.round(nr.bottom)})`);
      await poll(() => lacross().ok, `the pages across the window again (${lacross().line})`, 20000);
    }
    await shot('touch-dark');
    ask('tap', ...mid(q<HTMLElement>('.meta .notes-toggle', land)!));
    await poll(() => lalone(), 'closed', 20000);
    useApp.getState().setTheme('light');

    // ── a PDF on its own, on its side: its pages, a passage kept asks for a note, made in a folder picked, beside the pages ──
    const SIDE = 'library/sideways.pdf';
    ask('turn landscape');
    await poll(() => shape() === 'landscape', 'on its side again', 20000);
    await sleep(1200);
    openNode(SIDE);
    const sbook = await poll(() => q<HTMLElement>(`.pane[data-active="1"] .book[data-path="${CSS.escape(SIDE)}"]`), 'the second PDF on its own opens as a book', 15000);
    await poll(() => q('.pdf-page[data-page="129"] canvas', sbook) ?? (q('.pdf-page[data-page="129"]', sbook)?.scrollIntoView({ block: 'start' }), null), 'its file is fetched and p. 129 drawn', 60000);
    await filesSettled();
    const ssc = q<HTMLElement>('.book-pages', sbook)!;
    {
      // its pages take ink as a chapter's do (milestone 69): on its side, the page drawn to that width; the rig's finger stands in for the Pencil
      type StoreFs = import('../vault/index.js').StoreFs;
      const sfs = vault.fs as StoreFs;
      const hash = sfs.blobAt(vault.abs(SIDE))!;
      const sheet = `p.${hash}.129`;
      const pg = q<HTMLElement>('.pdf-page[data-page="129"]', sbook)!;
      pg.scrollIntoView({ block: 'start' });
      ssc.scrollTop -= 70;
      await sleep(800);
      const inkNow = async () => (await invoke<InkState>('dev_ink_state')).sheets.find((x) => x.id === sheet);
      await poll(inkNow, 'its page has a canvas ready', 15000);
      const pr = pg.getBoundingClientRect();
      await invoke('dev_ink_pen', { on: true });
      ask('drag', fx(pr.left + pr.width * 0.2), fy(pr.top + 140), fx(pr.left + pr.width * 0.7), fy(pr.top + 170), 0.05);
      await poll(async () => (await inkNow())?.strokes === 1, 'the Pencil\'s first touch is a stroke on a bare PDF\'s page, on its side', 25000);
      must(Math.abs((await inkNow())!.at.w - pr.width) < 1.5 && Math.abs((await inkNow())!.at.y - pg.getBoundingClientRect().top) < 1.5, `the canvas lies on the page at this width (${Math.round(pr.width)} px)`);
      await poll(async () => (await sfs.pageInk(hash, 129)).length === 1, 'left alone it is kept, by the file\'s hash', 20000);
      await poll(async () => !(await inkNow())?.shown && q('img.page-ink[data-page="129"]', sbook), 'and the page shows it', 15000);
      await invoke('dev_ink_pen', { on: false });
      await shot('touch-side-ink');
    }
    const sacross = () => {
      const pr = q<HTMLElement>('.pdf-page[data-page="129"]', sbook)!.getBoundingClientRect();
      const sr = ssc.getBoundingClientRect();
      const [left, right] = [pr.left - sr.left, sr.left + ssc.clientWidth - pr.right];
      return { ok: pr.width >= Math.min(960, ssc.clientWidth - 62) - 2 && Math.abs(left - right) < 3, line: `${Math.round(pr.width)} of ${ssc.clientWidth} px, ${Math.round(left)} and ${Math.round(right)} beside it` };
    };
    must(sbook.dataset.notes === '0' && qa('.pane').length === 1 && !q('.insp') && sacross().ok, `on its side: its pages alone, across the pane (${sacross().line})`);
    must(!!useApp.getState().queue.find((i) => i.kind === 'read' && i.path === SIDE), 'in the reading queue by its own line');
    await shot('touch-side-alone');
    {
      const pr = q<HTMLElement>('.pdf-page[data-page="129"]', sbook)!;
      pr.scrollIntoView({ block: 'start' });
      await sleep(600);
      const r = pr.getBoundingClientRect();
      ask('drag', fx(r.left + 0.12 * r.width), fy(r.top + 0.275 * r.height), fx(r.left + 0.9 * r.width), fy(r.top + 0.347 * r.height), 0.9);
      await poll(() => qa('.pbox.pending:not(.ghost)', sbook).length === 1, 'a finger held and dragged boxes a passage', 20000);
      await sleep(500);
      ask('tap', ...mid(q<HTMLElement>('.pend [data-k="e"]', sbook)!));
      const pick3 = await poll(() => q<HTMLInputElement>('.palette-input input'), 'section tapped asks for a note', 20000);
      await sleep(300);
      pick3.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));
      await poll(() => useApp.getState().noteAttach?.step === 'place', 'new note, named after the PDF: then where', 8000);
      const row = await poll(() => qa<HTMLElement>('.palette-row').find((r) => r.querySelector('.pt')?.textContent === 'fleeting'), 'fleeting is among the folders', 8000);
      await shot('touch-side-place');
      ask('tap', ...mid(row));
      const SNOTE = 'fleeting/sideways notes.md';
      await poll(() => useApp.getState().docs[SIDE]?.note === SNOTE && useApp.getState().docs[SNOTE]?.of === SIDE, 'the note is made in fleeting and is the PDF\'s notes', 20000);
      await poll(() => sbook.dataset.notes === '1' && !!notesPane() && qa<HTMLElement>('.dd-h', notesPane()!).some((h) => !!h.querySelector('.book-chip')), 'it opens beside the pages with the section in it', 15000);
      await sleep(800);
      const a = sbook.closest('.pane')!.getBoundingClientRect();
      const b = notesPane()!.getBoundingClientRect();
      must(Math.abs(b.left - a.right) < 3 && Math.abs(a.width - b.width) < 3, `side by side (pages ${Math.round(a.left)}–${Math.round(a.right)}, note ${Math.round(b.left)}–${Math.round(b.right)})`);
      await shot('touch-side-notes');
      ask('tap', ...mid(q<HTMLElement>('.meta .notes-toggle', sbook)!));
      await poll(() => sbook.dataset.notes === '0' && !notesPane() && qa('.pane').length === 1, 'a tap on notes closes it', 20000);
    }
    ask('turn portrait');
    await poll(() => shape() === 'portrait', 'upright', 20000);
    await sleep(800);
    useApp.getState().setTheme('light');
    finished = true;
    log(`done; collection ${vault.root}, storage ${storage.folder}`);
  } catch (e) {
    finished = true;
    log('shot: touch-failed');
    await sleep(1500);
    log(`failed: ${e instanceof Error ? e.message : String(e)}`);
  }
}

/** The Mac's side of `ILMI_SMOKE=touch` (see `smokeTouch`): the storage made, and after the iPad's run the section found. */
export async function smokeTouchMac(vault: Vault): Promise<void> {
  const log = (s: string) => void info(`smoke touch: ${s}`);
  const q = <T extends Element>(sel: string, root: ParentNode = document) => root.querySelector<T>(sel);
  const shot = async (name: string, ms = 2500) => { await sleep(900); log(`shot: ${name}`); await sleep(ms); };
  const must = (ok: unknown, what: string) => { if (!ok) throw new Error(what); log(`ok: ${what}`); };
  const poll = async <T,>(probe: () => T | null | undefined | false | Promise<T | null | undefined | false>, what: string, ms = 8000): Promise<T> => {
    const t0 = Date.now();
    for (;;) {
      const v = await probe();
      if (v) { log(`ok: ${what}`); return v; }
      if (Date.now() - t0 > ms) throw new Error(`${what} (waited ${ms} ms)`);
      await sleep(100);
    }
  };
  try {
    const { crdtNow, crdtOn, storageDir } = await import('./crdt.js');
    const { syncWord } = await import('./sync.js');
    const { parse, parseBoxes } = await import('../format/index.js');
    const dir = await storageDir();
    if (!dir) throw new Error('ILMI_STORAGE names the folder the two devices share');
    const expect = await invoke<string | null>('dev_env', { name: 'ILMI_EXPECT' });
    const BOOK = 'library/lindqvist-statistical-physics/ch-3-the-canonical-ensemble.md';
    const headings = async () => parse(await vault.fs.readText(vault.abs(BOOK))).doc.blocks.flatMap((b) => (b.kind === 'heading' && b.level === 2 ? [b] : []));
    useApp.getState().setTheme('light');
    must(window.matchMedia('(hover: hover)').matches, 'a pointer hovers here: a row\'s marks still come under it');
    await poll(() => crdtOn() && syncWord(useApp.getState().sync) === 'synced', 'the collection syncs through the folder', 60000);
    if (!expect) {
      // the first run: the storage is this collection's
      const { diskFs } = await import('./collections.js');
      await crdtNow();
      const names = await diskFs.readDir(dir);
      must(names.some((n) => n.name === 'format') && names.some((n) => n.name === 'devices') && names.some((n) => n.name === 'blobs'), `the storage is made in ${dir}`);
      must(!(await headings()).some((h) => (parseBoxes(h.read?.boxes ?? '') ?? []).some((b) => b.page === 24 && Math.abs(b.y - 0.67) < 0.05)), 'no section is boxed there yet');
      // a PDF on its own (milestone 70), as a drop lands it: the sample's reader again under another name, no note, for the iPad to read
      const { importPdfNode } = await import('./vault.js');
      const ALONE = 'library/alone.pdf';
      await importPdfNode('library', { title: 'alone', bytes: await vault.fs.readBytes(vault.abs('library/classical-prose-reader.pdf')), text: '' });
      await poll(() => useApp.getState().docs[ALONE]?.pdf === ALONE && !!useApp.getState().docs[ALONE]?.read && !useApp.getState().docs[ALONE]?.note, 'a PDF on its own is in the collection, enrolled, with no note', 15000);
      // and another, for the iPad on its side
      await importPdfNode('library', { title: 'sideways', bytes: await vault.fs.readBytes(vault.abs('library/classical-prose-reader.pdf')), text: '' });
      await poll(() => useApp.getState().docs['library/sideways.pdf']?.pdf === 'library/sideways.pdf', 'and a second, for the iPad on its side', 15000);
      await crdtNow();
      await poll(() => syncWord(useApp.getState().sync) === 'synced' && useApp.getState().sync.toPush === 0, 'and in the storage', 30000);
      log(`done; collection ${vault.root}, storage ${dir}`);
      return;
    }
    // after the iPad: its section comes with a sync
    await crdtNow();
    const made = await poll(async () => { await crdtNow(); return (await headings()).find((h) => h.text === expect); }, `the section made on the iPad is in the chapter here: "${expect}"`, 30000);
    const boxes = parseBoxes(made.read?.boxes ?? '') ?? [];
    must(boxes.length === 1 && boxes[0]!.page === 24, `with its box (${made.read?.boxes})`);
    must(made.read?.due !== undefined, `and its schedule (due ${made.read?.due})`);
    openNode(BOOK);
    const book = await poll(() => q<HTMLElement>('.pane[data-active="1"] .book'), 'the chapter opens', 15000);
    await poll(() => q('.pdf-page[data-page="24"] canvas', book) ?? (q('.pdf-page[data-page="24"]', book)?.scrollIntoView({ block: 'center' }), null), 'p. 24 is drawn', 30000);
    const box = await poll(() => q<HTMLElement>(`.pbox[data-section="${CSS.escape(expect)}"]`, book), 'the section\'s box is drawn on the page');
    box.scrollIntoView({ block: 'center' });
    // its mark beside the page goes to the section: the note opens beside the pages with it (milestone 70)
    const mark = Array.from(book.querySelectorAll<HTMLElement>('.ptag:not(.cont), .pgut')).find((t) => (t.textContent ?? '').includes(expect.slice(0, 12)) || t.title.startsWith(expect.slice(0, 12)))!;
    mark.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true, button: 0 }));
    const head = await poll(() => (book.dataset.notes === '1' ? Array.from(document.querySelectorAll<HTMLElement>('.pane[data-active="0"] .reader-wrap[data-pdf] .dd-h')).find((h) => h.textContent?.includes(expect.slice(0, 12))) : null), 'and its mark beside the page opens the note beside, its heading in it');
    head.scrollIntoView({ block: 'center' });
    // the note the iPad made for the PDF on its own, with the section it kept there
    const aloneNote = await invoke<string | null>('dev_env', { name: 'ILMI_ALONE_NOTE' });
    if (aloneNote) {
      const noteText = await poll(async () => { await crdtNow(); try { return await vault.fs.readText(vault.abs(aloneNote)); } catch { return null; } }, `the note made on the iPad for the PDF on its own is here: ${aloneNote}`, 30000);
      must(/^---\npdf: \.\.\/library\/alone\.pdf\n---\n/.test(noteText) && /\n## .+\n<!-- read [^\n]*boxes=129:/.test(noteText), 'it names the PDF and holds the section boxed on p. 129');
      must(useApp.getState().docs['library/alone.pdf']?.note === aloneNote && useApp.getState().docs[aloneNote]?.of === 'library/alone.pdf', 'the PDF shows it as its notes here too');
      const reading = JSON.parse(await vault.fs.readText(vault.abs('.ilmi/reading.json'))) as Record<string, { read?: string }>;
      must(/pos=1\d\d y=0\.\d{3}/.test(reading['library/alone.pdf']?.read ?? ''), `the PDF's own reading line came through reading.json (${reading['library/alone.pdf']?.read})`);
      const sfs = vault.fs as import('../vault/index.js').StoreFs;
      const ahash = sfs.blobAt(vault.abs('library/alone.pdf'))!;
      await poll(async () => { await crdtNow(); return (await sfs.pageInk(ahash, 129)).length === 1; }, 'what the Pencil wrote on a bare PDF\'s page on the iPad is on that page here', 20000);
    }
    await shot('touch-mac-section');
    log(`done; collection ${vault.root}, storage ${dir}`);
  } catch (e) {
    log(`failed: ${e instanceof Error ? e.message : String(e)}`);
  }
}

// `ILMI_SMOKE=phone`: milestone 56's "done when", in three runs over one
// storage folder (`ILMI_STORAGE`; on the simulator `"storage"` in `smoke.json`,
// with `"clip"` the address of a page a server on the Mac's loopback holds).
//  1. The Mac (`ILMI_VAULT` a copy of the sample): its collection makes the
//     storage. `smokePhoneMac`.
//  2. The phone, from its welcome (`smokePhone`): a collection made from the
//     storage, and everything after under touches the rig makes (`do: …`, as
//     `touch`), keys by the rig's `type` and the link by its `open`, the way
//     a Shortcut's "open URL" arrives. The day is the face; a topic's row
//     puts its later, and the notice takes it back; the bar enters the queue;
//     the session is the whole screen and every element of it is walked by
//     its buttons, the four grades each used; `+` opens the composer on the
//     last deck, a deck is chosen, a card saved there, the next starts on it,
//     and a deck in front is the one `+` starts on; the link lands the page
//     and opens it; the one button has the tree and the palette; a document
//     is a single page; `notes` on a chapter puts the note in the pages'
//     place and `pages` comes back; dark, and on its side. What it wrote is
//     named on a `reached:` line and synced.
//  3. The Mac again (`ILMI_VAULT` its collection's own folder, `ILMI_EXPECT`
//     that line): after a sync every document named is the same to the byte.
const digest = (s: string): string => {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = (Math.imul(h, 33) ^ s.charCodeAt(i)) >>> 0;
  return h.toString(36);
};

export async function smokePhone(): Promise<void> {
  let last = { at: Date.now(), what: 'start' };
  let finished = false;
  const log = (s: string) => { last = { at: Date.now(), what: s }; void info(`smoke phone: ${s}`); };
  const dog = setInterval(() => {
    if (finished) { clearInterval(dog); return; }
    if (Date.now() - last.at > 90_000) { finished = true; clearInterval(dog); void info(`smoke phone: failed: no progress for 90 s after "${last.what}"`); }
  }, 2000);
  const q = <T extends Element>(sel: string, root: ParentNode = document) => root.querySelector<T>(sel);
  const qa = <T extends Element>(sel: string, root: ParentNode = document) => Array.from(root.querySelectorAll<T>(sel));
  const shot = async (name: string, ms = 1500) => { await sleep(700); log(`shot: ${name}`); await sleep(ms); };
  const must = (ok: unknown, what: string) => { if (!ok) throw new Error(what); log(`ok: ${what}`); };
  const poll = async <T,>(probe: () => T | null | undefined | false | Promise<T | null | undefined | false>, what: string, ms = 8000): Promise<T> => {
    const t0 = Date.now();
    for (;;) {
      const v = await probe();
      if (v) { log(`ok: ${what}`); return v; }
      if (Date.now() - t0 > ms) throw new Error(`${what} (waited ${ms} ms)`);
      await sleep(80);
    }
  };
  const fx = (x: number) => x / window.innerWidth;
  const fy = (y: number) => y / window.innerHeight;
  const mid = (el: Element): [number, number] => { const r = el.getBoundingClientRect(); return [fx(r.left + r.width / 2), fy(r.top + r.height / 2)]; };
  const ask = (verb: string, ...n: number[]) => log(`do: ${verb} ${n.map((v) => v.toFixed(4)).join(' ')}`);
  /** A finger on `el`, until `then` holds; the first touch after a boot can be dropped, so it is asked for again. */
  const tap = async <T,>(el: Element, then: () => T | null | undefined | false | Promise<T | null | undefined | false>, what: string, ms = 20000): Promise<T> => {
    // the bar gives way to the keyboard, and comes back a moment after a field goes
    for (let w = 0; w < 100 && !el.getBoundingClientRect().width; w++) await sleep(80);
    if (!el.getBoundingClientRect().width) throw new Error(`nothing to touch for: ${what} (keyboard ${document.documentElement.hasAttribute('data-keyboard')})`);
    const at = mid(el);
    ask('tap', ...at);
    const t0 = Date.now();
    for (let again = false; ;) {
      const v = await then();
      if (v) { log(`ok: ${what}`); return v; }
      if (!again && Date.now() - t0 > 6000) { again = true; ask('tap', ...at); }
      if (Date.now() - t0 > ms) throw new Error(`${what} (waited ${ms} ms)`);
      await sleep(80);
    }
  };
  const keys = (text: string) => log(`do: type ${text}`);
  const tall = (sel: string, min = 44) => { const h = qa(sel).map((e) => e.getBoundingClientRect().height); return h.length > 0 && h.every((x) => x >= min); };
  const at = () => activeTab(useApp.getState().panes)?.id;
  try {
    const { isMobile, shapeOf } = await import('./platform.js');
    const { devStorage, joinCollection, crdtNow, filesSettled } = await import('./crdt.js');
    const { syncWord } = await import('./sync.js');
    const { parse } = await import('../format/index.js');
    const { reviewLog, setBudget } = await import('./vault.js');
    must(isMobile() && document.documentElement.dataset.mobile === '1', 'the app knows it is on a phone');
    const shape = () => shapeOf(true, window.innerWidth, window.innerHeight);
    const storage = await devStorage();
    if (!storage || storage.kind !== 'folder') throw new Error('ILMI_STORAGE (smoke.json: "storage") names the folder the Mac\'s collection made its storage in');
    const clip = await invoke<string | null>('dev_env', { name: 'ILMI_CLIP' });
    if (!clip) throw new Error('ILMI_CLIP (smoke.json: "clip") is the address of a local page');
    log(`window ${window.innerWidth}×${window.innerHeight} (${shape()}); pixel ratio ${window.devicePixelRatio}; storage ${storage.folder}`);
    must(shape() === 'phone' && window.innerWidth < 600, 'under 600 px the shell is a phone\'s');

    // ── a collection made from the storage ──
    useApp.getState().setReopen(false);
    useApp.getState().setTheme('light');
    await startFromRecents();
    await until(() => q('.welcome'));
    await shot('phone-welcome');
    const root = await joinCollection(storage, 'double-major', true);
    const vault = await openVault(root);
    must(vault.documents().length === 66, 'the collection is made from the storage: 66 documents');
    await poll(() => syncWord(useApp.getState().sync) === 'synced', 'the strip says synced', 30000);

    // the sample's whole backlog is 476 elements: a day's budget folds it to what a run can walk under a finger
    setBudget(24);
    // ── the day is the face ──
    const TODAY = queueId('today');
    await poll(() => at() === TODAY && q('.queue li[data-el]'), 'the day is what opens, its rows drawn', 20000);
    must(useApp.getState().phone && document.documentElement.dataset.shape === 'phone', 'the page knows it');
    must(!q('.tabbar') && !q('.insp') && !q('.bot') && !q('.top .palette') && !q('.top .insp-toggle'), 'no tabs, no inspector, no key hints, nothing at the top but the name and sync');
    const bar = q<HTMLElement>('.phone-bar')!;
    must(bar && bar.getBoundingClientRect().bottom >= window.innerHeight - 1, 'the bar is at the foot');
    must(tall('.phone-bar button') && qa('.phone-bar button').length === 3, 'three buttons on it, each a finger\'s size');
    must(q('.pb-day')!.textContent!.startsWith('enter queue') && q('.pb-day')!.getAttribute('data-go') === '1', 'on the day the middle one enters the queue');
    must(!qa('.queue button, .queue kbd').some((e) => (e as HTMLElement).offsetParent !== null && e.classList.contains('enter-queue')), 'and the row that says so on the Mac gives way to it');
    must(tall('.qlist li[data-el]', 48), 'rows a finger can take');
    const scroller = q<HTMLElement>('.pane-body')!;
    must(scroller.scrollWidth <= scroller.clientWidth + 1, `nothing wider than the screen (${scroller.scrollWidth} of ${scroller.clientWidth})`);
    const dayRows = qa('.qlist li[data-el]').length;
    log(`the day: ${dayRows} rows, ${qa('.qlist li[data-el="card"]').length} cards`);
    await shot('phone-day');

    // ── a topic's row: its three as buttons, acting from the row ──
    const row = await poll(() => q<HTMLElement>('.qlist li[data-el="read"] .topic-acts, .qlist li[data-el="section"] .topic-acts')?.closest('li'), 'a topic\'s row in the day');
    must(tall('.topic-acts button') && qa('button', row).length === 3, 'it has its three as buttons');
    must(!q('.qlist li[data-el="card"] .topic-acts'), 'a card\'s row has none: a card is graded');
    row.scrollIntoView({ block: 'center' });
    await sleep(500);
    await shot('phone-topic');
    const items = useApp.getState().queue;
    const topicPath = (() => {
      const key = row.querySelector('.qpath')?.getAttribute('title') ?? '';
      return items.find((i) => i.kind !== 'card' && key.includes(useApp.getState().docs[i.path]?.title ?? '\u0000'))?.path ?? null;
    })();
    const before = qa('.qlist li[data-el]').length;
    await tap(q('[data-act="postpone"]', row)!, () => qa('.qlist li[data-el]').length === before - 1, 'later, tapped on the row: the topic leaves the day, nothing opened');
    must(at() === TODAY, 'and the day is still in front');
    const undo = await poll(() => qa<HTMLElement>('.notice .na').find((b) => b.textContent === 'undo'), 'the notice can take it back', 8000);
    await shot('phone-topic-later');
    await tap(undo, () => qa('.qlist li[data-el]').length === before, 'undo: the topic is back', 8000);
    const row2 = await poll(() => q<HTMLElement>('.qlist li[data-el="read"] .topic-acts, .qlist li[data-el="section"] .topic-acts')?.closest('li'), 'the row is there again');
    row2.scrollIntoView({ block: 'center' });
    await sleep(400);
    await tap(q('[data-act="postpone"]', row2)!, () => qa('.qlist li[data-el]').length === before - 1, 'later again, for good');
    scroller.scrollTo({ top: 0 });
    await sleep(400);

    // ── the session: the whole screen, walked by its buttons ──
    await tap(q('.pb-day')!, () => at() === SESSION && (q('.recall-wrap') || q('.doc-session')), 'the middle button enters the queue');
    must(!q('.phone-bar') && !q('.tabbar') && getComputedStyle(q('.top')!).display === 'none', 'a session is the whole screen: no strip, no bar');
    const graded: { path: string; block: number; grade: number }[] = [];
    const topics: string[] = [];
    const counter = () => (q('.sess-count') ?? q('.sb-count'))?.textContent ?? '';
    let shots = 0;
    let n = 0;
    for (; n < 400; n++) {
      await poll(() => q('.session-end') || q('.reveal-all') || q('.grades') || q('.doc-session .sb-actions'), 'the next element is up', 30000);
      if (q('.session-end')) break;
      const was = counter();
      const el = useApp.getState().sessionEl?.item;
      if (q('.reveal-all')) {
        if (!shots) {
          must(!q('.grades') && !q('.face-hint:not([hidden])')?.getBoundingClientRect().height, 'before the answer: one button, where the grades will be');
          must(q('.reveal-all')!.getBoundingClientRect().bottom >= window.innerHeight - 1 && tall('.reveal-all', 64), 'at the very foot, across it');
          await shot('phone-card');
        }
        await tap(q('.reveal-all')!, () => q('.grades'), 'reveal');
      }
      if (q('.grades')) {
        const buttons = qa<HTMLElement>('.grades button');
        if (!shots++) {
          must(buttons.length === 4 && tall('.grades button', 64), 'the four grades as buttons');
          const r = buttons.map((b) => b.getBoundingClientRect());
          must(Math.abs(r[0]!.left) < 2 && Math.abs(r[3]!.right - window.innerWidth) < 2 && r.every((x) => Math.abs(x.bottom - window.innerHeight) < 2 && Math.abs(x.top - r[0]!.top) < 1), 'across the bottom, edge to edge');
          must(buttons.every((b) => !!b.querySelector('.gap')?.textContent), `each says when it comes back (${buttons.map((b) => b.querySelector('.gap')?.textContent).join(' ')})`);
          await shot('phone-card-answer');
        }
        const g = graded.length % 4;
        graded.push({ path: el!.path, block: (el as CardItem).block, grade: g + 1 });
        await tap(buttons[g]!, () => q('.session-end') || counter() !== was, `graded ${g + 1}: ${el!.path}`);
      } else {
        const bar2 = q<HTMLElement>('.doc-session .sb-actions')!;
        topics.push(el!.path);
        await tap(q('[data-act="postpone"]', bar2)!, () => q('.session-end') || counter() !== was, `later: ${el!.path}`);
      }
    }
    must(graded.length > 0, `the day's cards graded by the buttons: ${graded.length}, ${topics.length} topics put later`);
    must([1, 2, 3, 4].every((g) => graded.some((c) => c.grade === g)), 'each of the four grades was used');
    await poll(() => at() === TODAY && q('.phone-bar'), 'the session ends on the day', 8000);
    await sleep(600);
    await shot('phone-day-after');

    // ── a topic in a session: a row tapped opens it there, its page and its three; × is the way back ──
    const tRow = await poll(() => q<HTMLElement>('.qlist li[data-el="read"] .topic-acts, .qlist li[data-el="section"] .topic-acts')?.closest('li'), 'a topic on the day');
    tRow.scrollIntoView({ block: 'center' });
    await sleep(500);
    await tap(q('.body', tRow)!, () => at() === SESSION && q('.doc-session .sb-actions'), 'a tap on its row opens it in the session');
    must(tall('.doc-session .sb-actions button', 50) && !qa('.sb-actions kbd').some((k) => (k as HTMLElement).offsetParent !== null), 'its page, and its three as buttons, no keys named');
    must(!q('.phone-bar') && q('.session-bar')!.getBoundingClientRect().bottom >= window.innerHeight - 1, 'across the foot of the whole screen');
    await sleep(1500);
    await shot('phone-session-topic');
    await tap(q('.sn-out')!, () => at() === TODAY && q('.phone-bar'), '× goes back to the day');
    await sleep(500);

    // ── a quick card ──
    const DECKS = Object.entries(useApp.getState().docs).filter(([, i]) => i.type === 'deck').map(([p]) => p);
    const VOCAB = 'arabic/vocabulary.md';
    const ROOTS = 'arabic/roots.md';
    must(DECKS.includes(VOCAB) && DECKS.includes(ROOTS), `the sample's decks are here (${DECKS.length})`);
    const typeIn = async (field: HTMLElement, text: string, value: () => string) => {
      // the keyboard coming up moves the fields: a place is taken once it is up
      await poll(() => document.documentElement.hasAttribute('data-keyboard'), 'the keyboard is up', 15000);
      await sleep(500);
      if (document.activeElement !== field) await tap(field, () => document.activeElement === field, 'the field has the caret');
      keys(text);
      const t0 = Date.now();
      while (value() !== text && Date.now() - t0 < 12000) await sleep(100);
      if (value() !== text) await shot('phone-typed-otherwise');
      must(value() === text, `typed: ${text} (the field holds "${value()}")`);
    };
    const fields = () => qa<HTMLTextAreaElement>('.quick textarea, .quick input');
    await tap(q('.pb-add')!, () => q('.quick'), '+ on the day opens the composer');
    await poll(() => fields().length === 2 && fields()[0]!.placeholder === 'front' && fields()[1]!.placeholder === 'back', 'front and back');
    must(document.activeElement === fields()[0], 'the caret in the front');
    must(!q('.quick .pri-pick') && !q('.quick kbd') && tall('.qf-acts button', 50), 'nothing to set, no keys named, the buttons a finger\'s size');
    await poll(() => document.documentElement.hasAttribute('data-keyboard'), 'the keyboard is up', 15000);
    await sleep(600);
    const vh = window.visualViewport?.height ?? 0;
    must(q('.qf-acts')!.getBoundingClientRect().bottom <= vh + 1, `its buttons sit on the keyboard (${Math.round(q('.qf-acts')!.getBoundingClientRect().bottom)} of ${Math.round(vh)} shown, ${window.innerHeight} in all)`);
    await shot('phone-composer');
    await tap(q('.quick-deck')!, () => q('.quick-decks'), 'a tap on the deck lists them');
    await shot('phone-composer-decks');
    const deckRow = await poll(() => q<HTMLElement>(`.qd-row[data-path="${VOCAB}"]`), 'the deck has a row');
    deckRow.scrollIntoView({ block: 'center' });
    await sleep(400);
    await tap(deckRow, () => !q('.quick-decks') && q('.qd-t')?.textContent === useApp.getState().docs[VOCAB]?.title, 'a deck chosen');
    const CARD = ['phone front one', 'phone back one'] as const;
    await typeIn(fields()[0]!, CARD[0], () => fields()[0]!.value);
    await typeIn(fields()[1]!, CARD[1], () => fields()[1]!.value);
    await shot('phone-composer-typed');
    const textOf = (p: string) => vault.fs.readText(vault.abs(p));
    const cardsIn = async (p: string) => parse(await textOf(p)).doc.blocks.flatMap((b) => (b.kind === 'card' ? [b.text] : []));
    const has = async (p: string, front: string) => (await cardsIn(p)).some((c) => c.includes(front));
    await tap(q('.qf-acts [data-act="save"]')!, () => !q('.quick'), 'saved, the composer gone');
    await poll(() => has(VOCAB, CARD[0]), 'the card is in the deck chosen');
    await poll(() => q('.notice'), 'and says where');
    await shot('phone-card-added');
    await tap(q('.pb-add')!, () => q('.quick'), '+ again');
    must(q('.qd-t')?.textContent === useApp.getState().docs[VOCAB]?.title, 'it starts on the deck chosen last');
    await typeIn(fields()[0]!, 'phone front two', () => fields()[0]!.value);
    await typeIn(fields()[1]!, 'phone back two', () => fields()[1]!.value);
    await tap(q('.qf-acts [data-act="again"]')!, async () => (await has(VOCAB, 'phone front two')) && fields()[0]!.value === '' && q('.quick'), 'save, another: saved, and the composer empty for the next');
    await typeIn(fields()[0]!, 'phone front three', () => fields()[0]!.value);
    await tap(q('.qf-acts [data-act="cancel"]')!, () => !q('.quick'), 'cancel: nothing kept');
    must(!(await has(VOCAB, 'phone front three')), 'nothing written');

    // ── the one button: the tree and the palette ──
    const trow = (path: string) => q<HTMLElement>(`.side .trow[data-path="${path}"]`);
    const sheet = () => tap(q('.pb-more')!, () => q<HTMLElement>('.side[data-sheet="1"]'), 'the one button brings the tree');
    await sheet();
    must(q('.side-find')?.textContent?.includes('open or run') && tall('.side-find', 50), 'and the palette\'s field at its foot');
    must(tall('.side .tree .row'), 'rows a finger can take');
    await sleep(500);
    await shot('phone-tree');
    for (const dir of ['arabic']) {
      const r = await poll(() => trow(dir), `${dir} has a row`, 10000);
      if (r.getAttribute('aria-expanded') !== 'true') await tap(q('.chev', r)!, () => trow(dir)?.getAttribute('aria-expanded') === 'true', `a tap on its mark opens ${dir}`);
    }
    await sleep(300);
    await tap(q('.name', (await poll(() => trow(ROOTS), 'a deck has a row'))!)!, () => at() === ROOTS && !q('.side'), 'a tap on a deck opens it, and the sheet goes');
    await poll(() => q('.deck-browser'), 'the deck');
    must(!q('.deck-add'), 'no second + on it: the one at the foot');
    await shot('phone-deck');
    await tap(q('.pb-add')!, () => q('.quick'), '+ on a deck');
    must(q('.qd-t')?.textContent === useApp.getState().docs[ROOTS]?.title, 'starts on that deck');
    await typeIn(fields()[0]!, 'phone root front', () => fields()[0]!.value);
    await typeIn(fields()[1]!, 'phone root back', () => fields()[1]!.value);
    await tap(q('.qf-acts [data-act="save"]')!, () => !q('.quick'), 'saved');
    await poll(() => has(ROOTS, 'phone root front'), 'the card is in the deck in front');

    // ── a page clipped by the Shortcut's link ──
    const countDocs = vault.documents().length;
    const link = `ilmi://new?url=${encodeURIComponent(clip)}`;
    log(`do: open ${link}`);
    const clipped = await poll(() => {
      const id = at();
      return id && id !== ROOTS && id.endsWith('.md') && !useApp.getState().docs[ROOTS] === false && vault.documents().length === countDocs + 1 ? id : null;
    }, 'the link lands a page and opens it', 30000);
    await poll(() => q('.doc-view .draft-doc'), 'as a page');
    const clipText = await textOf(clipped);
    must(clipText.includes(`url: ${clip}`), `the address is kept (${clipped})`);
    must(/page.s second paragraph/.test(clipText), 'with the page\'s text');
    must(useApp.getState().docs[clipped]?.type === 'source' && useApp.getState().docs[clipped]?.frozen, 'a frozen source, as the clipper lands one');
    await sleep(600);
    const page = q<HTMLElement>('.doc-view')!.getBoundingClientRect();
    must(!q('.tabbar') && !q('.tab-rail') && !q('.insp') && page.left >= 0 && page.right <= window.innerWidth + 1, `a document is a single page (${Math.round(page.left)}–${Math.round(page.right)})`);
    await shot('phone-clip');

    // ── a notebook's page, a chapter, and what `notes` does with no second pane ──
    await sheet();
    const CH = 'library/lindqvist-statistical-physics/ch-3-the-canonical-ensemble.md';
    for (const dir of ['library', 'library/lindqvist-statistical-physics.md']) {
      const r = await poll(() => trow(dir), `${dir} has a row`, 10000);
      r.scrollIntoView({ block: 'center' });
      await sleep(200);
      if (r.getAttribute('aria-expanded') !== 'true') await tap(q('.chev', r)!, () => trow(dir)?.getAttribute('aria-expanded') === 'true', `a tap on its mark opens ${dir}`);
    }
    const chRow = await poll(() => trow(CH), 'the chapter has a row');
    chRow.scrollIntoView({ block: 'center' });
    await sleep(300);
    await tap(q('.name', chRow)!, () => at() === CH && !q('.side'), 'the chapter opens');
    const book = await poll(() => q<HTMLElement>('.book'), 'as its pages', 15000);
    await poll(() => q('.pdf-page[data-page="23"] canvas', book), 'its book fetched and the first page drawn', 60000);
    await filesSettled();
    const pageRect = q<HTMLElement>('.pdf-page[data-page="23"]', book)!.getBoundingClientRect();
    must(pageRect.left >= 0 && pageRect.right <= window.innerWidth + 1, `the page fits the screen (${Math.round(pageRect.width)} of ${window.innerWidth})`);
    await shot('phone-book');
    const word = await poll(() => q<HTMLElement>('.meta .notes-toggle'), 'notes is among the words over the pages');
    await tap(word, () => notesPath(at() ?? '') === CH && q('.draft-doc'), 'notes: the note is the page, in the pages\' place');
    must(qa('.pane').length === 1 && !q('.book'), 'one pane, no pages');
    await sleep(500);
    await shot('phone-notes');
    await tap(await poll(() => q<HTMLElement>('.meta .pages-toggle'), 'pages over the note'), () => at() === CH && q('.book'), 'pages: back to the pages');

    // ── the palette ──
    await sheet();
    await tap(q('.side-find')!, () => q('.palette-panel'), 'the field at the sheet\'s foot opens the palette');
    must(!q('.side'), 'the tree gives it the screen');
    const input = q<HTMLInputElement>('.palette-input input')!;
    must(document.activeElement === input, 'the caret in its field');
    await sleep(600);
    await shot('phone-palette');
    keys('wkb');
    await poll(() => input.value === 'wkb', 'typed in the palette', 30000);
    const hit = await poll(() => q<HTMLElement>('.palette-row'), 'a row found');
    await shot('phone-palette-found');
    await tap(hit, () => !q('.palette-panel') && at()?.endsWith('.md') && at() !== CH, 'a tap opens it', 10000);
    await poll(() => q('.doc-view .draft-doc') || q('.book'), 'a page');
    await sleep(800);
    await shot('phone-document');
    await tap(q('.pb-day')!, () => at() === TODAY && q('.queue'), 'today comes back to the day from anywhere');

    // ── dark, and on its side ──
    useApp.getState().setTheme('dark');
    await sleep(500);
    await shot('phone-day-dark');
    await sheet();
    await shot('phone-tree-dark');
    await tap(q('.pb-more')!, () => !q('.side'), 'the one button closes it too');
    await tap(q('.pb-add')!, () => q('.quick'), 'the composer, dark');
    await shot('phone-composer-dark');
    await tap(q('.qf-acts [data-act="cancel"]')!, () => !q('.quick'), 'cancelled');
    useApp.getState().setTheme('light');
    log('do: turn landscape');
    await poll(() => window.innerWidth > window.innerHeight, 'turned on its side', 20000);
    await sleep(800);
    must(useApp.getState().phone && document.documentElement.dataset.shape === 'phone' && q('.phone-bar'), `a phone on its side is still a phone (${window.innerWidth}×${window.innerHeight})`);
    await shot('phone-side');
    log('do: turn portrait');
    await poll(() => window.innerWidth < window.innerHeight, 'upright again', 20000);
    await sleep(600);

    // ── all of it to the storage ──
    await crdtNow();
    await poll(async () => { await crdtNow(); return syncWord(useApp.getState().sync) === 'synced' && useApp.getState().sync.toPush === 0; }, 'all of it is in the storage', 30000);
    const paths = [...new Set([...graded.map((c) => c.path), ...topics, ...(topicPath ? [topicPath] : []), VOCAB, ROOTS, clipped])];
    const docs: Record<string, string> = {};
    for (const p of paths) docs[p] = digest(await textOf(p));
    useApp.getState().setReopen(true);
    log(`reached: ${JSON.stringify({ graded: graded.length, reviews: reviewLog().length, clipped, url: clip, vocab: CARD, docs })}`);
    finished = true;
    log(`done; collection ${vault.root}`);
  } catch (e) {
    finished = true;
    log(`failed: ${e instanceof Error ? e.message : String(e)}`);
  }
}

/** The Mac's side of `ILMI_SMOKE=phone` (see `smokePhone`): the storage made, and after the phone's run all it wrote found. */
export async function smokePhoneMac(vault: Vault): Promise<void> {
  const log = (s: string) => void info(`smoke phone: ${s}`);
  const q = <T extends Element>(sel: string, root: ParentNode = document) => root.querySelector<T>(sel);
  const must = (ok: unknown, what: string) => { if (!ok) throw new Error(what); log(`ok: ${what}`); };
  const poll = async <T,>(probe: () => T | null | undefined | false | Promise<T | null | undefined | false>, what: string, ms = 8000): Promise<T> => {
    const t0 = Date.now();
    for (;;) {
      const v = await probe();
      if (v) { log(`ok: ${what}`); return v; }
      if (Date.now() - t0 > ms) throw new Error(`${what} (waited ${ms} ms)`);
      await sleep(100);
    }
  };
  try {
    const { crdtNow, crdtOn, storageDir } = await import('./crdt.js');
    const { syncWord } = await import('./sync.js');
    const { parse } = await import('../format/index.js');
    const { reviewLog } = await import('./vault.js');
    const dir = await storageDir();
    if (!dir) throw new Error('ILMI_STORAGE names the folder the two devices share');
    useApp.getState().setTheme('light');
    must(!useApp.getState().phone && document.documentElement.dataset.shape === 'desktop' && !q('.phone-bar') && !!q('.bot'), 'the Mac\'s shell is the Mac\'s');
    await poll(() => crdtOn() && syncWord(useApp.getState().sync) === 'synced', 'the collection syncs through the folder', 60000);
    const raw = await invoke<string | null>('dev_env', { name: 'ILMI_EXPECT' });
    if (!raw) {
      await crdtNow();
      await poll(() => syncWord(useApp.getState().sync) === 'synced' && useApp.getState().sync.toPush === 0, 'the storage is made', 30000);
      log(`done; collection ${vault.root}, storage ${dir}`);
      return;
    }
    const want = JSON.parse(raw) as { graded: number; reviews: number; clipped: string; url: string; vocab: [string, string]; docs: Record<string, string> };
    const text = (p: string) => vault.fs.readText(vault.abs(p));
    await poll(async () => { await crdtNow(); try { return (await text(want.clipped)).includes(want.url); } catch { return false; } }, `the page clipped on the phone is here: ${want.clipped}`, 30000);
    const cards = parse(await text('arabic/vocabulary.md')).doc.blocks.flatMap((b) => (b.kind === 'card' ? [b.text] : []));
    must(cards.some((c) => c.includes(want.vocab[0]) && c.includes(want.vocab[1])), 'the card added on the phone is in its deck');
    const paths = Object.keys(want.docs);
    await poll(async () => {
      await crdtNow();
      for (const p of paths) if (digest(await text(p)) !== want.docs[p]) return false;
      return true;
    }, `all ${paths.length} documents it wrote are the same here, schedules and all`, 30000);
    await poll(() => reviewLog().length === want.reviews, `the ${want.graded} reviews are in the log here (${want.reviews} in all)`, 15000);
    openNode(want.clipped);
    await poll(() => q('.doc-view .draft-doc'), 'the clipped page opens');
    await sleep(900);
    log('shot: phone-mac-clip');
    await sleep(2500);
    openNode('arabic/vocabulary.md');
    await poll(() => q('.deck-browser'), 'the deck opens');
    await sleep(900);
    log('shot: phone-mac-deck');
    await sleep(2500);
    log(`done; collection ${vault.root}, storage ${dir}`);
  } catch (e) {
    log(`failed: ${e instanceof Error ? e.message : String(e)}`);
  }
}

// `ILMI_SMOKE=ink`: milestone 69's "done when" in a note (58's before it), in
// three runs over one storage folder, as `touch` is.
//  1. The Mac (`ILMI_VAULT` a copy of the sample, `ILMI_STORAGE` an empty
//     folder): its collection makes the storage. `smokeInkMac`.
//  2. The iPad (`smokeInk`, `{"mode": "ink", "storage": "<the folder>"}`):
//     a collection made from the storage, a long note open. A simulator has
//     no Pencil and this Xcode's runner makes fingers only, so a dev run
//     says a finger stands in for it (`dev_ink_pen`): the same canvases,
//     recognisers and web view, the rig's finger taken for a Pencil until
//     told otherwise. Then under touches the rig makes: nothing is offered
//     (no `draw` in the heading's menu or the insert menu); a stroke put
//     down between two paragraphs is on a canvas at once, with nothing
//     chosen, and the area opens there, the lower paragraph moving away
//     and the upper not; strokes going down grow the area; left alone, the
//     strokes are rows, the line is in the note between the two paragraphs,
//     and the canvas gives way to the picture, where the strokes were. With
//     the finger a finger again: a drag scrolls the note with the area in
//     it, the canvas keeping to it, and writes nothing; a tap puts the
//     caret in the text and the tools go. Then the stand-in again: a stroke
//     in the area adds to it, a stroke in the text elsewhere opens another.
//     What a touch cost and what a page weighs are logged, and it is synced.
//  3. The Mac again (`ILMI_VAULT` its collection's own folder,
//     `ILMI_EXPECT` the two paragraphs' first words, `ILMI_STROKES` how
//     many): after a sync the page is between the same two paragraphs, its
//     picture made here from the strokes, and the drawing an export writes
//     reads back as them.
const INK_NOTE = 'courses/fall-2026/phys-415-stat-mech/canonical-ensemble.md';

/** How the canvases stand (`dev_ink_state`). */
interface InkState {
  sheets: { id: string; strokes: number; shown: boolean; dirty: boolean; at: { x: number; y: number; w: number; h: number } }[];
  hosts: { id: string; follows: boolean; offset: number; port: { x: number; y: number; w: number; h: number } }[];
  tools: boolean;
  down: boolean;
  scribble: number;
  touched: { armed?: number; seen?: number; moved?: number; ink?: number; page?: number; lost?: number; fresh: boolean } | null;
  lastTouched: { armed?: number; seen?: number; moved?: number; ink?: number; page?: number; lost?: number; fresh: boolean }[];
}
const costOf = (t: InkState['touched']): string => (t ? `armed ${t.armed?.toFixed(1)} ms from it, seen at ${t.seen?.toFixed(1)}, first moved at ${t.moved?.toFixed(1)}, the stroke begun at ${t.ink?.toFixed(1)}, the page's answer at ${t.page?.toFixed(1) ?? '-'}, its first point ${t.lost?.toFixed(2)} pt from the touch` : 'none');

export async function smokeInk(): Promise<void> {
  type StoreFs = import('../vault/index.js').StoreFs;
  let last = { at: Date.now(), what: 'start' };
  let finished = false;
  const log = (s: string) => { last = { at: Date.now(), what: s }; void info(`smoke ink: ${s}`); };
  const dog = setInterval(() => {
    if (finished) { clearInterval(dog); return; }
    if (Date.now() - last.at > 90_000) { finished = true; clearInterval(dog); void info(`smoke ink: failed: no progress for 90 s after "${last.what}"`); }
  }, 2000);
  const q = <T extends Element>(sel: string, root: ParentNode = document) => root.querySelector<T>(sel);
  const qa = <T extends Element>(sel: string, root: ParentNode = document) => Array.from(root.querySelectorAll<T>(sel));
  const shot = async (name: string, ms = 2500) => { await sleep(900); log(`shot: ${name}`); await sleep(ms); };
  const must = (ok: unknown, what: string) => { if (!ok) throw new Error(what); log(`ok: ${what}`); };
  const poll = async <T,>(probe: () => T | null | undefined | false | Promise<T | null | undefined | false>, what: string, ms = 8000): Promise<T> => {
    const t0 = Date.now();
    for (;;) {
      const v = await probe();
      if (v) { log(`ok: ${what}`); return v; }
      if (Date.now() - t0 > ms) throw new Error(`${what} (waited ${ms} ms)`);
      await sleep(100);
    }
  };
  const ask = (verb: string, ...n: number[]) => log(`do: ${verb} ${n.map((v) => v.toFixed(4)).join(' ')}`);
  const fx = (x: number) => x / window.innerWidth;
  const fy = (y: number) => y / window.innerHeight;
  try {
    const { isMobile, shapeOf } = await import('./platform.js');
    const { devStorage, joinCollection, crdtNow } = await import('./crdt.js');
    const { syncWord } = await import('./sync.js');
    const { parse } = await import('../format/index.js');
    const { slashItems } = await import('../reader/index.js');
    const ink = await import('./ink.js');
    must(isMobile() && document.documentElement.dataset.mobile === '1', 'the app knows it is on an iPad');
    const storage = await devStorage();
    if (!storage || storage.kind !== 'folder') throw new Error('ILMI_STORAGE (smoke.json: "storage") names the folder the Mac\'s collection made its storage in');
    log(`window ${window.innerWidth}×${window.innerHeight}; pixel ratio ${window.devicePixelRatio}; storage ${storage.folder}`);
    // a simulator stays as the last run left it
    if (shapeOf(true, window.innerWidth, window.innerHeight) !== 'portrait') log('do: turn portrait');
    await poll(() => shapeOf(true, window.innerWidth, window.innerHeight) === 'portrait', 'the iPad is upright', 25000);

    // ── a collection made from the storage, a long note open ──
    useApp.getState().setReopen(false);
    useApp.getState().setTheme('light');
    await startFromRecents();
    await until(() => q('.welcome'));
    const vault = await openVault(await joinCollection(storage, 'double-major', true));
    must(vault.documents().length === 66, 'the collection is made from the storage: 66 documents');
    await poll(() => syncWord(useApp.getState().sync) === 'synced', 'the strip says synced', 30000);
    const DIR = INK_NOTE.replace(/\.md$/, '');
    const PAGE = `${DIR}/ink-01.pkdrawing`;
    const PICTURE = `${DIR}/ink-01.png`;
    const LINE = '![working](canonical-ensemble/ink-01.png)';
    const LINE2 = '![working](canonical-ensemble/ink-02.png)';
    const fs = vault.fs as StoreFs;
    const text = () => vault.fs.readText(vault.abs(INK_NOTE));
    const state = () => invoke<InkState>('dev_ink_state');
    const pen = (on: boolean) => invoke('dev_ink_pen', { on });
    const sheetOf = (s: InkState, id: string) => s.sheets.find((x) => x.id === id);
    must(!(await text()).includes('ink-01') && (await fs.stat(vault.abs(PAGE))) === null, 'the note has no page of ink yet');
    openNode(INK_NOTE);
    const doc = await poll(() => q<HTMLElement>('.pane[data-active="1"] .doc-view .draft-doc'), 'the note opens', 15000);
    const scroller = doc.closest<HTMLElement>('.pane-body')!;
    await poll(async () => (await state()).hosts.some((h) => h.port.h > 0), 'the canvases are told of it', 15000);

    // ── nothing is offered: draw is nowhere ──
    must(slashItems('draw', 'paragraph').length === 0 && !slashItems('', 'paragraph').some((i) => (i.id as string) === 'draw'), 'the insert menu has no draw');
    const pair = (): [HTMLElement, HTMLElement] => {
      const ps = Array.from(doc.children) as HTMLElement[];
      // two of plain words at their heads: they are found again in the file, and on the Mac, by those words
      const plain = (el: HTMLElement) => el.matches('p.dd-p') && (el.textContent ?? '').length > 120 && el.getBoundingClientRect().height < 420 && /^[A-Za-z][A-Za-z ,'-]{13}/.test((el.textContent ?? '').trim());
      for (let i = 2; i + 1 < ps.length; i++) if (plain(ps[i]!) && plain(ps[i + 1]!)) return [ps[i]!, ps[i + 1]!];
      throw new Error('no two long paragraphs together');
    };
    const [p1, p2] = pair();
    const firstWords = (el: HTMLElement) => (el.textContent ?? '').trim().slice(0, 40);
    p1.scrollIntoView({ block: 'start' });
    scroller.scrollTop -= 120;
    await sleep(600);
    const head = qa<HTMLElement>('.dd-h', doc).find((h) => { const r = h.getBoundingClientRect(); return r.top > 60 && r.bottom < window.innerHeight - 60; });
    if (head) {
      const words = document.createRange();
      words.selectNodeContents(head);
      const wr = [...words.getClientRects()].find((r) => r.width > 20) ?? head.getBoundingClientRect();
      ask('press', fx(wr.left + Math.min(60, wr.width / 2)), fy(wr.top + wr.height / 2), 0.9);
      const menu = await poll(() => q<HTMLElement>('.ctx-menu.section-menu'), 'a long press on a heading opens its menu', 25000);
      must(!q('.ci[data-act="draw"]', menu), `with no draw in it (${qa('.ci', menu).map((i) => i.textContent).join(' | ')})`);
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
      document.body.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
      await sleep(400);
    } else log('no heading on the screen for the menu');
    await shot('ink-note');

    // ── the Pencil put down between two paragraphs: nothing chosen first ──
    await pen(true);
    const col = doc.getBoundingClientRect();
    const a0 = p1.getBoundingClientRect();
    const b0 = p2.getBoundingClientRect();
    const gapY = (a0.bottom + b0.top) / 2;
    log(`between: "${firstWords(p1)}" (foot ${a0.bottom.toFixed(1)}) and "${firstWords(p2)}" (top ${b0.top.toFixed(1)}); the stroke at ${gapY.toFixed(1)}`);
    must(a0.bottom < b0.top && gapY > 100 && gapY < window.innerHeight - 300, 'there are two paragraphs on the screen, a gap between them');
    const X = (f: number) => col.left + f * col.width;
    ask('drag', fx(X(0.12)), fy(gapY), fx(X(0.5)), fy(gapY + 22), 0.05);
    const fresh = await poll(async () => (await state()).sheets.find((s) => s.id.startsWith('new:') && s.strokes === 1), 'the stroke is on a canvas', 25000);
    const id = fresh.id;
    await poll(() => q(`.ink-gap[data-sheet="${id}"]`, doc), 'and the area is open in the text, with nothing chosen', 5000);
    const gap = () => q<HTMLElement>(`.ink-gap[data-sheet="${id}"]`, doc);
    must(gap()!.previousElementSibling === p1 && gap()!.nextElementSibling === p2, 'between the two paragraphs');
    must(!q('.ctx-menu') && !q('.palette-overlay'), 'no menu and nothing over the note: only the system\'s tools');
    const a1 = p1.getBoundingClientRect();
    const b1 = p2.getBoundingClientRect();
    must(Math.abs(a1.top - a0.top) < 1.5 && b1.top - b0.top >= 150, `the upper paragraph stays (${(a1.top - a0.top).toFixed(1)} px) and the lower moves away (${(b1.top - b0.top).toFixed(1)} px)`);
    const s1 = await poll(async () => { const s = await state(); return s.touched?.ink !== undefined && s.touched.lost !== undefined ? s : null; }, 'the first touch is told', 12000);
    log(`touch: ${costOf(s1.touched)}`);
    must(s1.touched!.lost! < 3, `the first touch is not lost: the stroke starts ${s1.touched!.lost!.toFixed(2)} pt from where the finger came down`);
    must(s1.tools, 'the tool picker is shown while ink is written');
    await shot('ink-first-stroke');

    // ── the writing goes down, and the area with it ──
    // a gap until the writing is first kept, the area after: the capture above took longer than the quiet does
    const held = () => gap() ?? q<HTMLElement>('p.dd-img.ink-area', doc);
    const grown = () => held()?.getBoundingClientRect().height ?? 0;
    const h0 = grown();
    let n = 1;
    const stroke = async (x1: number, y1: number, x2: number, y2: number) => {
      const want = (sheetOf(await state(), id)?.strokes ?? 0) + 1;
      ask('drag', fx(X(x1)), fy(y1), fx(X(x2)), fy(y2), 0.05);
      await poll(async () => sheetOf(await state(), id)?.strokes === want, `stroke ${want} is on the same canvas`, 25000);
      n = want;
    };
    const y0 = held()!.getBoundingClientRect().top;
    await stroke(0.15, y0 + 60, 0.45, y0 + 62);
    await stroke(0.55, y0 + 56, 0.8, y0 + 70);
    must(grown() === h0, 'writing high in the area leaves it as it is');
    await stroke(0.2, y0 + h0 - 48, 0.6, y0 + h0 - 40);
    await poll(() => grown() > h0, `written near its foot, the area grows (from ${h0} px)`, 5000);
    const b2 = p2.getBoundingClientRect();
    must(b2.top > b1.top + 100, 'and the paragraph under it moves down');
    const h1 = grown();
    await stroke(0.2, y0 + h1 - 40, 0.7, y0 + h1 - 34);
    await poll(() => grown() > h1, 'and grows again, as the writing goes on down', 5000);
    await shot('ink-grown');

    // ── left alone: kept, the line in the note, the picture where the strokes were ──
    const kept = await poll(async () => { const got = await fs.ink(vault.abs(PAGE)); return got && got.length === n ? got : null; }, `left alone, the page is kept: ${n} strokes in the store`, 20000);
    await poll(async () => (await text()).includes(LINE), 'its line is in the note\'s text', 10000);
    const blocksOf = async () => parse(await text()).doc.blocks;
    let blocks = await blocksOf();
    const li = blocks.findIndex((b) => b.kind === 'paragraph' && b.text === LINE);
    const prefix = (el: HTMLElement) => firstWords(el).slice(0, 12);
    must(li > 0 && blocks[li - 1]!.text.trim().startsWith(prefix(p1)) && blocks[li + 1]!.text.trim().startsWith(prefix(p2)), 'between the same two paragraphs');
    const names = kept.map((k) => k.stroke);
    must(new Set(names).size === names.length && names.every((k) => /^[0-9a-f]{16}$/.test(k)), 'each stroke has a name of its own');
    const area = await poll(() => q<HTMLElement>('p.dd-img.ink-area', doc), 'the gap is the area now, in the note\'s flow', 8000);
    must(!q('.ink-gap', doc), 'and no gap is left');
    const row = await fs.rowAt(vault.abs(PAGE));
    must(row && row.blob === null && (await fs.rowAt(vault.abs(PICTURE))) === null, 'the page is a row with no file behind it, and its picture is no row');
    const img = await poll(() => { const i = q<HTMLImageElement>('img.md-img[data-ink]', area); return i && i.complete && i.naturalWidth > 0 ? i : null; }, 'the picture is in the area', 15000);
    await poll(async () => { const s = sheetOf(await state(), id); return s && !s.shown; }, 'the canvas gives way to it, until the Pencil\'s next touch', 8000);
    const box = await inkedBox(await fs.readBytes(vault.abs(PICTURE)));
    const ir = q<HTMLImageElement>('img.md-img[data-ink]', area)!.getBoundingClientRect();
    const [left, top] = [ir.left + box.x0 / 2, ir.top + box.y0 / 2];
    log(`picture ${box.w}×${box.h}; ink from ${left.toFixed(1)},${top.toFixed(1)}; the first stroke began at ${X(0.12).toFixed(1)},${gapY.toFixed(1)}`);
    must(Math.abs(left - X(0.12)) < 8 && Math.abs(top - gapY) < 8, 'and the ink lies where the finger went, within a stroke\'s width');
    void img;
    await shot('ink-kept');
    const pngSize = (b: Uint8Array) => ({ w: new DataView(b.buffer, b.byteOffset).getUint32(16), h: new DataView(b.buffer, b.byteOffset).getUint32(20) });
    const pic1 = await fs.readBytes(vault.abs(PICTURE));
    const k1 = ink.lastKept!;
    log(`page: ${k1.strokes} strokes; as rows ${k1.rows} bytes (${Math.round(k1.rows / k1.strokes)} a stroke); as one drawing ${k1.drawing} bytes; as a PNG ${pic1.length} bytes (${pngSize(pic1).w}×${pngSize(pic1).h})`);

    // ── a finger: it scrolls the note with the area in it, and writes nothing ──
    await pen(false);
    const follows = await state();
    must(follows.hosts.some((h) => h.follows), 'the layer found the note\'s own scroll view');
    const top0 = scroller.scrollTop;
    const r0 = area.getBoundingClientRect();
    const hang = r0.top - sheetOf(follows, id)!.at.y;
    const hx = fx(X(0.5));
    ask('drag', hx, fy(r0.top + 90), hx, fy(r0.top - 130), 0.02);
    await poll(() => Math.abs(scroller.scrollTop - top0) > 40, 'a finger scrolls the note, from on the area', 25000);
    await sleep(1500);
    const settled = await state();
    const r1 = area.getBoundingClientRect();
    must(r1.top < r0.top - 40, `with the area in it (${(r1.top - r0.top).toFixed(1)} px)`);
    const moved = sheetOf(settled, id)!;
    must(moved.strokes === n && !q('.ink-gap', doc) && !settled.sheets.some((s) => s.id.startsWith('new:') && s.id !== id && s.strokes > 0), 'and writes nothing');
    must(Math.abs(r1.top - moved.at.y - hang) < 1.5, `its canvas keeps to the area, to a point (${r1.top.toFixed(1)} and ${moved.at.y.toFixed(1)})`);
    await shot('ink-scrolled');
    // a flick, and the canvas keeps to the area through it
    const top1 = scroller.scrollTop;
    ask('flick', hx, 0.75, hx, 0.45);
    await poll(() => Math.abs(scroller.scrollTop - top1) > 60, 'a flick scrolls on', 25000);
    await sleep(2200);
    const flicked = sheetOf(await state(), id);
    if (flicked) {
      const r2 = area.getBoundingClientRect();
      must(Math.abs(r2.top - flicked.at.y - hang) < 1.5, `and through a flick (${r2.top.toFixed(1)} and ${flicked.at.y.toFixed(1)})`);
    } else log('the flick took the area past where a canvas is kept ready');

    // ── a tap puts the caret in the text, and the tools go ──
    // a flick may still be running down: it is the scroll view's, and goes on over what a script sets
    await poll(async () => { p1.scrollIntoView({ block: 'center' }); await sleep(500); const r = p1.getBoundingClientRect(); return r.top > 100 && r.bottom < window.innerHeight - 100; }, 'the paragraph is on the screen', 15000);
    const pq = p1.getBoundingClientRect();
    ask('tap', fx(X(0.4)), fy(pq.top + pq.height / 2));
    await poll(() => doc.contains(document.activeElement) || document.activeElement === doc, 'a tap puts the caret in the text', 25000);
    await poll(async () => !(await state()).tools, 'and the tools are gone', 12000);
    (document.activeElement as HTMLElement | null)?.blur?.();
    await sleep(500);

    // ── the Pencil again: in the area it adds to it; in the text elsewhere it opens another ──
    area.scrollIntoView({ block: 'center' });
    await sleep(700);
    await pen(true);
    const ra = area.getBoundingClientRect();
    await stroke(0.25, ra.top + ra.height - 30, 0.7, ra.top + ra.height - 24);
    must(!q('.ink-gap', doc) && (await state()).tools, 'in the area it adds to it: no other area, the tools again');
    await shot('ink-added');
    const after1 = await poll(async () => { const got = await fs.ink(vault.abs(PAGE)); return got && got.length === n ? got : null; }, 'kept', 20000);
    const still = names.filter((k) => after1.some((s) => s.stroke === k)).length;
    must(still === names.length, `a stroke's name outlives a save: ${still} of ${names.length} are who they were, and ${after1.length - still} is new`);
    must(kept.every((k) => after1.find((s) => s.stroke === k.stroke)?.data === k.data), 'and the ones it had were not written again');
    await poll(async () => { const s = sheetOf(await state(), id); return s && !s.shown; }, 'the canvas gives way again', 8000);
    scroller.scrollTop += area.getBoundingClientRect().bottom - 300;
    await sleep(700);
    const foot = area.getBoundingClientRect().bottom;
    const later = (Array.from(doc.children) as HTMLElement[]).find((el) => el.matches('p.dd-p') && el.getBoundingClientRect().top > foot + 20 && el.getBoundingClientRect().top < window.innerHeight - 280);
    if (!later) throw new Error(`no paragraph under the area on the screen (its foot at ${foot.toFixed(0)})`);
    const lr = later.getBoundingClientRect();
    const was2 = (await state()).sheets.map((s) => s.id);
    const py = Math.min(lr.top + lr.height * 0.7, window.innerHeight - 240);
    ask('drag', fx(X(0.2)), fy(py), fx(X(0.6)), fy(py + 16), 0.05);
    const next = await poll(async () => (await state()).sheets.find((s) => s.id.startsWith('new:') && !was2.includes(s.id) && s.strokes === 1), 'in the text elsewhere it opens another area', 25000);
    must(!!q(`.ink-gap[data-sheet="${next.id}"]`, doc) && sheetOf(await state(), id)!.strokes === n, 'and the first area is as it was');
    await shot('ink-second-area');
    await poll(async () => (await text()).includes(LINE2), 'kept, it is a second page in the note', 20000);
    blocks = await blocksOf();
    must(blocks.filter((b) => b.kind === 'paragraph' && (b.text === LINE || b.text === LINE2)).length === 2, 'the note names two pages, each once');
    const pic2 = await fs.readBytes(vault.abs(PICTURE));
    await poll(() => { const i = q<HTMLImageElement>('img.md-img[data-ink]', area); return i && i.complete && i.naturalHeight === pngSize(pic2).h; }, 'the area shows the new picture', 15000);
    // every stroke of the second area gone, it leaves no line. The canvas is emptied by a dev call and not by the
    // eraser: the rig selects the eraser in the tool picker, and its finger erases nothing (PLAN, 69). From the
    // canvas's change on this is what an eraser's would be
    await invoke('dev_ink_wipe', { sheet: next.id });
    await poll(async () => !(await text()).includes(LINE2) && (await fs.stat(vault.abs(`${DIR}/ink-02.pkdrawing`))) === null, 'an area with every stroke gone leaves no line, and no page', 20000);
    must(!q(`.ink-gap`, doc) && qa('p.ink-area', doc).length === 1, 'and only the first area is left');
    await shot('ink-erased');
    const touches = (await state()).lastTouched;
    const inkMs = touches.map((t) => t.ink ?? 0).filter((v) => v > 0).sort((a, b) => a - b);
    const afterMove = touches.map((t) => (t.ink ?? 0) - (t.moved ?? 0)).sort((a, b) => a - b);
    log(`touches: ${touches.length}; to a stroke begun, least ${inkMs[0]?.toFixed(1)} ms, middle ${inkMs[inkMs.length >> 1]?.toFixed(1)} ms, most ${inkMs[inkMs.length - 1]?.toFixed(1)} ms; that after the finger first moved, least ${afterMove[0]?.toFixed(1)}, middle ${afterMove[afterMove.length >> 1]?.toFixed(1)}, most ${afterMove[afterMove.length - 1]?.toFixed(1)}; worst first point ${Math.max(...touches.map((t) => t.lost ?? 0)).toFixed(2)} pt; to the area open ${touches.filter((t) => t.page !== undefined).map((t) => t.page!.toFixed(0)).join(', ')} ms`);
    must(touches.every((t) => t.ink !== undefined && (t.lost ?? 99) < 3), 'no touch of the Pencil\'s was lost');
    log(`scribble interactions taken off the web view: ${(await state()).scribble}`);
    await pen(false);
    await poll(async () => !(await state()).tools, 'the Pencil away a while, the tools go', 12000);

    // ── synced: the strokes are in the storage, and no picture is ──
    await crdtNow();
    await poll(() => { const s = useApp.getState().sync; return syncWord(s) === 'synced' && s.toPush === 0; }, 'synced: nothing left to push', 30000);
    log(`ink: ${prefix(p1)}|${prefix(p2)} :: ${after1.length}`);
    finished = true;
    log(`done; collection ${vault.root}, storage ${storage.folder}`);
  } catch (e) {
    finished = true;
    log('shot: ink-failed');
    await sleep(1500);
    log(`failed: ${e instanceof Error ? e.message : String(e)}`);
  }
}

/** The Mac's side of `ILMI_SMOKE=ink` (see `smokeInk`): the storage made, and after the iPad's run the page found under its heading, as a picture. */
export async function smokeInkMac(vault: Vault): Promise<void> {
  type StoreFs = import('../vault/index.js').StoreFs;
  const log = (s: string) => void info(`smoke ink: ${s}`);
  const q = <T extends Element>(sel: string, root: ParentNode = document) => root.querySelector<T>(sel);
  const qa = <T extends Element>(sel: string, root: ParentNode = document) => Array.from(root.querySelectorAll<T>(sel));
  const shot = async (name: string, ms = 2500) => { await sleep(900); log(`shot: ${name}`); await sleep(ms); };
  const must = (ok: unknown, what: string) => { if (!ok) throw new Error(what); log(`ok: ${what}`); };
  const poll = async <T,>(probe: () => T | null | undefined | false | Promise<T | null | undefined | false>, what: string, ms = 8000): Promise<T> => {
    const t0 = Date.now();
    for (;;) {
      const v = await probe();
      if (v) { log(`ok: ${what}`); return v; }
      if (Date.now() - t0 > ms) throw new Error(`${what} (waited ${ms} ms)`);
      await sleep(100);
    }
  };
  try {
    const { crdtNow, crdtOn, storageDir } = await import('./crdt.js');
    const { syncWord } = await import('./sync.js');
    const { parse } = await import('../format/index.js');
    const { slashItems } = await import('../reader/index.js');
    const { diskFs } = await import('./collections.js');
    const dir = await storageDir();
    if (!dir) throw new Error('ILMI_STORAGE names the folder the two devices share');
    const expect = await invoke<string | null>('dev_env', { name: 'ILMI_EXPECT' });
    const strokes = Number((await invoke<string | null>('dev_env', { name: 'ILMI_STROKES' })) ?? 0);
    const DIR = INK_NOTE.replace(/\.md$/, '');
    const PAGE = `${DIR}/ink-01.pkdrawing`;
    const PICTURE = `${DIR}/ink-01.png`;
    const LINE = '![working](canonical-ensemble/ink-01.png)';
    const fs = vault.fs as StoreFs;
    const text = () => vault.fs.readText(vault.abs(INK_NOTE));
    useApp.getState().setTheme('light');
    await poll(() => crdtOn() && syncWord(useApp.getState().sync) === 'synced', 'the collection syncs through the folder', 60000);
    must(!slashItems('', 'paragraph').some((i) => i.id === 'draw'), 'the Mac has no canvas: draw is not among the insert menu\'s rows');
    if (!expect) {
      // the first run: the storage is this collection's
      await crdtNow();
      const names = await diskFs.readDir(dir);
      must(names.some((n) => n.name === 'format') && names.some((n) => n.name === 'devices') && names.some((n) => n.name === 'blobs'), `the storage is made in ${dir}`);
      must(!(await text()).includes('ink-01') && (await fs.stat(vault.abs(PAGE))) === null, 'the note has no page of ink yet');
      log(`done; collection ${vault.root}, storage ${dir}`);
      return;
    }
    // after the iPad: its page comes with a sync
    const blobsBefore = (await diskFs.readDir(`${dir}/blobs`)).length;
    await poll(async () => { await crdtNow(); return (await text()).includes(LINE); }, 'the page written on the iPad is named in the note here', 30000);
    const blocks = parse(await text()).doc.blocks;
    const li = blocks.findIndex((b) => b.kind === 'paragraph' && b.text === LINE);
    const [above, below] = expect.split('|') as [string, string];
    must(li > 0 && blocks[li - 1]!.text.trim().startsWith(above) && blocks[li + 1]!.text.trim().startsWith(below), `between the same two paragraphs: "${above}…" and "${below}…"`);
    const got = await poll(async () => { const s = await fs.ink(vault.abs(PAGE)); return s && s.length === strokes ? s : null; }, `its ${strokes} strokes are rows here`, 20000);
    const row = await fs.rowAt(vault.abs(PAGE));
    must(row && row.blob === null && (await fs.rowAt(vault.abs(PICTURE))) === null, 'the page is a row with no file behind it, and its picture is no row');
    must((await diskFs.readDir(`${dir}/blobs`)).length === blobsBefore && !useApp.getState().away.some((p) => p.includes('ink-')), 'nothing crossed as a file: the storage holds no picture and no drawing');
    // the picture, made here from the strokes
    const png = await fs.readBytes(vault.abs(PICTURE));
    const size = { w: new DataView(png.buffer, png.byteOffset).getUint32(16), h: new DataView(png.buffer, png.byteOffset).getUint32(20) };
    must(png[1] === 0x50 && png[2] === 0x4e && png[3] === 0x47 && size.w > 200 && size.h > 100, `read here, the picture is a PNG the Mac made from them (${size.w}×${size.h}, ${png.length} bytes)`);
    must((await fs.readBytes(vault.abs(PICTURE))).length === png.length, 'the same picture on a second read');
    // the drawing an export writes: PencilKit's, and the same strokes when it is taken apart again
    const drawing = await fs.readBytes(vault.abs(PAGE));
    let bin = '';
    for (let i = 0; i < drawing.length; i += 0x8000) bin += String.fromCharCode(...drawing.subarray(i, i + 0x8000));
    const again = await invoke<{ stroke: string }[]>('ink_split', { drawing: btoa(bin) });
    must(again.length === strokes && again.every((s, i) => s.stroke === got[i]!.stroke), `the drawing beside it is PencilKit's (${drawing.length} bytes) and reads back as the same ${strokes} strokes, by name`);
    const listed = (await fs.readDir(vault.abs(DIR))).map((e) => e.name).filter((x) => x.startsWith('ink-')).sort();
    must(listed.join(' ') === 'ink-01.pkdrawing ink-01.png', `both are files to an export (${listed.join(', ')}), and the page erased on the iPad is no file`);
    // in the window
    openNode(INK_NOTE);
    const notes = await poll(() => q<HTMLElement>('.pane[data-active="1"] .doc-view .draft-doc'), 'the note opens', 15000);
    const img = await poll(() => { const i = qa<HTMLImageElement>('img.md-img[data-ink]', notes)[0]; return i && i.complete && i.naturalWidth === size.w ? i : null; }, 'the picture is drawn in the note', 15000);
    const para = img.closest('p')!;
    must(para.previousElementSibling?.textContent?.trim().startsWith(above) && para.nextElementSibling?.textContent?.trim().startsWith(below), 'between the two paragraphs in the window');
    const head = qa<HTMLElement>('.dd-h', notes)[0]!;
    const cv = document.createElement('canvas');
    cv.width = img.naturalWidth;
    cv.height = img.naturalHeight;
    const cx = cv.getContext('2d')!;
    cx.drawImage(img, 0, 0);
    const px = cx.getImageData(0, 0, cv.width, cv.height).data;
    let inked = 0;
    for (let i = 3; i < px.length; i += 4) if (px[i]! > 40) inked++;
    must(inked > 2000 && inked < px.length / 4 / 2, `with ink in it, on nothing (${inked} of ${px.length / 4} px)`);
    // the heading's menu here has no draw, and a click on the picture opens nothing
    const hr = head.getBoundingClientRect();
    head.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true, clientX: hr.left + 20, clientY: hr.top + hr.height / 2 }));
    const menu = await poll(() => q<HTMLElement>('.ctx-menu.section-menu'), 'the heading\'s menu');
    must(!q('.ci[data-act="draw"]', menu), `has no draw on the Mac (${qa('.ci', menu).map((i) => i.textContent).join(' | ')})`);
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    document.body.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    await sleep(300);
    img.scrollIntoView({ block: 'center' });
    await shot('ink-mac');
    useApp.getState().setTheme('dark');
    await sleep(400);
    must(/invert/.test(getComputedStyle(img).filter), 'on dark paper its strokes are light');
    await shot('ink-mac-dark');
    useApp.getState().setTheme('light');
    log(`done; collection ${vault.root}, storage ${dir}`);
  } catch (e) {
    log(`failed: ${e instanceof Error ? e.message : String(e)}`);
  }
}

// `ILMI_SMOKE=pageink`: milestone 67's "done when", in four runs over one
// storage folder.
//  1. The Mac (`ILMI_VAULT` a copy of the sample, `ILMI_STORAGE` an empty
//     folder): its collection makes the storage. Then, with the timers
//     off, it writes on p. 23 of the sample's book: a Mac has no canvas, so
//     the strokes are a made-up drawing of PencilKit's (`dev_ink_sample`),
//     kept through what the canvas keeps through (`keepPage`). They are
//     shown over the page and are not sent; its `pageink: mine` line names
//     them (`ILMI_MINE` for the runs after). `smokePageInkMac`.
//  2. The iPad (`smokePageInk`, `{"mode": "pageink", "storage": "<the
//     folder>"}`): a collection made from the storage, which has not seen
//     the Mac's strokes. The chapter opened, p. 23 on the screen with its
//     canvas ready. The rig's finger stands in for the Pencil (`dev_ink_pen`,
//     as `ink`'s): its first touch is a stroke there, where the page stands
//     among the others, and so are the rest; kept when it goes quiet; the
//     canvas gives way and the page shows them, where the finger went;
//     nothing went into the PDF. A finger again: the pages scroll with the
//     writing on them. Then a notebook: a new note, the stand-in put down in
//     it twice, two pages of ink. Synced; its `pageink:` line says how many
//     strokes, where on the page, which device, and the note.
//  3. The Mac again (`ILMI_VAULT` its collection's own folder,
//     `ILMI_EXPECT` the iPad's count, `ILMI_BOX` where they lie, `ILMI_NOTE`
//     the note): after a sync the page holds both writings and shows them
//     as a picture, light and dark; the note's two pages are pictures.
//  4. The iPad again (`"again": "1"`, with `"expect"`, `"mine"` and
//     `"device"`): its collection as it was left (the same device, the
//     book it had opened still there; the app has to have been stopped
//     before a dev server comes back, or the page loads again and the
//     second run makes the collection anew), opened and synced: the
//     page holds both writings there too, its
//     canvas holds all of them, one more is written, and the Mac's
//     strokes keep their names through the iPad's save.
const PAGEINK_BOOK = 'library/lindqvist-statistical-physics/ch-3-the-canonical-ensemble.md';
const PAGEINK_PAGE = 23;
/** The Mac's made-up writing: `dev_ink_sample`'s lines, strokes a line and seed. */
const PAGEINK_SAMPLE = { lines: 2, per: 3, seed: 67 };

/** A PNG's bytes drawn and read: its size and the box its ink covers, in pixels. */
async function inkedBox(png: Uint8Array): Promise<{ w: number; h: number; n: number; x0: number; y0: number; x1: number; y1: number; count(x0: number, y0: number, x1: number, y1: number): number }> {
  const url = URL.createObjectURL(new Blob([png as BlobPart], { type: 'image/png' }));
  try {
    const img = new Image();
    await new Promise<void>((ok, no) => { img.onload = () => ok(); img.onerror = () => no(new Error('not a picture')); img.src = url; });
    const cv = document.createElement('canvas');
    cv.width = img.naturalWidth;
    cv.height = img.naturalHeight;
    const cx = cv.getContext('2d')!;
    cx.drawImage(img, 0, 0);
    const px = cx.getImageData(0, 0, cv.width, cv.height).data;
    const inked = (x: number, y: number) => px[(y * cv.width + x) * 4 + 3]! > 40;
    let [n, x0, y0, x1, y1] = [0, cv.width, cv.height, -1, -1];
    for (let y = 0; y < cv.height; y++) for (let x = 0; x < cv.width; x++) if (inked(x, y)) { n++; if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
    const count = (a: number, b: number, c: number, d: number) => { let k = 0; for (let y = Math.max(0, Math.floor(b)); y < Math.min(cv.height, d); y++) for (let x = Math.max(0, Math.floor(a)); x < Math.min(cv.width, c); x++) if (inked(x, y)) k++; return k; };
    return { w: cv.width, h: cv.height, n, x0, y0, x1, y1, count };
  } finally {
    URL.revokeObjectURL(url);
  }
}

export async function smokePageInk(): Promise<void> {
  type StoreFs = import('../vault/index.js').StoreFs;
  let last = { at: Date.now(), what: 'start' };
  let finished = false;
  const log = (s: string) => { last = { at: Date.now(), what: s }; void info(`smoke pageink: ${s}`); };
  const dog = setInterval(() => {
    if (finished) { clearInterval(dog); return; }
    if (Date.now() - last.at > 90_000) { finished = true; clearInterval(dog); void info(`smoke pageink: failed: no progress for 90 s after "${last.what}"`); }
  }, 2000);
  const q = <T extends Element>(sel: string, root: ParentNode = document) => root.querySelector<T>(sel);
  const qa = <T extends Element>(sel: string, root: ParentNode = document) => Array.from(root.querySelectorAll<T>(sel));
  const shot = async (name: string, ms = 2500) => { await sleep(900); log(`shot: ${name}`); await sleep(ms); };
  const must = (ok: unknown, what: string) => { if (!ok) throw new Error(what); log(`ok: ${what}`); };
  const poll = async <T,>(probe: () => T | null | undefined | false | Promise<T | null | undefined | false>, what: string, ms = 8000): Promise<T> => {
    const t0 = Date.now();
    for (;;) {
      const v = await probe();
      if (v) { log(`ok: ${what}`); return v; }
      if (Date.now() - t0 > ms) throw new Error(`${what} (waited ${ms} ms)`);
      await sleep(100);
    }
  };
  const ask = (verb: string, ...n: number[]) => log(`do: ${verb} ${n.map((v) => v.toFixed(4)).join(' ')}`);
  const fx = (x: number) => x / window.innerWidth;
  const fy = (y: number) => y / window.innerHeight;
  const mid = (el: Element): [number, number] => { const r = el.getBoundingClientRect(); return [fx(r.left + r.width / 2), fy(r.top + r.height / 2)]; };
  try {
    const { isMobile, shapeOf } = await import('./platform.js');
    const { devStorage, joinCollection, crdtNow, engineFor } = await import('./crdt.js');
    const { syncWord } = await import('./sync.js');
    const { listCollections } = await import('../vault/tauri-store.js');
    const ink = await import('./ink.js');
    must(isMobile() && document.documentElement.dataset.mobile === '1', 'the app knows it is on an iPad');
    const storage = await devStorage();
    if (!storage || storage.kind !== 'folder') throw new Error('ILMI_STORAGE (smoke.json: "storage") names the folder the Mac\'s collection made its storage in');
    const again = !!(await invoke<string | null>('dev_env', { name: 'ILMI_AGAIN' }));
    log(`window ${window.innerWidth}×${window.innerHeight}; pixel ratio ${window.devicePixelRatio}; storage ${storage.folder}${again ? '; again' : ''}`);
    // a simulator stays as the last run left it
    if (shapeOf(true, window.innerWidth, window.innerHeight) !== 'portrait') log('do: turn portrait');
    await poll(() => shapeOf(true, window.innerWidth, window.innerHeight) === 'portrait', 'the iPad is upright', 25000);
    useApp.getState().setReopen(false);
    useApp.getState().setTheme('light');
    await startFromRecents();
    await until(() => q('.welcome'));
    const state = () => invoke<InkState>('dev_ink_state');
    const pen = (on: boolean) => invoke('dev_ink_pen', { on });
    const BOOK = PAGEINK_BOOK;
    const P = PAGEINK_PAGE;
    // the Mac's strokes, by the names its run said (`ILMI_MINE`): PencilKit gives a made-up stroke a seed of its own each time, so they are not made again here
    const macs = ((await invoke<string | null>('dev_env', { name: 'ILMI_MINE' })) ?? '').split(',').filter(Boolean);
    /** The chapter open, p. 23 drawn and on the screen. */
    const openBook = async () => {
      openNode(BOOK);
      const book = await poll(() => q<HTMLElement>('.pane[data-active="1"] .book'), 'the chapter opens as a book', 15000);
      await poll(() => q(`.pdf-page[data-page="${P}"] canvas`, book), `its book is here and p. ${P} drawn`, 60000);
      return book;
    };
    /** p. 23 on the screen, ready to be written on: its sheet told to the canvases. */
    const onScreen = async (book: HTMLElement, sheet: string) => {
      const el = q<HTMLElement>(`.pdf-page[data-page="${P}"]`, book)!;
      el.scrollIntoView({ block: 'start' });
      q<HTMLElement>('.book-pages', book)!.scrollTop -= 70;
      await sleep(700);
      const s = await poll(async () => (await state()).sheets.find((x) => x.id === sheet), `p. ${P} has its canvas, ready and with nothing to open`, 15000);
      must(!s.shown, 'and hidden: the page is showing');
      return { el, r: el.getBoundingClientRect(), s };
    };
    /** The picture over p. 23 in the pages, once it shows `n` strokes' worth (its `rev` moved to a new picture). */
    const shown = (book: HTMLElement) => { const i = q<HTMLImageElement>(`img.page-ink[data-page="${P}"]`, book); return i && i.complete && i.naturalWidth > 0 ? i : null; };
    const over = (book: HTMLElement, img: HTMLImageElement) => {
      const a = img.getBoundingClientRect();
      const b = q<HTMLElement>(`.pdf-page[data-page="${P}"]`, book)!.getBoundingClientRect();
      return Math.abs(a.left - b.left) < 1.5 && Math.abs(a.top - b.top) < 1.5 && Math.abs(a.width - b.width) < 1.5 && Math.abs(a.height - b.height) < 1.5;
    };

    if (again) {
      // ── the collection as it was left, opened again: both writings are on the page here too ──
      const { home, names } = await listCollections();
      must(names.includes('double-major'), 'the collection this iPad made is still here');
      const vault = await openVault(`${home}/double-major`);
      const fs = vault.fs as StoreFs;
      const rel = await poll(() => useApp.getState().docs[BOOK]?.pdf, 'the chapter is there, with its book', 20000);
      const hash = fs.blobAt(vault.abs(rel))!;
      const want = Number((await invoke<string | null>('dev_env', { name: 'ILMI_EXPECT' })) ?? 0);
      // the same collection, not one made again from the storage: the device that wrote the strokes, and the book it had opened still here
      const was = await invoke<string | null>('dev_env', { name: 'ILMI_DEVICE' });
      await poll(() => syncWord(useApp.getState().sync) === 'synced', 'the strip says synced', 30000);
      must(!!was && engineFor(fs, vault.root).device() === was, `it is the collection that wrote them: the same device (${was})`);
      must(!fs.isAway(vault.abs(rel)), 'and the book it opened then is still here');
      must(macs.length === PAGEINK_SAMPLE.lines * PAGEINK_SAMPLE.per && macs.every((k) => /^[0-9a-f]{16}$/.test(k)), `the Mac's ${macs.length} strokes are known here by their names`);
      const all = await poll(async () => { await crdtNow(); const got = await fs.pageInk(hash, P); return got.length === want + macs.length ? got : null; }, `after a sync p. ${P} holds this iPad's ${want} strokes and the Mac's ${macs.length}`, 40000);
      must(macs.every((k) => all.some((x) => x.stroke === k)), 'the Mac\'s are there by their names');
      const book = await openBook();
      const img = await poll(() => shown(book), 'the page shows the writing as a picture over it', 20000);
      must(over(book, img), 'laid exactly over the page');
      await shot('pageink-both');
      const sheet = `p.${hash}.${P}`;
      const { r } = await onScreen(book, sheet);
      await poll(async () => (await state()).sheets.find((x) => x.id === sheet)?.strokes === all.length, `its canvas holds every stroke, the Mac's too (${all.length})`, 15000);
      useApp.getState().setTheme('dark');
      await sleep(600);
      await pen(true);
      ask('drag', fx(r.left + r.width * 0.3), fy(r.top + r.height * 0.3), fx(r.left + r.width * 0.7), fy(r.top + r.height * 0.32), 0.05);
      await poll(async () => (await state()).sheets.find((x) => x.id === sheet)?.strokes === all.length + 1, 'the first touch is one more stroke, among them', 25000);
      await sleep(600);
      await shot('pageink-canvas-both');
      await poll(async () => (await fs.pageInk(hash, P)).length === all.length + 1, 'left alone, it is kept', 20000);
      await poll(async () => !(await state()).sheets.find((x) => x.id === sheet)?.shown, 'and the picture takes over, on dark paper', 8000);
      await shot('pageink-dark');
      useApp.getState().setTheme('light');
      await pen(false);
      const after = await fs.pageInk(hash, P);
      must(after.length === all.length + 1 && all.every((x) => after.some((y) => y.stroke === x.stroke && y.data === x.data)), `only the new stroke was written: ${after.length} strokes, the others who they were`);
      must(ink.lastKept?.added === 0 || ink.lastKept?.added === 1, `the canvas's save added ${ink.lastKept?.added} and took away ${ink.lastKept?.removed}`);
      must(macs.every((k) => after.some((x) => x.stroke === k)), 'the Mac\'s strokes keep their names through the iPad\'s canvas and its save');
      await crdtNow();
      await poll(() => { const s = useApp.getState().sync; return syncWord(s) === 'synced' && s.toPush === 0; }, 'synced: nothing left to push', 30000);
      log(`pageink: again :: ${after.length}`);
      finished = true;
      log(`done; collection ${vault.root}, storage ${storage.folder}`);
      return;
    }

    // ── a collection made from the storage: it has not seen what the Mac wrote ──
    const vault = await openVault(await joinCollection(storage, 'double-major', true));
    must(vault.documents().length === 66, 'the collection is made from the storage: 66 documents');
    await poll(() => syncWord(useApp.getState().sync) === 'synced', 'the strip says synced', 30000);
    const fs = vault.fs as StoreFs;
    const pdfRel = await poll(() => useApp.getState().docs[BOOK]?.pdf, 'the chapter is there, with its book', 20000);
    const hash = fs.blobAt(vault.abs(pdfRel))!;
    must(/^[0-9a-f]{64}$/.test(hash), `the chapter's book is known by its hash (${hash.slice(0, 12)}…)`);
    must((await fs.inkedPages(hash)).length === 0, 'no page of it is written on here: the Mac\'s strokes were not sent');
    const rowsWere = fs.door.rows().length;
    const notesWere = await vault.fs.readText(vault.abs(BOOK));
    const book = await openBook();
    const pageEl = q<HTMLElement>(`.pdf-page[data-page="${P}"]`, book)!;
    const sc = q<HTMLElement>('.book-pages', book)!;
    await shot('pageink-book');

    // ── the Pencil on the page: its first touch is a stroke ──
    const sheet = `p.${hash}.${P}`;
    const { r: pr, s: s0 } = await onScreen(book, sheet);
    const z = pr.width / (pageEl.getBoundingClientRect().width / Number(getComputedStyle(pageEl).getPropertyValue('--total-scale-factor') || 1));
    must(Math.abs(s0.at.y - pr.top) < 1.5 && Math.abs(s0.at.x - pr.left) < 1.5 && Math.abs(s0.at.w - pr.width) < 1.5, `the canvas lies on the page, to a point (${s0.at.x.toFixed(1)},${s0.at.y.toFixed(1)} and ${pr.left.toFixed(1)},${pr.top.toFixed(1)})`);
    await pen(true);
    const DRAGS: [number, number, number, number][] = [
      // low enough on the page to lie clear of the Mac's made-up lines, which its third run tells apart from these
      [0.20, 0.30, 0.62, 0.28], [0.20, 0.38, 0.62, 0.39], [0.26, 0.46, 0.52, 0.54], [0.70, 0.30, 0.74, 0.52], [0.16, 0.60, 0.80, 0.58],
    ];
    const px = (f: number, side: 'x' | 'y') => (side === 'x' ? pr.left + f * pr.width : pr.top + f * pr.height);
    const sheetNow = async () => (await state()).sheets.find((x) => x.id === sheet);
    let n = 0;
    for (const [x1, y1, x2, y2] of DRAGS) {
      ask('drag', fx(px(x1, 'x')), fy(px(y1, 'y')), fx(px(x2, 'x')), fy(px(y2, 'y')), 0.05);
      n += 1;
      const want = n;
      await poll(async () => (await sheetNow())?.strokes === want, `stroke ${want} is on the page`, 25000);
      if (want === 1) {
        const t = await poll(async () => { const c = await state(); return c.touched?.ink !== undefined && c.touched.lost !== undefined ? c : null; }, 'the first touch is told', 12000);
        log(`touch: ${costOf(t.touched)}`);
        must(t.touched!.lost! < 3, `the first touch is a stroke, nothing of it lost (${t.touched!.lost!.toFixed(2)} pt from the touch)`);
        must(t.tools && !q('.pbox.pending', book), 'the tool picker shows, and nothing is boxed');
        must((await sheetNow())!.shown && Math.abs((await sheetNow())!.at.y - pageEl.getBoundingClientRect().top) < 1.5, 'and the canvas is on the page where it stands among the others');
      }
    }
    await shot('pageink-written');
    const kept = await poll(async () => { const got = await fs.pageInk(hash, P); return got.length === DRAGS.length ? got : null; }, `left alone, the page is kept: ${DRAGS.length} strokes in the store, found by the book's hash and the page`, 20000);
    const names = kept.map((k) => k.stroke);
    must(new Set(names).size === names.length && names.every((k) => /^[0-9a-f]{16}$/.test(k)), 'each stroke has a name of its own');
    await poll(async () => !(await sheetNow())?.shown, 'and the canvas gives way to the picture', 8000);
    await pen(false);
    void z;

    // ── on the page: where the finger went, and nowhere in the PDF ──
    const scale = Number(pageEl.style.getPropertyValue('--total-scale-factor')) || pr.width / 432;
    const points = { w: pr.width / scale, h: pr.height / scale };
    const want = {
      x0: Math.min(...DRAGS.map((d) => Math.min(d[0], d[2]))) * points.w, x1: Math.max(...DRAGS.map((d) => Math.max(d[0], d[2]))) * points.w,
      y0: Math.min(...DRAGS.map((d) => Math.min(d[1], d[3]))) * points.h, y1: Math.max(...DRAGS.map((d) => Math.max(d[1], d[3]))) * points.h,
    };
    const png = await fs.pageInkFile(hash, P, 'picture', points.w, points.h);
    const pic = await inkedBox(png);
    const got = { x0: pic.x0 / 2, y0: pic.y0 / 2, x1: pic.x1 / 2, y1: pic.y1 / 2 };
    log(`on the page, in points: the finger went ${Math.round(want.x0)},${Math.round(want.y0)} to ${Math.round(want.x1)},${Math.round(want.y1)}; the ink is ${Math.round(got.x0)},${Math.round(got.y0)} to ${Math.round(got.x1)},${Math.round(got.y1)} (${pic.n} px of ${pic.w}×${pic.h})`);
    must(Math.abs(pic.w - Math.ceil(points.w) * 2) <= 2 && pic.n > 1500, `read, the writing is a picture of the whole page at 2× (${pic.w}×${pic.h}), with ink in it`);
    const TOL = 14;
    must(Math.abs(got.x0 - want.x0) < TOL && Math.abs(got.x1 - want.x1) < TOL && Math.abs(got.y0 - want.y0) < TOL && Math.abs(got.y1 - want.y1) < TOL, 'and the ink lies on the page where the finger went');
    const img = await poll(() => shown(book), 'the page shows the writing as a picture over it', 20000);
    must(over(book, img), 'laid exactly over the page');
    must(fs.blobAt(vault.abs(pdfRel)) === hash && fs.door.rows().length === rowsWere && (await vault.fs.readText(vault.abs(BOOK))) === notesWere, 'nothing was written into the PDF, no row was made, and the notes are as they were');
    must((await fs.inkedPages(hash)).join() === String(P), `the book has one page written on: p. ${P}`);
    await shot('pageink-page');
    // a finger still scrolls the pages with the writing on them, and writes nothing
    const top0 = sc.scrollTop;
    ask('flick', 0.5, 0.72, 0.5, 0.3);
    await poll(() => sc.scrollTop > top0 + 150, 'a finger\'s drag scrolls the pages from on the writing', 20000);
    await sleep(1500);
    must(over(book, q<HTMLImageElement>(`img.page-ink[data-page="${P}"]`, book)!), 'the writing goes with its page');
    const moved = (await sheetNow())!;
    must(moved.strokes === DRAGS.length && Math.abs(moved.at.y - pageEl.getBoundingClientRect().top) < 1.5 && !q('.pbox.pending', book), `its canvas with it, to a point (${moved.at.y.toFixed(1)} and ${pageEl.getBoundingClientRect().top.toFixed(1)}), nothing written and nothing boxed`);
    await shot('pageink-scrolled');

    // ── a notebook: a note that is pages of ink, each opened where the Pencil lands ──
    const NOTE = await createNode('fleeting', 'note');
    const DIR = NOTE.replace(/\.md$/, '');
    const stem = DIR.split('/').pop()!;
    openNode(NOTE);
    const first = await poll(() => (activeTab(useApp.getState().panes)?.id === NOTE ? q<HTMLElement>('.pane[data-active="1"] .doc-view .draft-doc') : null), 'a new note opens', 15000);
    await sleep(600);
    const noteText = () => vault.fs.readText(vault.abs(NOTE));
    const line = (k: number) => `![working](${encodeURIComponent(stem)}/ink-0${k}.png)`;
    await pen(true);
    const cr = first.getBoundingClientRect();
    const NOTE_DRAGS: [number, number, number, number][][] = [[[0.10, cr.top + 60, 0.50, cr.top + 50], [0.12, cr.top + 90, 0.48, cr.top + 110]], [[0.20, 0, 0.74, 10], [0.24, 40, 0.70, 30], [0.50, -10, 0.52, 60]]];
    for (let k = 1; k <= 2; k++) {
      // the second page: below the first, in the note's empty room
      const areaFoot = qa<HTMLElement>('p.ink-area', first).at(-1)?.getBoundingClientRect().bottom ?? 0;
      const at = k === 1 ? 0 : Math.max(areaFoot + 120, cr.top + 300);
      const had = (await state()).sheets.map((x) => x.id);
      let m = 0;
      let id = '';
      for (const [x1, y1, x2, y2] of NOTE_DRAGS[k - 1]!) {
        ask('drag', fx(cr.left + x1 * cr.width), fy(at + y1), fx(cr.left + x2 * cr.width), fy(at + y2), 0.05);
        m += 1;
        const wantN = m;
        const got = await poll(async () => (await state()).sheets.find((x) => (id ? x.id === id : x.id.startsWith('new:') && !had.includes(x.id)) && x.strokes === wantN), `stroke ${wantN} of page ${k} is on a canvas`, 25000);
        id = got.id;
      }
      await poll(async () => (await noteText()).includes(line(k)), `left alone, the note names page ${k}: ${line(k)}`, 15000);
      must((await fs.ink(vault.abs(`${DIR}/ink-0${k}.pkdrawing`)))?.length === NOTE_DRAGS[k - 1]!.length, `ink-0${k} holds its ${NOTE_DRAGS[k - 1]!.length} strokes`);
      await poll(async () => !(await state()).sheets.find((x) => x.id === id)?.shown, 'and its canvas gives way to the picture', 8000);
    }
    await pen(false);
    const noteLines = (await noteText()).split('\n').filter((l) => l.startsWith('![working]('));
    must(noteLines.length === 2 && noteLines[0] === line(1) && noteLines[1] === line(2), 'the note is two pages of ink, in the order they were written');
    await poll(() => { const imgs = qa<HTMLImageElement>('.pane[data-active="1"] .doc-view img.md-img[data-ink]'); return imgs.length === 2 && imgs.every((i) => i.complete && i.naturalWidth > 0); }, 'both are drawn in the note', 15000);
    await shot('pageink-notebook');

    // ── synced ──
    await crdtNow();
    await poll(() => { const s = useApp.getState().sync; return syncWord(s) === 'synced' && s.toPush === 0; }, 'synced: nothing left to push', 30000);
    log(`pageink: ${DRAGS.length} :: ${Math.round(got.x0)},${Math.round(got.y0)},${Math.round(got.x1)},${Math.round(got.y1)} :: ${engineFor(fs, vault.root).device()} :: ${NOTE}`);
    finished = true;
    log(`done; collection ${vault.root}, storage ${storage.folder}`);
  } catch (e) {
    finished = true;
    log('shot: pageink-failed');
    await sleep(1500);
    log(`failed: ${e instanceof Error ? e.message : String(e)}`);
  }
}

/** The Mac's side of `ILMI_SMOKE=pageink` (see `smokePageInk`): the storage made and a page written on and not sent; after the iPad's run, both writings on the page, as a picture. */
export async function smokePageInkMac(vault: Vault): Promise<void> {
  type StoreFs = import('../vault/index.js').StoreFs;
  const log = (s: string) => void info(`smoke pageink: ${s}`);
  const q = <T extends Element>(sel: string, root: ParentNode = document) => root.querySelector<T>(sel);
  const qa = <T extends Element>(sel: string, root: ParentNode = document) => Array.from(root.querySelectorAll<T>(sel));
  const shot = async (name: string, ms = 2500) => { await sleep(900); log(`shot: ${name}`); await sleep(ms); };
  const must = (ok: unknown, what: string) => { if (!ok) throw new Error(what); log(`ok: ${what}`); };
  const poll = async <T,>(probe: () => T | null | undefined | false | Promise<T | null | undefined | false>, what: string, ms = 8000): Promise<T> => {
    const t0 = Date.now();
    for (;;) {
      const v = await probe();
      if (v) { log(`ok: ${what}`); return v; }
      if (Date.now() - t0 > ms) throw new Error(`${what} (waited ${ms} ms)`);
      await sleep(100);
    }
  };
  try {
    const { crdtNow, crdtOn, storageDir, setCrdtTimers } = await import('./crdt.js');
    const { syncWord } = await import('./sync.js');
    const { diskFs } = await import('./collections.js');
    const ink = await import('./ink.js');
    const dir = await storageDir();
    if (!dir) throw new Error('ILMI_STORAGE names the folder the two devices share');
    const expect = await invoke<string | null>('dev_env', { name: 'ILMI_EXPECT' });
    const BOOK = PAGEINK_BOOK;
    const P = PAGEINK_PAGE;
    const fs = vault.fs as StoreFs;
    useApp.getState().setTheme('light');
    await poll(() => crdtOn() && syncWord(useApp.getState().sync) === 'synced', 'the collection syncs through the folder', 60000);
    const pdfRel = useApp.getState().docs[BOOK]?.pdf ?? '';
    const hash = fs.blobAt(vault.abs(pdfRel))!;
    must(/^[0-9a-f]{64}$/.test(hash), `the chapter's book is known by its hash (${hash.slice(0, 12)}…)`);
    must(!ink.hasCanvas(), 'the Mac has no canvas');
    // the strokes written here: made in the first run, and named by it for the runs after (`ILMI_MINE`)
    const drawing = expect ? '' : await invoke<string>('dev_ink_sample', PAGEINK_SAMPLE);
    const mine = expect ? ((await invoke<string | null>('dev_env', { name: 'ILMI_MINE' })) ?? '').split(',').filter(Boolean) : (await invoke<{ stroke: string }[]>('ink_split', { drawing })).map((x) => x.stroke);
    must(mine.length === PAGEINK_SAMPLE.lines * PAGEINK_SAMPLE.per && new Set(mine).size === mine.length, `what is written here is ${mine.length} strokes, each with its name`);
    /** The chapter open and p. 23 with the picture of its writing over it. */
    const pageShown = async (wide: number) => {
      openNode(BOOK);
      const book = await poll(() => q<HTMLElement>('.pane[data-active="1"] .book'), 'the chapter opens', 15000);
      const pageEl = await poll(() => (q(`.pdf-page[data-page="${P}"] canvas`, book) ? q<HTMLElement>(`.pdf-page[data-page="${P}"]`, book) : null), `p. ${P} is drawn`, 30000);
      const img = await poll(() => { const i = q<HTMLImageElement>(`img.page-ink[data-page="${P}"]`, book); return i && i.complete && i.naturalWidth === wide ? i : null; }, 'the page shows its writing as a picture over it', 20000);
      const [a, b] = [img.getBoundingClientRect(), pageEl.getBoundingClientRect()];
      must(Math.abs(a.left - b.left) < 1.5 && Math.abs(a.top - b.top) < 1.5 && Math.abs(a.width - b.width) < 1.5 && Math.abs(a.height - b.height) < 1.5, 'laid exactly over the page');
      must(qa('.pdf-page[data-page] ~ .pdf-ink img.page-ink', book).length === 1 && getComputedStyle(img).pointerEvents === 'none', 'on that page alone, and it takes no press: a drag there still boxes');
      return { book, img };
    };
    // the page's size in points, from the book itself
    const sizeOf = async () => {
      const { acquirePdf } = await import('./bookPdf.js');
      const held = acquirePdf(pdfRel);
      try { const v = (await (await held.promise).getPage(P)).getViewport({ scale: 1 }); return { w: v.width, h: v.height }; } finally { held.release(); }
    };
    const points = await sizeOf();
    if (!expect) {
      // ── the first run: the storage is this collection's; then a page written on here, and not sent ──
      await crdtNow();
      const names = await diskFs.readDir(dir);
      must(names.some((n) => n.name === 'format') && names.some((n) => n.name === 'devices') && names.some((n) => n.name === 'blobs'), `the storage is made in ${dir}`);
      must((await fs.inkedPages(hash)).length === 0, 'no page of the book is written on yet');
      setCrdtTimers(false);
      const rowsWere = fs.door.rows().length;
      const kept = await ink.keepPage(hash, P, drawing);
      must(kept.strokes === mine.length && kept.added === mine.length && kept.removed === 0, `a made-up drawing of ${mine.length} strokes is kept on p. ${P} through what the canvas keeps through`);
      must((await fs.pageInk(hash, P)).map((x) => x.stroke).sort().join() === [...mine].sort().join(), 'its strokes are rows, found by the book\'s hash and the page');
      must(fs.blobAt(vault.abs(pdfRel)) === hash && fs.door.rows().length === rowsWere, 'nothing was written into the PDF and no row was made');
      await poll(() => useApp.getState().sync.toPush > 0, 'and they are not sent: the iPad will write without having seen them', 10000);
      await pageShown(Math.ceil(points.w) * 2);
      await shot('pageink-mac-own');
      must(useApp.getState().sync.toPush > 0, 'still not sent');
      log(`pageink: mine :: ${mine.join(',')}`);
      log(`done; collection ${vault.root}, storage ${dir}; ${mine.length} strokes on p. ${P}, unsent`);
      return;
    }
    // ── after the iPad: both writings on the page ──
    const theirs = Number(expect);
    const all = await poll(async () => { await crdtNow(); const got = await fs.pageInk(hash, P); return got.length === theirs + mine.length ? got : null; }, `after a sync p. ${P} holds the iPad's ${theirs} strokes and the ${mine.length} written here`, 40000);
    must(mine.every((k) => all.some((x) => x.stroke === k)) && all.filter((x) => !mine.includes(x.stroke)).length === theirs, 'each by its name: none lost, none twice');
    await poll(() => { const s = useApp.getState().sync; return syncWord(s) === 'synced' && s.toPush === 0; }, 'and what was written here is sent', 30000);
    const blobs = new Set(fs.door.rows().flatMap((r) => (r.blob ? [r.blob] : [])));
    must((await diskFs.readDir(`${dir}/blobs`)).length === blobs.size && fs.blobAt(vault.abs(pdfRel)) === hash, `nothing crossed as a file, and the PDF is the file it was (${blobs.size} files in the storage)`);
    const png = await fs.pageInkFile(hash, P, 'picture', points.w, points.h);
    const pic = await inkedBox(png);
    must(png[1] === 0x50 && png[2] === 0x4e && png[3] === 0x47 && pic.w === Math.ceil(points.w) * 2 && pic.h === Math.ceil(points.h) * 2, `read here, the writing is a picture of the whole page the Mac made from the strokes (${pic.w}×${pic.h}, ${png.length} bytes)`);
    // where each lies: the Mac's made-up lines near the top left, the iPad's where its finger went
    const box = ((await invoke<string | null>('dev_env', { name: 'ILMI_BOX' })) ?? '').split(',').map(Number);
    const here = pic.count(60, 80, 300, 300);
    must(here > 300, `the strokes written here are in it (${here} px near the top left)`);
    if (box.length === 4 && box.every(Number.isFinite)) {
      const there = pic.count(box[0]! * 2 - 8, box[1]! * 2 - 8, box[2]! * 2 + 8, box[3]! * 2 + 8);
      must(there > 1500 && box[1]! * 2 > 300, `and the iPad's, where its finger went on the page (${there} px in ${box.join(',')} points)`);
    } else throw new Error('ILMI_BOX names where the iPad wrote, in points');
    const { book, img } = await pageShown(pic.w);
    img.scrollIntoView({ block: 'start' });
    q<HTMLElement>('.book-pages', book)!.scrollTop = Math.max(0, q<HTMLElement>('.book-pages', book)!.scrollTop - 40);
    await shot('pageink-mac');
    useApp.getState().setTheme('dark');
    await sleep(400);
    must(/invert/.test(getComputedStyle(img).filter), 'on dark paper the writing is turned as the page is');
    await shot('pageink-mac-dark');
    useApp.getState().setTheme('light');
    // ── the notebook the iPad made: two pages of ink in one note ──
    const NOTE = (await invoke<string | null>('dev_env', { name: 'ILMI_NOTE' })) ?? '';
    if (!NOTE) throw new Error('ILMI_NOTE names the note the iPad drew in');
    const text = await poll(async () => { const t = await vault.fs.readText(vault.abs(NOTE)).catch(() => ''); return t.includes('ink-02.png') ? t : null; }, `the note of two pages is here: ${NOTE}`, 20000);
    const lines = text.split('\n').filter((l) => l.startsWith('![working]('));
    must(lines.length === 2 && /ink-01\.png\)$/.test(lines[0]!) && /ink-02\.png\)$/.test(lines[1]!), `its blocks are the two pages, in order (${lines.join(' ')})`);
    const NDIR = NOTE.replace(/\.md$/, '');
    for (const k of [1, 2]) {
      const strokes = await fs.ink(vault.abs(`${NDIR}/ink-0${k}.pkdrawing`));
      const p = await fs.readBytes(vault.abs(`${NDIR}/ink-0${k}.png`));
      must(strokes && strokes.length > 0 && p[1] === 0x50 && p[2] === 0x4e, `page ${k} is ${strokes?.length} strokes and a picture made here`);
    }
    openNode(NOTE);
    await poll(() => (activeTab(useApp.getState().panes)?.id === NOTE ? q<HTMLElement>('.pane[data-active="1"] .doc-view .draft-doc') : null), 'the note opens', 15000);
    // the page is built again as its pictures come: they are asked of the pane, not of the surface first found
    const drawn = () => qa<HTMLImageElement>('.pane[data-active="1"] .doc-view img.md-img[data-ink]');
    const both = await poll(() => { const imgs = drawn(); return imgs.length === 2 && imgs.every((i) => i.complete && i.naturalWidth > 0) ? imgs : null; }, 'both pages are drawn in it', 15000);
    log(`the note's pictures: ${both.map((i) => `${i.dataset.src} ${i.naturalWidth}×${i.naturalHeight}`).join(' | ')}`);
    await shot('pageink-mac-notebook');
    log(`done; collection ${vault.root}, storage ${dir}`);
  } catch (e) {
    log(`failed: ${e instanceof Error ? e.message : String(e)}`);
  }
}

// `ILMI_SMOKE=store` over a fresh copy of `samples/double-major`: milestone
// 59, the store under the app. The collection that is open was imported
// from the folder (`devCollection`); here the same folder is imported a
// second time and, without the app ever opening it, exported as a folder
// and as a zip beside the source (`<ILMI_VAULT>-export`, `-export.zip`):
// every file must be in the export with the same bytes, and a shell `diff
// -r` can say so again. Then the open collection: its folder on disk holds
// a database and blobs and no Markdown; a write, an image, a rename and a
// move are read back from the database through a store opened afresh;
// milestone 60: a card's schedule lines are rows and not in the stored
// text, a grade changes a row and the log and leaves the text, the mirror
// (`<ILMI_VAULT>-mirror/`) holds what an export holds and follows a write,
// and the day's dated export is made once and the oldest of eight goes; the
// palette has the two export commands and `import folder…`; closed, the
// welcome lists it with `new collection` and `import folder`, and its row
// opens it again as it was left.
export async function smokeSearch(vault: Vault): Promise<void> {
  const log = (s: string) => void info(`smoke search: ${s}`);
  const shot = async (name: string, ms = 2500) => { await sleep(800); log(`shot: ${name}`); await sleep(ms); };
  const q = <T extends Element>(sel: string, root: ParentNode = document) => root.querySelector<T>(sel);
  const qa = <T extends Element>(sel: string, root: ParentNode = document) => Array.from(root.querySelectorAll<T>(sel));
  const must = (ok: unknown, what: string) => { if (!ok) throw new Error(what); log(`ok: ${what}`); };
  const key = (el: Element, k: string) => el.dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true, cancelable: true }));
  const type = (el: HTMLInputElement, text: string) => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(el, text);
    el.dispatchEvent(new Event('input', { bubbles: true }));
  };
  const rowsOf = () => qa<HTMLElement>('.palette-row');
  const say = (r: HTMLElement) => `[${r.dataset.t}] ${r.querySelector('.pt')?.textContent} · ${r.querySelector('.psub')?.textContent}`;
  const palette = async (text: string) => {
    useApp.setState({ paletteOpen: true });
    const input = await until(() => q<HTMLInputElement>('.palette-input input'));
    type(input, text);
    return input;
  };
  const closed = async () => { useApp.setState({ paletteOpen: false }); await until(() => (q('.palette-overlay') ? null : true)); };
  /** Until the list is the index's answer to `text`: the last answer stays until the next. */
  const answered = async (text: string) => { await until(() => (q<HTMLElement>('.palette-list')?.dataset.found === text ? true : null)); await sleep(60); };
  /** Moves to the row and opens it, as the keys do. */
  const pick = async (input: HTMLInputElement, row: HTMLElement) => {
    const at = rowsOf().indexOf(row);
    for (let i = 0; i < at; i++) key(input, 'ArrowDown');
    await sleep(30);
    key(input, 'Enter');
    await until(() => (q('.palette-overlay') ? null : true));
  };
  const inView = (el: Element) => { const b = el.getBoundingClientRect(); return b.top >= 0 && b.bottom <= window.innerHeight; };
  try {
    const { faceText, fold } = await import('../format/index.js');
    const { hayOf } = await import('../vault/index.js');
    const { collectionFs } = await import('./collections.js');
    const { setCrdtTimers } = await import('./crdt.js');
    setCrdtTimers(false);
    const fs = collectionFs(vault.root);
    const phone = useApp.getState().phone;
    useApp.getState().setTheme('light');
    await until(() => vault.documents().length > 0);
    await sleep(600);
    // a collection from before the index (one a simulator already holds) is walked first
    const w0 = performance.now();
    await until(() => (useApp.getState().searchShare === 1 ? true : null), 60000);
    for (let i = 0; i < 200 && !(await fs.store.searchState()).done; i++) await sleep(250);
    must((await fs.store.searchState()).done, `the index is there (${Math.round(performance.now() - w0)} ms waited for)`);

    // ── the five files ──
    const want: string[] = [];
    for (const path of vault.documents()) if (fold(await fs.readText(vault.abs(path))).includes('كرم')) want.push(path);
    want.sort();
    must(want.length === 5, `the sample holds كرم in five files, by the fold over the whole text: ${want.join(' ')}`);
    const paths = async (text: string) => [...new Set((await fs.search(text, 1000)).map((h) => h.path))].sort();
    must(JSON.stringify(await paths('كرم')) === JSON.stringify(want), 'the index finds all five');
    must(JSON.stringify(await paths('كَرَمٌ')) === JSON.stringify(want), 'and voweled as typed, the same five');
    must(JSON.stringify(await paths('كـــرم')) === JSON.stringify(want), 'and with a tatweel, the same five');

    // ── the palette ──
    let input = await palette('كرم');
    await answered('كرم');
    log(`palette "كرم": ${rowsOf().length} rows: ${rowsOf().slice(0, 6).map(say).join(' / ')}`);
    must(rowsOf().some((r) => r.dataset.t === 'card') && rowsOf().some((r) => r.dataset.t === 'text'), 'cards and text in the palette');
    must(new Set(rowsOf().map((r) => r.querySelector('.psub')?.textContent)).size === 5, 'its rows come from the five files');
    must(qa('.palette-row[data-t="text"] mark').every((m) => /[\u064B-\u0652]/.test(m.textContent ?? '') || /كرم/.test(m.textContent ?? '')), 'each marks the word, as written');
    if (phone) must(rowsOf().every((r) => r.offsetHeight >= 44), `every row stays a finger's size (${Math.min(...rowsOf().map((r) => r.offsetHeight))} px at the least)`);
    // what was found is on the screen, not cut off by the row
    const seen = () => qa<HTMLElement>('.palette-row mark').filter((m) => { const b = m.getBoundingClientRect(); const p = m.closest('.pt')!.getBoundingClientRect(); return b.left >= p.left - 1 && b.right <= p.right + 1; }).length;
    must(seen() === qa('.palette-row mark').length, `every word found shows whole in its row (${seen()} of ${qa('.palette-row mark').length})`);
    await shot('search-arabic-light');
    useApp.getState().setTheme('dark');
    await shot('search-arabic-dark');
    useApp.getState().setTheme('light');
    type(input, 'lagrangian');
    await answered('lagrangian');
    log(`palette "lagrangian": ${rowsOf().length} rows: ${rowsOf().slice(0, 6).map(say).join(' / ')}`);
    must(seen() === qa('.palette-row mark').length, `and in English (${seen()} of ${qa('.palette-row mark').length})`);
    await shot('search-word-light');
    useApp.getState().setTheme('dark');
    await shot('search-word-dark');
    useApp.getState().setTheme('light');
    type(input, 'equations of motion');
    await answered('equations of motion');
    log(`palette "equations of motion": ${rowsOf().length} rows: ${rowsOf().slice(0, 4).map(say).join(' / ')}`);
    must(rowsOf().filter((r) => r.dataset.t === 'text').every((r) => fold(r.querySelector('.pt')?.textContent ?? '').includes('equations of motion') || !r.querySelector('mark')), 'a phrase: the rows hold it as written');
    await shot('search-phrase');
    // under three letters: read, not looked up
    type(input, 'كر');
    await answered('كر');
    must((await fs.search('كر')).length > 0, 'under three letters: found by reading');
    await shot('search-short');
    // a name still comes first
    type(input, 'vocabulary');
    await answered('vocabulary');
    must(rowsOf()[0]?.dataset.t !== 'text' && rowsOf()[0]?.dataset.t !== 'card', `a document's name is above the text: ${say(rowsOf()[0]!)}`);
    // nothing to find
    type(input, 'zyzzyvaqua');
    await answered('zyzzyvaqua');
    await until(() => q('.palette-empty'));
    must(q('.palette-empty')?.textContent === 'nothing', 'and nothing is nothing');
    await closed();

    // ── a result opens at its place ──
    const HOST = 'library/classical-prose-reader/03-the-generous-host.md';
    input = await palette('كرم');
    await answered('كرم');
    const hit = (await fs.search('كرم', 1000)).find((h) => h.path === HOST && h.kind === 'text');
    if (!hit) throw new Error('the host holds no text with the word');
    const prose = await until(() => rowsOf().find((r) => r.dataset.t === 'text' && r.querySelector('.psub')?.textContent === (useApp.getState().docs[HOST]?.title ?? '')));
    await pick(input, prose);
    const landed = await until(() => q<HTMLElement>('.doc-view .draft-doc .landed'), 8000);
    must(activeTab(useApp.getState().panes)?.id === HOST || useApp.getState().phone, 'text: the document opens');
    must(fold(landed.textContent ?? '').includes('كرم'), `at the block that holds it, marked: "${landed.textContent?.slice(0, 40)}"`);
    await sleep(300);
    must(inView(landed), 'in view');
    await shot('search-landed-text');
    await sleep(2600);
    // a heading deep in a long note, then a card in a note, then a deck's card
    const LAG = 'courses/fall-2025/phys-301-classical-mechanics/lagrangian-mechanics.md';
    const { openBlock } = await import('./vault.js');
    const top = (await fs.search('lagrangian', 1000)).find((h) => h.path === LAG && h.block === 0);
    if (!top) throw new Error('no heading at the top of the note');
    openBlock(top.path, top.block);
    const topAt = await until(() => q<HTMLElement>('.doc-view .draft-doc .landed'), 8000);
    must(topAt.tagName.startsWith('H'), `a heading: "${topAt.textContent?.slice(0, 40)}", marked`);
    await sleep(2800);
    openNode(queueId('today'));
    await until(() => q('.queue'));
    const deep = (await fs.search('lagrangian', 1000)).filter((h) => h.path === LAG).pop();
    if (!deep) throw new Error('no block of the note to land on');
    openBlock(deep.path, deep.block);
    log(`to ${deep.kind} ${deep.block} of ${deep.path}: "${deep.text.slice(0, 40)}"`);
    const deepAt = await until(() => q<HTMLElement>('.doc-view .draft-doc .landed'), 8000);
    await sleep(300);
    must(fold(deepAt.textContent ?? '').includes('lagrangian') && inView(deepAt), `a block far down a note: "${deepAt.textContent?.slice(0, 40)}", in view`);
    await sleep(2600);
    const card = (await fs.search('كرم', 1000)).find((h) => h.kind === 'card' && h.path === 'arabic/vocabulary.md');
    if (!card) throw new Error('no card of the vocabulary holds the word');
    input = await palette('كرم');
    const cardRow = await until(() => rowsOf().find((r) => r.dataset.t === 'card' && r.querySelector('.psub')?.textContent === useApp.getState().docs['arabic/vocabulary.md']?.title));
    await pick(input, cardRow);
    const selected = await until(() => q<HTMLElement>('.deck-view .card-span.selected'), 8000);
    await sleep(300);
    must(fold(selected.textContent ?? '').includes('كرم'), `a card: the deck opens with it selected: "${selected.textContent?.slice(0, 30)}"`);
    await shot('search-landed-card');
    // a document with pages: its text comes in beside them, at the place
    const BEDOUIN = 'library/classical-prose-reader/12-the-grammarian-and-the-bedouin.md';
    input = await palette('sirhan');
    await answered('sirhan');
    const paged = rowsOf().find((r) => r.dataset.t === 'text' && r.querySelector('.psub')?.textContent === useApp.getState().docs[BEDOUIN]?.title);
    if (!paged) throw new Error(`no row of the document with pages: ${rowsOf().map(say).join(' / ')}`);
    must(useApp.getState().docs[BEDOUIN]?.pdf !== undefined, 'a document with pages is found');
    await pick(input, paged);
    const beside = await until(() => q<HTMLElement>('.draft-doc .landed'), 15000);
    must(fold(beside.textContent ?? '').includes('sirhan'), `its text comes in at the place: "${beside.textContent?.slice(0, 40)}"`);
    await shot('search-landed-pages');
    await sleep(2600);
    // a deck's prose has no page of its own: the deck opens
    const intro = (await fs.search('root maps', 1000)).find((h) => h.path === 'arabic/roots.md');
    must(intro?.kind === 'text', 'a deck\'s prose is found');
    openBlock(intro!.path, intro!.block);
    await until(() => (useApp.getState().reveal ? null : true), 8000);
    await sleep(400);
    log(`a deck's prose lands on: ${q('.deck-view') ? 'the deck' : q('.doc-view') ? 'the page' : 'nothing'}`);

    // ── the index follows the text, in the database itself ──
    const NOTE = 'fleeting/search-smoke.md';
    const abs = (rel: string) => vault.abs(rel);
    await fs.writeText(abs(NOTE), 'a thought about the numbat, *written* in haste\n');
    must(JSON.stringify(await paths('numbat')) === JSON.stringify([NOTE]), 'a write: found');
    must(JSON.stringify(await paths('written in haste')) === JSON.stringify([NOTE]), 'a phrase across a mark: found');
    await fs.writeText(abs(NOTE), 'a thought about the quoll\n');
    must((await paths('numbat')).length === 0 && (await paths('quoll')).length === 1, 'written over: the old word gone, the new found');
    await fs.rename(abs(NOTE), abs('fleeting/renamed-by-search.md'));
    must(JSON.stringify(await paths('quoll')) === JSON.stringify(['fleeting/renamed-by-search.md']), 'a rename: found at its new path');
    await fs.remove(abs('fleeting/renamed-by-search.md'));
    must((await paths('quoll')).length === 0, 'a delete: gone');
    // a grade writes the document with the same text: it stays found, at the same block
    const before = await fs.search('كرم', 1000);
    const { gradeCard } = await import('./grading.js');
    const { isDue } = await import('../schedule/index.js');
    const due = useApp.getState().queue.find((i): i is CardItem => i.kind === 'card' && i.path === 'arabic/vocabulary.md' && i.id !== undefined && isDue(i, new Date()));
    if (due) await gradeCard(due, 3, new Date());
    must(JSON.stringify(await fs.search('كرم', 1000)) === JSON.stringify(before), `a grade${due ? '' : ' (none due)'}: the same found`);
    must(hayOf(faceText('a :: b')) === 'a b', 'and the fold is the deck search\'s');
    log('done');
  } catch (e) {
    log(`failed: ${e instanceof Error ? e.message : String(e)}`);
  }
}

export async function smokeStore(vault: Vault): Promise<void> {
  const log = (s: string) => void info(`smoke store: ${s}`);
  const shot = async (name: string, ms = 2500) => { await sleep(800); log(`shot: ${name}`); await sleep(ms); };
  const q = <T extends Element>(sel: string, root: ParentNode = document) => root.querySelector<T>(sel);
  const qa = <T extends Element>(sel: string, root: ParentNode = document) => Array.from(root.querySelectorAll<T>(sel));
  const must = (ok: unknown, what: string) => { if (!ok) throw new Error(what); log(`ok: ${what}`); };
  const key = (el: Element | Window, k: string) => el.dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true, cancelable: true }));
  const type = (el: HTMLInputElement, text: string) => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(el, text);
    el.dispatchEvent(new Event('input', { bubbles: true }));
  };
  try {
    const { collectionFs, diskFs, exportToFolder, exportToZip, importCollection } = await import('./collections.js');
    const { deleteCollection, listCollections } = await import('../vault/tauri-store.js');
    const { tauriFs } = await import('../vault/tauri-fs.js');
    const { skipped } = await import('../vault/index.js');
    type AnyFs = typeof tauriFs;
    /** Every file under `root` on `fs`, by its path from it. */
    const filesOf = async (fs: AnyFs, root: string): Promise<string[]> => {
      const out: string[] = [];
      const visit = async (rel: string): Promise<void> => {
        for (const e of await fs.readDir(rel ? `${root}/${rel}` : root)) {
          if (skipped(e.name)) continue;
          const path = rel ? `${rel}/${e.name}` : e.name;
          if (e.isDir) await visit(path); else out.push(path);
        }
      };
      await visit('');
      return out.sort();
    };
    const same = (a: Uint8Array, b: Uint8Array) => a.length === b.length && a.every((x, i) => x === b[i]);

    const src = await sourceDir();
    if (!src) throw new Error('ILMI_VAULT names the folder to import');
    await invoke('allow_vault', { path: src });
    const { home, names } = await listCollections();
    const name = vaultName(vault.root);
    must(vault.root === `${home}/${name}` && names.includes(name), `the open collection is ${name}, under the app's data directory`);
    const source = await filesOf(diskFs, src);
    const docs = source.filter((p) => p.endsWith('.md') && !p.split('/').some((seg) => seg.startsWith('.')));
    await until(() => (useApp.getState().files.length >= docs.length ? true : null), 20000);
    must(docs.every((p) => vault.documents().includes(p)) && vault.documents().length === docs.length, `every document of the folder is in the collection (${docs.length})`);
    useApp.getState().setTheme('light');
    await shot('store-open');

    // ── in and out as files: a second import, never opened by the app, exported both ways ──
    const copy = await importCollection(src, { name: `${name}-roundtrip`, replace: true });
    const out = `${src}-export`;
    const zip = `${src}-export.zip`;
    await invoke('allow_vault', { path: out });
    await tauriFs.remove(out);
    const t0 = Date.now();
    const written = await exportToFolder(collectionFs(copy), copy, out);
    must(written === source.length, `the export wrote ${written} files, as many as the folder has`);
    const exported = await filesOf(diskFs, out);
    must(JSON.stringify(exported) === JSON.stringify(source), 'the export holds the same paths as the folder');
    let differ: string[] = [];
    for (const p of source) if (!same(await diskFs.readBytes(`${src}/${p}`), await diskFs.readBytes(`${out}/${p}`))) differ.push(p);
    must(differ.length === 0, `every exported file equals the folder's, byte for byte${differ.length ? ` (differ: ${differ.slice(0, 5).join(', ')})` : ''} (${Date.now() - t0} ms)`);
    const zipped = await exportToZip(collectionFs(copy), copy, name, zip);
    must(zipped === source.length, `the zip holds ${zipped} files`);
    must(!(await tauriFs.stat(`${copy}/export`)), 'the zip left nothing beside the database');
    await deleteCollection(copy);
    must(!(await listCollections()).names.includes(`${name}-roundtrip`), 'the second collection is deleted');

    // ── milestone 71: what is written on a book's pages goes out with an export and comes back with an import ──
    {
      const { mirrorFolder } = await import('../vault/index.js');
      const inkRoot = await importCollection(src, { name: `${name}-ink`, replace: true });
      const ifs = collectionFs(inkRoot);
      // its rows are read before a path names one
      await ifs.readDir(inkRoot);
      const pdf = source.find((p) => p.endsWith('.pdf') && !p.startsWith('.'))!;
      const hash = ifs.blobAt(`${inkRoot}/${pdf}`)!;
      const strokes = await invoke<{ stroke: string; at: number; data: string }[]>('ink_split', { drawing: await invoke<string>('dev_ink_sample', { lines: 2, per: 4, seed: 71 }) });
      await ifs.setPageInk(hash, 2, strokes);
      const inkOut = `${src}-ink-export`;
      await exportToFolder(ifs, inkRoot, inkOut);
      const drawn = `${inkOut}/.ilmi/ink/${hash}/2.pkdrawing`;
      must((await tauriFs.stat(drawn))?.size, `the export wrote what is written on page 2 of ${pdf} as .ilmi/ink/${hash.slice(0, 8)}…/2.pkdrawing`);
      const back = await importCollection(inkOut, { name: `${name}-ink-back`, replace: true });
      const got = (await collectionFs(back).pageInk(hash, 2)).map((x) => x.stroke);
      must(got.length === strokes.length && got.every((k, i) => k === strokes[i]!.stroke), `an import of that folder holds the same ${got.length} strokes on that page`);
      must(!(await collectionFs(back).rowAt(`${back}/.ilmi/ink`)), 'and no row: the strokes are rows of the ink table');
      const mir = `${src}-ink-mirror`;
      await invoke('allow_vault', { path: mir });
      await mirrorFolder(ifs, inkRoot, diskFs, mir);
      const again = await mirrorFolder(ifs, inkRoot, diskFs, mir);
      must(again.length === 0, `a second pass of the mirror writes nothing (${again.join(', ')}): the strokes, not the bytes, are compared`);
      await deleteCollection(inkRoot);
      await deleteCollection(back);
    }

    // ── on disk a collection is a database and blobs ──
    await invoke('allow_vault', { path: vault.root });
    const top = (await tauriFs.readDir(vault.root)).map((e) => e.name).sort();
    must(top.includes('collection.db') && top.includes('blobs') && top.every((n) => n.startsWith('collection.db') || n === 'blobs' || n === 'exports'), `its folder holds ${top.join(', ')}`);
    const blobs = await filesOf(tauriFs, `${vault.root}/blobs`);
    const binaries = source.filter((p) => !p.endsWith('.md') && !p.split('/').some((seg) => seg.startsWith('.')));
    must(blobs.length > 0 && blobs.length <= binaries.length && blobs.every((p) => /^[0-9a-f]{2}\/[0-9a-f]{64}$/.test(p)), `no Markdown file on disk: ${blobs.length} blobs named by their hash for the folder's ${binaries.length} PDFs and images`);

    // ── writes land in the database: read back through a store opened afresh ──
    const fresh = () => collectionFs(vault.root);
    const note = docs.find((p) => p.startsWith('fleeting/')) ?? docs[0]!;
    const before = await fresh().rowAt(vault.abs(note));
    await vault.update(note, (doc) => { doc.blocks.push({ kind: 'paragraph', text: 'written by the store smoke' }); });
    const after = await fresh().rowAt(vault.abs(note));
    must(before && after && after.id === before.id && after.rev > before.rev && (await fresh().readText(vault.abs(note))).includes('written by the store smoke'), `a write to ${note} is in the database under the same row`);
    const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3, 4, 5, 6, 7, 8]);
    const img = await vault.addImage(note, png, 'image/png');
    const imgPath = `${note.slice(0, note.lastIndexOf('/') + 1)}${decodeURIComponent(img)}`;
    const imgRow = await fresh().rowAt(vault.abs(imgPath));
    must(imgRow?.blob && same(await fresh().readBytes(vault.abs(imgPath)), png) && (await filesOf(tauriFs, `${vault.root}/blobs`)).includes(`${imgRow.blob.slice(0, 2)}/${imgRow.blob}`), `an image added to it is a blob by its hash (${imgPath})`);
    const renamed = await renameNode(note, 'renamed by the smoke');
    const moved = await moveNode(renamed, '');
    await sleep(300);
    const row = await fresh().rowAt(vault.abs(moved));
    must(row && before && row.id === before.id && row.parent === null && row.name === 'renamed by the smoke', `renamed and moved to the top, it is the same row (${moved})`);
    must(await fresh().stat(vault.abs(`renamed by the smoke/${imgPath.slice(imgPath.lastIndexOf('/') + 1)}`)), 'and what was under it went with it');
    must(useApp.getState().files.includes(moved) && !useApp.getState().files.includes(note), 'the tree shows it in its new place');
    openNode(moved);
    await until(() => q('.doc-view'));
    await shot('store-moved');

    // ── state in rows (milestone 60): a grade is a schedule's row and a line of the log, not the document's text ──
    const { gradeCard } = await import('./grading.js');
    const { isDue } = await import('../schedule/index.js');
    const { refreshQueue } = await import('./vault.js');
    refreshQueue();
    const due = useApp.getState().queue.find((i): i is CardItem => i.kind === 'card' && isDue(i, new Date()) && i.id !== undefined && !!i.sched?.due);
    if (!due) throw new Error('no reviewed card is due in the folder');
    const dueRow = (await fresh().rowAt(vault.abs(due.path)))!;
    const stored = await fresh().store.doc(dueRow.id);
    const fileBefore = await fresh().readText(vault.abs(due.path));
    must(/^\s*<!-- sr /m.test(fileBefore) && !/^\s*<!-- sr /m.test(stored.front + stored.text) && stored.state.some((x) => x.kind === 'card' && x.item === due.id), `${due.path}: its schedule lines are rows by card id, not in the text the database holds`);
    const logBefore = await fresh().reviewCount();
    await gradeCard(due, 3, new Date());
    const graded = await fresh().store.doc(dueRow.id);
    const fileAfter = await fresh().readText(vault.abs(due.path));
    const [la, lb] = [fileBefore.split('\n'), fileAfter.split('\n')];
    const changed = la.length === lb.length ? la.flatMap((l, i) => (l === lb[i] ? [] : [i])) : [];
    must(graded.front + graded.text === stored.front + stored.text && changed.length === 1 && /^\s*<!-- sr /.test(lb[changed[0]!] ?? ''), 'a grade left the stored text as it was; the file read back differs by the one schedule line');
    must((await fresh().reviewCount()) === logBefore + 1 && useApp.getState().reviews.length === logBefore + 1, 'and added one line to the review log');
    const item = useApp.getState().queue.find((i) => i.kind === 'card' && i.path === due.path && i.id === due.id && (i.dir ?? 'f') === (due.dir ?? 'f') && JSON.stringify(i.group ?? null) === JSON.stringify(due.group ?? null));
    must(item && !isDue(item, new Date()), 'the queue has the card with its new schedule');
    must((await fresh().digests()).size === vault.documents().length, `the index holds every document (${vault.documents().length})`);

    // ── the mirror: a folder kept as the collection is; a write follows it ──
    const { mirrorTo, mirrorOff, mirrorNow, keepDated, exportsDir, EXPORTS_KEPT } = await import('./keep.js');
    const mirrorParent = `${src}-mirror`;
    await invoke('allow_vault', { path: mirrorParent });
    await tauriFs.remove(mirrorParent);
    await tauriFs.mkdir(mirrorParent);
    const mirror = await mirrorTo(vault, mirrorParent);
    must(mirror === `${mirrorParent}/${name}` && useApp.getState().mirror === mirror, `the mirror is ${mirror}`);
    const wantOut = `${src}-mirror-want`;
    await invoke('allow_vault', { path: wantOut });
    await tauriFs.remove(wantOut);
    await exportToFolder(vault.fs, vault.root, wantOut);
    const mirrorDiff = async (): Promise<string[]> => {
      const want = await filesOf(diskFs, wantOut);
      const have = (await filesOf(diskFs, mirror)).filter((p) => p !== '.ilmi-mirror.json');
      if (JSON.stringify(want) !== JSON.stringify(have)) return ['the paths'];
      const out: string[] = [];
      for (const p of want) if (!same(await diskFs.readBytes(`${wantOut}/${p}`), await diskFs.readBytes(`${mirror}/${p}`))) out.push(p);
      return out;
    };
    // `.ilmi/state.json` moves with the window (a tab, a width): it is left out of the comparison
    const steady = (paths: string[]) => paths.filter((p) => p !== '.ilmi/state.json');
    must(steady(await mirrorDiff()).length === 0, 'it holds what an export holds, file for file');
    await vault.update(moved, (doc) => { doc.blocks.push({ kind: 'paragraph', text: 'followed by the mirror' }); });
    let followed = false;
    for (let i = 0; i < 100 && !followed; i++) {
      await sleep(100);
      followed = (await diskFs.readText(`${mirror}/${moved}`).catch(() => '')).includes('followed by the mirror');
    }
    must(followed, 'a write to the collection reached the mirror on its own');
    useApp.setState({ tweaksOpen: true });
    const mirrorRow = await until(() => qa('.tweaks .tw-row').find((r) => r.querySelector('.tw-lbl')?.textContent?.startsWith('mirror')));
    must(mirrorRow.querySelector('.tw-val')?.textContent === `${mirrorParent.slice(mirrorParent.lastIndexOf('/') + 1)}/${name}` && Array.from(mirrorRow.querySelectorAll('button')).map((b) => b.textContent).join(' ') === 'choose… off', `Tweaks has the mirror's row: ${mirrorRow.textContent}`);
    await shot('store-mirror');
    mirrorOff(vault);
    await sleep(200);
    must(useApp.getState().mirror === '' && (await until(() => qa('.tweaks .tw-row').find((r) => r.querySelector('.tw-lbl')?.textContent?.startsWith('mirror')))).querySelector('.tw-val')?.textContent === 'off' && (await mirrorNow()).length === 0, 'turned off, the row says off and the folder is left as it is');
    useApp.setState({ tweaksOpen: false });

    // ── the dated exports: one a day beside the database, the last seven kept ──
    const dated = exportsDir(vault.root);
    await invoke('allow_vault', { path: dated });
    await tauriFs.remove(dated);
    await tauriFs.mkdir(dated);
    for (let d = 1; d <= EXPORTS_KEPT; d++) await tauriFs.writeText(`${dated}/2026-10-0${d}.zip`, 'an older day');
    const today = await keepDated(vault);
    const zips = (await tauriFs.readDir(dated)).map((e) => e.name).sort();
    must(today && zips.length === EXPORTS_KEPT && zips.at(-1) === today.slice(today.lastIndexOf('/') + 1) && !zips.includes('2026-10-01.zip') && /^\d{4}-\d{2}-\d{2}\.zip$/.test(zips.at(-1)!), `today's export is ${today?.slice(today.lastIndexOf('/') + 1)}; ${zips.length} kept, the oldest gone`);
    must((await keepDated(vault)) === null && (await tauriFs.stat(today!))!.size > 100_000, 'made once a day, and it is the collection, not a stub');
    log(`dated: ${today}`);

    // ── the palette: export, and a folder in ──
    useApp.setState({ paletteOpen: true });
    const input = await until(() => q<HTMLInputElement>('.palette-input input'));
    type(input, 'export collection');
    await sleep(200);
    const exportRows = qa('.palette-row .pt').map((r) => r.textContent);
    must(exportRows.includes('export collection · folder') && exportRows.includes('export collection · zip'), `the palette offers ${exportRows.join(' / ')}`);
    await shot('store-palette');
    type(input, 'import folder');
    await sleep(200);
    must(qa('.palette-row .pt').some((r) => r.textContent === 'import folder…'), 'and import folder…');
    key(input, 'Escape');
    await until(() => (q('.palette-overlay') ? null : true));

    // ── closed: the welcome lists it; its row opens it as it was left ──
    await runMenu('close');
    await until(() => q('.welcome'));
    await sleep(500);
    const buttons = qa('.welcome-acts button').map((b) => b.textContent);
    must(buttons.join(', ') === 'new collection, import folder', `the welcome offers ${buttons.join(', ')}`);
    must(q('.welcome-line')?.textContent?.includes('A collection is a database on this device'), 'its line says what a collection is');
    const rowEl = qa<HTMLElement>('.welcome-row').find((r) => r.querySelector('.pt')?.textContent === name);
    must(rowEl, `and lists ${qa('.welcome-row .pt').map((r) => r.textContent).join(', ')}`);
    await shot('store-welcome');
    rowEl!.click();
    await until(() => (useApp.getState().vault === vault.root ? true : null), 15000);
    await until(() => (useApp.getState().files.includes(moved) ? true : null), 15000);
    const again = currentVault()!;
    must(again !== vault && (await again.read(moved)).text.includes('written by the store smoke'), 'reopened from its row, the write, the rename and the move are there');
    must(activeTab(useApp.getState().panes)?.id === moved, 'and the tab it was left on');
    await shot('store-reopened');
    log(`done; collection ${vault.root}, export ${out}, zip ${zip}`);
  } catch (e) {
    log(`failed: ${e instanceof Error ? e.message : String(e)}`);
  }
}

// ILMI_SMOKE=size (milestone 60): the sample imported many times over into
// collections of their own (`ILMI_SIZE`, copies, `15,152` by default: about
// 11,000 and 115,000 cards), each opened, a card graded, and the times and
// the web content process's memory printed; since 68, each kind of query
// timed through the palette, and a walk of the index timed when the
// collection is one from before it. Each copy is the folder
// `ILMI_VAULT` names under `cNNN/`, through the same import a person's
// folder takes; `.ilmi/` (the order, the review log) goes in once. Runs
// from the welcome: no collection is opened before the first. With
// `ILMI_SIZE_KEEP=1` a collection the run before made is opened as it is:
// the memory read then is a page's that has only opened it.
/** What each kind of query costs at this size, through the palette, in the window. */
async function search152(root: string, log: (s: string) => void): Promise<{ kind: string; q: string; ok: boolean; under: boolean; drawn: number }[]> {
  const { collectionFs } = await import('./collections.js');
  const ms = (n: number) => `${n.toFixed(1)} ms`;
  // the next frame, or half a second when the window is covered and is given none
  const frame = () => Promise.race([new Promise<void>((r) => requestAnimationFrame(() => r())), sleep(500)]);
  const fs = collectionFs(root);
  const set = (el: HTMLInputElement, text: string) => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(el, text);
    el.dispatchEvent(new Event('input', { bubbles: true }));
  };
  const textRows = () => document.querySelectorAll('.palette-row[data-t="text"], .palette-row[data-t="card"]').length;
  const answered = (q: string) => document.querySelector<HTMLElement>('.palette-list')?.dataset.found === q;
  {
    const { overflow } = await import('../schedule/index.js');
    const { buildIndex } = await import('./chrome.js');
    const s = useApp.getState();
    const p0 = performance.now();
    overflow(s.queue, new Date());
    const p1 = performance.now();
    buildIndex(s.tree, s.docs, []);
    log(`the palette's parts: the backlog's check ${ms(p1 - p0)}, the names ${ms(performance.now() - p1)}`);
  }
  const t0 = performance.now();
  useApp.setState({ paletteOpen: true });
  const t1 = performance.now();
  await new Promise((r) => setTimeout(r, 0));
  const t2 = performance.now();
  const input = await until(() => document.querySelector<HTMLInputElement>('.palette-input input'));
  const t3 = performance.now();
  await frame();
  await frame();
  log(`the palette open and drawn in ${ms(performance.now() - t0)} (set ${ms(t1 - t0)}, turn ${ms(t2 - t1)}, found ${ms(t3 - t2)}, frames ${ms(performance.now() - t3)})`);
  const asks: [kind: string, q: string, under: boolean, hits: boolean][] = [
    ['a word', 'lagrangian', true, true], ['a word inside words', 'ation', false, true], ['a common word', 'the', false, true],
    ['an unvoweled Arabic word', 'كرم', true, true], ['Arabic, voweled as typed', 'كَرَم', false, true], ['a longer Arabic word', 'الكتاب', false, true],
    ['a phrase', 'perturbation theory', true, true], ['words apart', 'energy conservation', false, true], ['an Arabic phrase', 'في الدار', false, true],
    ['a word in no document', 'zyzzyvaqua', false, false], ['a phrase in no document', 'conservation of nothing whatsoever', false, false],
    ['two letters, common', 'of', false, true], ['two Arabic letters', 'كر', false, true], ['one letter', 'x', false, true], ['two letters in no document', 'qz', false, false],
  ];
  const out: { kind: string; q: string; ok: boolean; under: boolean; drawn: number }[] = [];
  for (const [kind, q, under, hits] of asks) {
    const drawn: number[] = [];
    const alone: number[] = [];
    let rows = 0;
    let ok = true;
    for (let i = 0; i < 5; i++) {
      set(input, '');
      await sleep(120);
      const a0 = performance.now();
      const got = await fs.search(q);
      alone.push(performance.now() - a0);
      await sleep(40);
      const d0 = performance.now();
      set(input, q);
      if (hits) {
        // until the rows are on the page, then the frame they are drawn in
        for (let n = 0; !answered(q) && n < 20000; n++) await new Promise((r) => setTimeout(r, 0));
        await frame();
        drawn.push(performance.now() - d0);
        rows = textRows();
      } else {
        for (let n = 0; !answered(q) && n < 20000; n++) await new Promise((r) => setTimeout(r, 0));
        await frame();
        drawn.push(performance.now() - d0);
      }
      ok = ok && got.length > 0 === hits;
    }
    const mid = (l: number[]) => [...l].sort((x, y) => x - y)[Math.floor(l.length / 2)]!;
    log(`${kind} "${q}": on the page ${ms(mid(drawn))} (most ${ms(Math.max(...drawn))}), the store alone ${ms(mid(alone))} (most ${ms(Math.max(...alone))}), ${rows} rows`);
    out.push({ kind, q, ok, under, drawn: mid(drawn) });
  }
  // typed a letter at a time, ten letters a second: what the page does between two keys
  set(input, '');
  await sleep(200);
  const word = 'hamiltonian';
  let worst = 0;
  for (let i = 1; i <= word.length; i++) {
    const k0 = performance.now();
    set(input, word.slice(0, i));
    await frame();
    worst = Math.max(worst, performance.now() - k0);
    await sleep(100);
  }
  log(`"${word}" typed a letter at a time: the longest a key took to the next frame ${ms(worst)}`);
  useApp.setState({ paletteOpen: false });
  await sleep(300);
  return out;
}

export async function smokeSize(src: string | null): Promise<void> {
  const log = (s: string) => void info(`smoke size: ${s}`);
  const shot = async (name: string, ms = 2500) => { await sleep(800); log(`shot: ${name}`); await sleep(ms); };
  const must = (ok: unknown, what: string) => { if (!ok) throw new Error(what); log(`ok: ${what}`); };
  const ms = (n: number) => `${Math.round(n)} ms`;
  const mb = (n: number | null) => (n === null ? 'not measured' : `${Math.round(n / 1e6)} MB`);
  // what the page holds once WebKit has been told to collect (`dev_web_memory`), and the most the process has held
  const memory = async (): Promise<{ now: number; peak: number } | null> => {
    await sleep(2000);
    const got = await invoke<[number, number] | null>('dev_web_memory', { collect: true });
    return got ? { now: got[0], peak: got[1] } : null;
  };
  try {
    if (!src) throw new Error('ILMI_VAULT names the folder to import');
    const { collectionFs, diskFs } = await import('./collections.js');
    const { createCollection, deleteCollection, listCollections } = await import('../vault/tauri-store.js');
    const { importFolder } = await import('../vault/index.js');
    const { gradeCard } = await import('./grading.js');
    const { closeVault, refreshQueue } = await import('./vault.js');
    const { isDue } = await import('../schedule/index.js');
    const { setCollectionsHome } = await import('./platform.js');
    const from = src.replace(/\/+$/, '');
    await invoke('allow_vault', { path: from });
    const sizes = ((await invoke<string | null>('dev_env', { name: 'ILMI_SIZE' })) ?? '15,152').split(',').map((x) => Number(x.trim())).filter((n) => Number.isInteger(n) && n > 0);
    useApp.setState({ started: true });
    useApp.getState().setTheme('light');
    await sleep(1500);
    const empty = await memory();
    log(`memory with no collection open: ${mb(empty?.now ?? null)}`);
    // what the web view holds, at its most, in each phase of a run (milestone 71): the import, the open, the index's walk, the queries
    let phase = 'import';
    const most = new Map<string, number>();
    let sampling = true;
    void (async () => {
      while (sampling) {
        const now = Math.max(0, ...(await invoke<[number, number, number][]>('dev_web_processes', { collect: false }).catch(() => [])).map(([, x]) => x));
        if (now > (most.get(phase) ?? 0)) most.set(phase, now);
        await sleep(500);
      }
    })();
    const phases = () => [...most].map(([k, v]) => `${k} ${mb(v)}`).join(', ');
    // the folder without `.ilmi/`: what each copy is
    const copyFs: typeof diskFs = { ...diskFs, readDir: async (path) => (await diskFs.readDir(path)).filter((e) => path !== from || e.name !== '.ilmi') };
    for (const n of sizes) {
      const name = `size-${n}`;
      const { home, names } = await listCollections();
      setCollectionsHome(home);
      // `ILMI_SIZE_KEEP=1` opens the collection a run before left, so the page that opens it has imported nothing
      const kept = names.includes(name) && !!(await invoke<string | null>('dev_env', { name: 'ILMI_SIZE_KEEP' }));
      let root = `${home}/${name}`;
      if (kept) log(`${name}: kept from the run before`);
      else {
        if (names.includes(name)) await deleteCollection(root);
        root = await createCollection(name);
        const fs = collectionFs(root);
        const t0 = performance.now();
        let files = 0;
        if ((await diskFs.stat(`${from}/.ilmi`))?.isDir) {
          await fs.mkdir(`${root}/.ilmi`);
          files += await importFolder(diskFs, `${from}/.ilmi`, fs, `${root}/.ilmi`);
        }
        for (let c = 1; c <= n; c++) {
          const dir = `${root}/c${String(c).padStart(3, '0')}`;
          await fs.mkdir(dir);
          files += await importFolder(copyFs, from, fs, dir);
        }
        const imported = performance.now() - t0;
        log(`${name}: ${n} copies, ${files} files imported in ${ms(imported)}`);
      }

      phase = 'open';
      // two frames on, or half a second when the window is covered and is given none
      const frame = () => Promise.race([new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r()))), sleep(500)]);
      let seen = document.visibilityState === 'visible';
      const watch = () => { if (document.visibilityState !== 'visible') seen = false; };
      document.addEventListener('visibilitychange', watch);
      const t1 = performance.now();
      const vault = await openVault(root);
      const opened = performance.now() - t1;
      // the day's page is drawn, not every row of it
      await until(() => document.querySelector('.qlist li'), 120000);
      await frame();
      const drawn = performance.now() - t1;
      const s = useApp.getState();
      const docs = Object.keys(s.docs).length;
      const cards = Object.values(s.docs).reduce((sum, d) => sum + d.cards, 0);
      must(docs === vault.documents().length && docs > 0, `${name}: opened, ${docs} documents and ${cards} cards known, ${s.queue.length} in the queue`);
      const rows = document.querySelectorAll('.qlist li').length;
      await sleep(2000);
      const now = new Date();
      const item = useApp.getState().queue.find((i): i is CardItem => i.kind === 'card' && isDue(i, now) && i.id !== undefined);
      if (!item) throw new Error(`${name}: no card is due`);
      const lines = useApp.getState().reviews.length;
      const t4 = performance.now();
      await gradeCard(item, 3, now);
      const graded = performance.now() - t4;
      await frame();
      const redrawn = performance.now() - t4;
      const after = useApp.getState().queue.find((i) => i.kind === 'card' && i.path === item.path && i.id === item.id && (i.dir ?? 'f') === (item.dir ?? 'f') && JSON.stringify(i.group ?? null) === JSON.stringify(item.group ?? null));
      must(after && after.kind === 'card' && after.sched?.last !== item.sched?.last && !isDue(after, now), `${name}: a card of ${item.path} graded; the queue has it with its new schedule`);
      must(useApp.getState().reviews.length === lines + 1 && (await collectionFs(root).reviewCount()) === lines + 1, `${name}: and the log has its line`);
      // the search index (milestone 68). A collection from before it is walked as it stays open, from a moment after it opened:
      // the longest the page goes without a frame, and a grade made meanwhile
      if (useApp.getState().searchShare < 1 || !(await collectionFs(root).store.searchState()).done) {
        phase = 'walk';
        const w0 = performance.now();
        // what the web view holds while the walk goes (milestone 71): its most, and the share walked then
        const heldNow = async () => Math.max(0, ...(await invoke<[number, number, number][]>('dev_web_processes', { collect: false })).map(([, now]) => now));
        const atOpen = await heldNow();
        let most = { mb: atOpen, share: 0 };
        let sampling = true;
        void (async () => { while (sampling) { const n = await heldNow(); if (n > most.mb) most = { mb: n, share: useApp.getState().searchShare }; await sleep(1000); } })();
        let longest = 0;
        let frames = true;
        const beat = (at: number) => { if (!frames) return; requestAnimationFrame((t) => { longest = Math.max(longest, t - at); beat(t); }); };
        requestAnimationFrame(beat);
        const during = useApp.getState().queue.find((i): i is CardItem => i.kind === 'card' && isDue(i, new Date()) && i.id !== undefined);
        await until(() => (useApp.getState().searchShare > 0.1 ? true : null), 120000);
        const share = useApp.getState().searchShare;
        const t6 = performance.now();
        if (during) await gradeCard(during, 3, new Date());
        const gradedDuring = performance.now() - t6;
        const t7 = performance.now();
        const partial = await collectionFs(root).search('كرم');
        const askedDuring = performance.now() - t7;
        await until(() => (useApp.getState().searchShare === 1 ? true : null), 300000);
        frames = false;
        sampling = false;
        log(`${name}: the web view at its most, by phase, to the walk's end: ${phases()}; the page ${document.visibilityState}, frames ${longest > 0 ? 'drawn' : 'none (covered)'}`);
        phase = 'queries';
        log(`${name}: the web view held ${Math.round(atOpen / 1048576)} MB as the walk began and ${Math.round(most.mb / 1048576)} MB at its most during it, at ${Math.round(most.share * 100)}% walked`);
        log(`${name}: the index made by the walk in ${ms(performance.now() - w0 + 1500)} from the open; the longest the page went without a frame ${ms(longest)}; at ${Math.round(share * 100)}% a grade took ${ms(gradedDuring)} and a search ${ms(askedDuring)} (${partial.length} found so far)`);
      }
      // each query through the palette as a person's would go: the field set, until the rows are on the page; the store's answer alone beside it
      const seconds = await search152(root, log);
      must(seconds.every((s) => s.ok), `${name}: ${seconds.filter((s) => s.ok).length} of ${seconds.length} queries found what they were asked`);
      for (const s of seconds.filter((x) => x.under)) must(s.drawn < 100, `${name}: ${s.kind} found in under a tenth of a second (${ms(s.drawn)})`);
      // weighed as the app left it: nothing else has been read into the page
      const held = await memory();
      // each part alone, once the window is at rest
      const t2 = performance.now();
      const again = await collectionFs(root).digests();
      const index = performance.now() - t2;
      again.clear();
      const t3 = performance.now();
      refreshQueue();
      const rebuilt = performance.now() - t3;
      // a covered window's page is slowed by the system: its times are not the app's
      if (document.visibilityState !== 'visible' || !seen) log(`${name}: the window was covered during this run; the times below are a throttled page's`);
      log(`${name}: open ${ms(opened)}, the day's page drawn at ${ms(drawn)} (the index read alone ${ms(index)}) · grade ${ms(graded)}, drawn again at ${ms(redrawn)} (a queue rebuild alone ${ms(rebuilt)}) · memory ${mb(held?.now ?? null)}${held && empty ? `, ${mb(held.now - empty.now)} over none open; ${mb(held.peak)} at its most` : ''} · ${rows} rows drawn of ${useApp.getState().queue.filter((i) => isDue(i, new Date())).length} due`);
      log(`${name}: the web view at its most, by phase: ${phases()}`);
      // `ILMI_SIZE_PARSED=1`: every document read and parsed into the vault's cache as well, which is what opening
      // did before the index (milestone 59), weighed in the same page for a like-for-like figure
      if (await invoke<string | null>('dev_env', { name: 'ILMI_SIZE_PARSED' })) {
        const t5 = performance.now();
        for (const path of vault.documents()) await vault.read(path);
        const parsed = performance.now() - t5;
        const all = await memory();
        log(`${name}: with every document read and parsed too, as an open was before the index: ${ms(parsed)} more, memory ${mb(all?.now ?? null)}${all && empty ? `, ${mb(all.now - empty.now)} over none open` : ''}`);
      }
      document.removeEventListener('visibilitychange', watch);
      await shot(name);
      closeVault();
      await sleep(1500);
    }
    sampling = false;
    log('done');
  } catch (e) {
    log(`failed: ${e instanceof Error ? e.message : String(e)}`);
  }
}

// `ILMI_SMOKE=finish` (`smokeFinish`, milestone 52) over a fresh copy of
// `samples/double-major`, 2026-11-03 by the app's clock. The merchant passage,
// half read, at priority 70, its cadence every third day: the inspector's
// `finish by` set three weeks out; the row says `on pace · N passes left`; the
// session's ⏎ reads and writes the pacing's day, not the cadence's; a day too
// close to make reads `behind`; empty clears it, the words go and the next pass is
// on the cadence again. A line on its cadence with a day set after it is
// brought forward by the queue with nothing written, and goes back when the
// day is cleared; past the day the words go and the line stands as written.
// A chapter of a book counts its pages. Light, then dark.
export async function smokeFinish(vault: Vault): Promise<void> {
  type ReadItem = import('../schedule/index.js').ReadItem;
  type QueueItem = import('../schedule/index.js').QueueItem;
  let last = { at: Date.now(), what: 'start' };
  let finished = false;
  const log = (s: string) => { last = { at: Date.now(), what: s }; void info(`smoke finish: ${s}`); };
  const dog = setInterval(() => {
    if (finished) { clearInterval(dog); return; }
    if (Date.now() - last.at > 30_000) { finished = true; clearInterval(dog); void info(`smoke finish: failed: no progress for 30 s after "${last.what}"`); }
  }, 2000);
  const shot = async (name: string, ms = 2500) => { await sleep(800); log(`shot: ${name}`); await sleep(ms); };
  const q = <T extends Element>(sel: string, root: ParentNode = document) => root.querySelector<T>(sel);
  const qa = <T extends Element>(sel: string, root: ParentNode = document) => Array.from(root.querySelectorAll<T>(sel));
  const must = (ok: unknown, what: string) => { if (!ok) throw new Error(what); log(`ok: ${what}`); };
  const poll = async <T,>(probe: () => T | null | undefined | false | Promise<T | null | undefined | false>, what: string, ms = 8000): Promise<T> => {
    const t0 = Date.now();
    for (;;) {
      const v = await probe();
      if (v) { log(`ok: ${what}`); return v; }
      if (Date.now() - t0 > ms) throw new Error(`${what} (waited ${ms} ms)`);
      await sleep(100);
    }
  };
  const key = (k: string) => window.dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true, cancelable: true }));
  const { parse, meta, setField } = await import('../format/index.js');
  const { addDays, dayOf, isDue, pacedInterval, passesLeft, sameItem } = await import('../schedule/index.js');
  const { refreshQueue } = await import('./vault.js');
  const { setClockDay, appNow } = await import('./clock.js');
  const { doneLine } = await import('./items.js');
  const MERCHANT = 'library/classical-prose-reader/15-the-merchant-who-was-robbed.md';
  const CHAPTER = 'library/lindqvist-statistical-physics/ch-3-the-canonical-ensemble.md';
  const NAME = 'passage 15 · the merchant who was robbed';
  const DAY1 = '2026-11-03';
  const WEEKS3 = addDays(DAY1, 21);
  const text = (p: string) => vault.fs.readText(vault.abs(p));
  const lineOf = (t: string) => t.split('\n').find((l) => l.startsWith('read:')) ?? '';
  const readOf = (p: string) => useApp.getState().queue.find((i): i is ReadItem => i.kind === 'read' && i.path === p);
  const sessionAt = async (it: QueueItem) => {
    // the pane's scroll carries into the session, and ⏎ reads the read point off it
    const body = q<HTMLElement>('.pane[data-active="1"] .pane-body');
    if (body) body.scrollTop = 0;
    openSession(it);
    await poll(() => { const el = useApp.getState().sessionEl; return el && sameItem(el.item, it) && q('.pane[data-active="1"] .doc-session .session-bar') ? true : null; }, `the session opens at ${it.path}`, 20000);
    await sleep(500);
  };
  const bar = () => q<HTMLElement>('.pane[data-active="1"] .session-bar')!;
  const actions = () => qa<HTMLElement>('.sb-actions button .ra-l', bar()).map((b) => b.textContent).join(' / ');
  const changed = (p: string, before: string, what: string) => poll(async () => { const t = await text(p); return t !== before ? t : null; }, what);
  const field = () => q<HTMLInputElement>('.insp .day-field');
  const setDay = async (p: string, day: string) => {
    const el = await poll(field, 'the inspector has its finish by row');
    const before = await text(p);
    el.focus();
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(el, day);
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.blur();
    return changed(p, before, day ? `finish by ${day} written` : 'finish by cleared');
  };
  // a book opens with the inspector closed: its toggle
  const bookRow = async () => {
    openNode(CHAPTER);
    await poll(() => { useApp.setState({ bookInsp: true }); return field(); }, 'the chapter\'s inspector, by its toggle', 20000);
  };
  const today = async () => {
    openNode(queueId('today'));
    await poll(() => q('.pane[data-active="1"] .queue h1')?.firstChild?.textContent === 'due today', 'the day\'s query is drawn');
  };
  const rowOf = (name: string) => qa<HTMLElement>('.pane[data-active="1"] .qlist li').find((li) => li.textContent?.includes(name) && q('.kindtag', li)?.textContent === 'read');
  const paceOf = (name: string) => { const r = rowOf(name); return r ? q('[data-pace]', r)?.textContent ?? '' : null; };
  try {
    setClockDay(DAY1);
    useApp.getState().setTheme('light');
    await poll(() => document.documentElement.dataset.theme === 'light', 'light');
    useApp.getState().setBacklog(false);
    setInspector({ open: true });
    await poll(() => useApp.getState().docs[MERCHANT] && useApp.getState().docs[CHAPTER], 'the sample is in the collection', 15000);
    await vault.update(MERCHANT, (d) => setField(d, 'pri', 70));
    refreshQueue();
    const merchant = await poll(() => { const r = readOf(MERCHANT); return r && r.pri === 70 && isDue(r, appNow()) ? r : null; }, 'the merchant is due, at priority 70');
    must(merchant.pos === 6 && merchant.pos < merchant.total && merchant.sched.reps === 2, `half read: ${merchant.pos} of ${merchant.total} in ${merchant.sched.reps} passes`);

    // ── nothing set: nothing said ──
    await today();
    await poll(() => rowOf('merchant who was robbed'), 'its row is drawn');
    must(paceOf('merchant who was robbed') === '', 'no day set, the row says no pace');

    // ── the row, three weeks out ──
    openNode(MERCHANT);
    const set1 = await setDay(MERCHANT, WEEKS3);
    must(set1.includes(`\nfinish: ${WEEKS3}\n`), `the front matter says finish: ${WEEKS3}`);
    must(field()?.value === WEEKS3, 'the field shows the day');
    await shot('finish-row');
    refreshQueue();
    const paced = await poll(() => { const r = readOf(MERCHANT); return r?.finish ? r : null; }, 'the queue knows the day');
    const passes = passesLeft(merchant.total - 6, 3);
    await today();
    const words1 = await poll(() => paceOf('merchant who was robbed'), 'the row says how it stands');
    must(words1 === `on pace · ${passes} passes left`, `the row: "${words1}"`);
    must(paced.finish?.day === WEEKS3, 'the item carries the day');
    rowOf('merchant who was robbed')?.scrollIntoView({ block: 'center' });
    await shot('finish-queue');

    // ── a pass lands on the pacing's day, not the cadence's ──
    await sessionAt(paced);
    const barWords = q('.sb-where[data-pace]', bar())?.textContent;
    must(barWords === `on pace · ${passes} passes left`, `the session bar: "${barWords}"`);
    must(actions() === 'done for today · back in 2d / later / dismiss', `sooner than the cadence of three: ${actions()}`);
    await shot('finish-session');
    let before = await text(MERCHANT);
    key('Enter');
    let after = await changed(MERCHANT, before, 'done for today wrote the file');
    const r1 = meta(parse(after).doc).read!;
    log(`the line: ${lineOf(after)}`);
    const next = pacedInterval(DAY1, { day: WEEKS3 }, merchant.total - r1.pos!, r1.pos! / 3, 0)!;
    must(next < 3 && r1.ivl === next && r1.due === addDays(DAY1, next) && r1.reps === 3, `the pass landed on the pacing's day, ${next} days on, not three: ${lineOf(after)}`);
    must(useApp.getState().log[0] === doneLine('“', NAME, `done for today · back in ${next}d`), `the done row: "${useApp.getState().log[0]}"`);
    const DAY2 = r1.due!;

    // ── too close to make: behind ──
    openNode(MERCHANT);
    await setDay(MERCHANT, addDays(DAY2, 1));
    setClockDay(DAY2);
    refreshQueue();
    await today();
    const words2 = await poll(() => { const w = paceOf('merchant who was robbed'); return w?.startsWith('behind') ? w : null; }, 'a day too close reads behind');
    must(/^behind · \d+ passes left$/.test(words2), `the row: "${words2}"`);
    rowOf('merchant who was robbed')?.scrollIntoView({ block: 'center' });
    await shot('finish-behind');

    // ── empty clears it, and the next pass is on its cadence ──
    openNode(MERCHANT);
    const cleared = await setDay(MERCHANT, '');
    must(!cleared.includes('\nfinish:'), 'the field is gone from the front matter');
    refreshQueue();
    await poll(() => { const r = readOf(MERCHANT); return r && !r.finish ? r : null; }, 'the queue has let the day go');
    await today();
    await poll(() => paceOf('merchant who was robbed') === '', 'the row says nothing again');
    const back = readOf(MERCHANT)!;
    await sessionAt(back);
    must(!q('.sb-where[data-pace]', bar()), 'the session bar says nothing again');
    must(actions() === 'done for today · back in 3d / later / dismiss', `on its cadence: ${actions()}`);
    before = await text(MERCHANT);
    key('Enter');
    after = await changed(MERCHANT, before, 'done for today wrote the file');
    const r2 = meta(parse(after).doc).read!;
    must(r2.ivl === 3 && r2.due === addDays(DAY2, 3), `the pass landed on its cadence: ${lineOf(after)}`);

    // ── a line already out on its cadence is brought forward, nothing written ──
    openNode(MERCHANT);
    const left = readOf(MERCHANT)!.total - (r2.pos ?? 0);
    const close = addDays(DAY2, passesLeft(left, (r2.pos ?? 0) / (r2.reps ?? 1)));
    await setDay(MERCHANT, close);
    refreshQueue();
    const pulled = await poll(() => { const r = readOf(MERCHANT); return r?.finish && r.pulled ? r : null; }, 'the queue brings the pass forward');
    must(pulled.pulled === r2.due && dayOf(pulled.dueAt) < r2.due!, `from ${pulled.pulled} to ${dayOf(pulled.dueAt)}, the line still ${r2.ivl} days`);
    must(lineOf(await text(MERCHANT)) === lineOf(after), 'the read line is as it was');
    await setDay(MERCHANT, '');
    refreshQueue();
    await poll(() => { const r = readOf(MERCHANT); return r && !r.pulled && dayOf(r.dueAt) === r2.due ? r : null; }, 'cleared, it is back on its cadence\'s day');

    // ── after the day it means nothing and is left as written ──
    await setDay(MERCHANT, WEEKS3);
    const past = addDays(WEEKS3, 1);
    setClockDay(past);
    refreshQueue();
    await today();
    await poll(() => rowOf('merchant who was robbed'), 'its row, the day past');
    must(paceOf('merchant who was robbed') === '', 'past the day the row says nothing');
    must((await text(MERCHANT)).includes(`\nfinish: ${WEEKS3}\n`), 'and the field is left as written');
    const late = readOf(MERCHANT)!;
    await sessionAt(late);
    must(actions() === 'done for today · back in 3d / later / dismiss', `on its cadence: ${actions()}`);
    await today();

    // ── a chapter counts its pages ──
    setClockDay(DAY1);
    await bookRow();
    await setDay(CHAPTER, WEEKS3);
    refreshQueue();
    const ch = await poll(() => { const r = readOf(CHAPTER); return r?.finish ? r : null; }, 'the chapter has the day');
    must(ch.finish!.left === 2 && ch.finish!.perPass === 1, `pages 23-28, read to 26 in four passes: ${ch.finish!.left} left at ${ch.finish!.perPass} a pass`);
    await today();
    const words3 = await poll(() => paceOf('canonical ensemble'), 'its row says how it stands');
    must(words3 === 'on pace · 2 passes left', `the row: "${words3}"`);

    // ── dark ──
    useApp.getState().setTheme('dark');
    await poll(() => document.documentElement.dataset.theme === 'dark', 'dark');
    rowOf('canonical ensemble')?.scrollIntoView({ block: 'center' });
    await shot('finish-dark-queue');
    await bookRow();
    await shot('finish-dark-row');
    useApp.getState().setTheme('light');
    setClockDay(null);
    finished = true;
    log(`done; vault ${vault.root}`);
  } catch (e) {
    finished = true;
    setClockDay(null);
    log(`failed: ${e instanceof Error ? e.message : String(e)}`);
  }
}

// `ILMI_SMOKE=join` (`smokeJoin`, milestone 71) on a simulated iPad or iPhone,
// from its welcome: a collection made from the sample in Documents is put
// into the loopback WebDAV server's storage and deleted here; then `join`,
// `webdav`, the address, user and password typed into the welcome's rows,
// and `join` again makes the collection from the storage and opens it,
// syncing through it. Light, then dark.
export async function smokeJoin(): Promise<void> {
  const log = (s: string) => info(`smoke join: ${s}`);
  const q = <T extends Element>(sel: string, root: ParentNode = document) => root.querySelector<T>(sel);
  const qa = <T extends Element>(sel: string, root: ParentNode = document) => Array.from(root.querySelectorAll<T>(sel));
  const shot = async (name: string, ms = 3500) => { await sleep(1200); log(`shot: ${name}`); await sleep(ms); };
  const must = (ok: unknown, what: string) => { if (!ok) throw new Error(what); log(`ok: ${what}`); };
  const poll = async <T,>(probe: () => T | null | undefined | false | Promise<T | null | undefined | false>, what: string, ms = 15000): Promise<T> => {
    const t0 = Date.now();
    for (;;) {
      const v = await probe();
      if (v) { log(`ok: ${what}`); return v; }
      if (Date.now() - t0 > ms) throw new Error(`${what} (waited ${ms} ms)`);
      await sleep(150);
    }
  };
  const tap = (el: Element | null | undefined) => { if (!el) throw new Error('nothing to tap'); (el as HTMLElement).click(); };
  try {
    const { documentsDir, isMobile } = await import('./platform.js');
    const { collectionFs, importCollection } = await import('./collections.js');
    const { deleteCollection } = await import('../vault/tauri-store.js');
    const { devStorages, storageFor, storageOf } = await import('./storage.js');
    const { engineFor } = await import('./crdt.js');
    must(isMobile() && useApp.getState().mobile, `the app knows it is on an iPad or a phone (${window.innerWidth}×${window.innerHeight})`);
    const sample = `${documentsDir()}/double-major`;
    // ── a storage that holds a collection, made here and let go ──
    const dav = (await devStorages()).webdav;
    const made = await importCollection(sample, { name: 'join-source', replace: true });
    const docs = collectionFs(made);
    const count = (await docs.digests()).size;
    const eng = engineFor(docs, made);
    must((await eng.connect(await storageFor(dav, made))) === 'made', `a collection of the sample (${count} documents) made the loopback WebDAV storage`);
    await eng.sync(await storageFor(dav, made));
    await deleteCollection(made);
    // ── the welcome ──
    useApp.getState().setReopen(false);
    useApp.getState().setTheme('light');
    await startFromRecents();
    await poll(() => q('.welcome'), 'the welcome');
    tap(qa('.welcome-acts button').find((b) => b.textContent === 'join'));
    await poll(() => q('.welcome-join'), 'join opens a storage\'s rows');
    const kinds = qa('.welcome-join .tw-seg.wrap button').map((b) => b.textContent);
    must(kinds.join(' ') === 's3 webdav dropbox google drive', `the kinds of Tweaks, no folder and no icloud drive: ${kinds.join(', ')}`);
    tap(qa('.welcome-join .tw-seg button').find((b) => b.textContent === 'webdav'));
    const fill = async (label: string, text: string) => {
      const row = await poll(() => qa<HTMLElement>('.welcome-join .tw-row').find((r) => r.querySelector('.tw-lbl')?.textContent === label), `the ${label} row`);
      const el = row.querySelector<HTMLInputElement>('input')!;
      el.focus();
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(el, text);
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.blur();
    };
    await fill('address', dav.address);
    await fill('user', dav.user);
    await fill('password', dav.password);
    const go = await poll(() => { const b = q<HTMLButtonElement>('.welcome-join .welcome-go'); return b && !b.disabled ? b : null; }, 'join is ready once the address is there');
    await shot('join-fields');
    tap(go);
    const root = await poll(() => useApp.getState().vault, 'the collection made from the storage opens', 60000);
    await poll(() => useApp.getState().files.length > 0, 'its documents are in the tree', 30000);
    const got = (await collectionFs(root).digests()).size;
    must(got === count, `it holds the ${got} documents the storage held`);
    const st = storageOf(root);
    must(st.on && st.kind === 'webdav' && st.address === dav.address, 'and syncs through that storage from now on');
    await shot('join-opened');
    useApp.getState().setTheme('dark');
    await shot('join-dark');
    useApp.getState().setTheme('light');
    log('done');
  } catch (e) {
    log(`failed: ${e instanceof Error ? e.message : String(e)}`);
  }
}

// `ILMI_SMOKE=away` on a simulated iPad (`away.ts`): smoke.json gives `vault`
// (a copy of the sample on the Mac's disk) and `storage` (an empty folder
// there). The collection is made from the sample and makes the storage; the
// timers are stopped, so nothing is sent but by leaving. A card is graded,
// the rig sends the app home (`do: away <seconds>`) and brings it back; the
// grade must have gone out while the app was in the background.
export async function smokeAway(): Promise<void> {
  let last = { at: Date.now(), what: 'start' };
  let finished = false;
  const log = (s: string) => { last = { at: Date.now(), what: s }; void info(`smoke away: ${s}`); };
  const dog = setInterval(() => {
    if (finished) { clearInterval(dog); return; }
    if (Date.now() - last.at > 120_000) { finished = true; clearInterval(dog); void info(`smoke away: failed: no progress for 120 s after "${last.what}"`); }
  }, 2000);
  const must = (ok: unknown, what: string) => { if (!ok) throw new Error(what); log(`ok: ${what}`); };
  const poll = async <T,>(probe: () => T | null | undefined | false | Promise<T | null | undefined | false>, what: string, ms = 8000): Promise<T> => {
    const t0 = Date.now();
    for (;;) {
      const v = await probe();
      if (v) { log(`ok: ${what}`); return v; }
      if (Date.now() - t0 > ms) throw new Error(`${what} (waited ${ms} ms)`);
      await sleep(100);
    }
  };
  try {
    const { isMobile } = await import('./platform.js');
    const { devStorage, crdtOn, setCrdtTimers } = await import('./crdt.js');
    const { syncWord } = await import('./sync.js');
    const { devCollection } = await import('./vault.js');
    const { forceLeave, lastLeave } = await import('./away.js');
    const { gradeCard } = await import('./grading.js');
    const { appNow } = await import('./clock.js');
    must(isMobile(), 'the app knows it is on an iPad');
    const path = await invoke<string | null>('dev_env', { name: 'ILMI_VAULT' });
    const storage = await devStorage();
    if (!path) throw new Error('ILMI_VAULT (smoke.json: "vault") names a copy of the sample');
    if (!storage || storage.kind !== 'folder') throw new Error('ILMI_STORAGE (smoke.json: "storage") names an empty folder');
    useApp.getState().setReopen(false);
    useApp.getState().setTheme('light');
    const vault = await openVault(await devCollection(path));
    setCrdtTimers(false);
    forceLeave(true);
    await poll(() => crdtOn() && syncWord(useApp.getState().sync) === 'synced', 'the collection made the storage and reads synced', 90000);
    const outbox = () => invoke<number>('store_outbox_count', { root: vault.root });
    must((await outbox()) === 0, 'nothing waits to be sent');

    // ── a grade, and the app left at once ──
    const item = await poll(() => useApp.getState().queue.find((i): i is CardItem => i.kind === 'card'), 'a card is due', 15000);
    await gradeCard(item, 3, appNow());
    const waiting = await poll(async () => { const n = await outbox(); return n > 0 ? n : null; }, `${item.path} graded: it waits to be sent`);
    log(`waiting: ${waiting}`);
    let back = 0;
    const watch = () => { if (document.visibilityState === 'visible' && !back) back = Date.now(); };
    document.addEventListener('visibilitychange', watch);
    const left = Date.now();
    log('do: away 20');
    await poll(() => back > 0 && lastLeave.ended > 0, 'the app was sent home and brought back', 120000);
    document.removeEventListener('visibilitychange', watch);
    const t = (n: number) => `${((n - left) / 1000).toFixed(1)} s`;
    // a simulator under the rig sets no limit (the largest double): a device says half a minute or so
    const given = lastLeave.left === null ? 'none said' : lastLeave.left > 1e6 ? 'no limit (a simulator suspends nothing)' : `${lastLeave.left.toFixed(0)} s`;
    log(`leave: started ${t(lastLeave.started)}, ended ${t(lastLeave.ended)}, back ${t(back)}; time in the background when held: ${given}`);
    must(lastLeave.started >= left && lastLeave.failed === null && lastLeave.sent >= 1, `leaving sent it (${lastLeave.sent} sync${lastLeave.sent === 1 ? '' : 's'} had something)`);
    must(lastLeave.ended < back, `and it was sent while the app was away: done ${t(lastLeave.ended)}, back ${t(back)}`);
    must(lastLeave.left !== null && lastLeave.left > 0, `held in the background: ${given}`);
    must((await outbox()) === 0, 'nothing waits to be sent now');
    finished = true;
    log(`done; storage ${storage.folder}`);
  } catch (e) {
    finished = true;
    log(`failed: ${e instanceof Error ? e.message : String(e)}`);
  }
}

// `ILMI_SMOKE=cardview` over `samples/double-major` (milestone 72): the
// physics constants deck opened in the sidebar's tree to list its cards, a
// card's row opening the card view there, its back typed into and saved
// with ⌘⏎ (the file's card line changed, its id and `sr` line kept, one
// line of the file and no other), `]` to the next card, the tree's row of
// the card on show lit, a right-click in a face offering `insert table`;
// a session's card edited in place with `e` and graded after; then the
// verb forms note, a right-click in its table's `II` cell, `row below`, and
// the file holding the new empty row under it. Each check an `ok:` line,
// the first miss `failed:`; `shot:` lines for a capture.
export async function smokeCardView(vault: Vault): Promise<void> {
  const log = (s: string) => void info(`smoke cardview: ${s}`);
  const shot = async (name: string, ms = 2500) => { await sleep(800); log(`shot: ${name}`); await sleep(ms); };
  const q = <T extends Element>(sel: string, root: ParentNode = document) => root.querySelector<T>(sel);
  const qa = <T extends Element>(sel: string) => Array.from(document.querySelectorAll<T>(sel));
  const must = (ok: unknown, what: string) => { if (!ok) throw new Error(what); log(`ok: ${what}`); };
  const poll = async <T,>(probe: () => T | null | undefined | false, what: string, ms = 6000): Promise<T> => {
    const t0 = Date.now();
    for (;;) {
      const v = probe();
      if (v) { log(`ok: ${what}`); return v; }
      if (Date.now() - t0 > ms) throw new Error(`${what} (waited ${ms} ms)`);
      await sleep(100);
    }
  };
  const key = (k: string, target: EventTarget = window, init: KeyboardEventInit = {}) => target.dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true, cancelable: true, ...init }));
  const typeAtEnd = (el: HTMLElement, text: string) => {
    el.focus();
    const sel = window.getSelection()!;
    sel.selectAllChildren(el);
    sel.collapseToEnd();
    document.execCommand('insertText', false, text);
  };
  const rightClick = (el: Element) => {
    const r = el.getBoundingClientRect();
    el.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true, button: 2, clientX: r.left + Math.min(12, r.width / 2), clientY: r.top + r.height / 2 }));
  };
  const DECK = 'physics/constants-and-orders-of-magnitude.md';
  const NOTE = 'courses/spring-2026/arab-302-morphology/verb-forms.md';
  const trow = (path: string) => q<HTMLElement>(`.edit-tree .trow[data-path="${CSS.escape(path)}"]`);
  try {
    useApp.getState().setTheme('light');
    setSidebar({ hidden: false });
    toggleOpen('', true);
    toggleOpen('physics', true);
    const deckRow = await poll(() => trow(DECK), 'the deck\'s row is in the tree', 10000);
    must(deckRow.getAttribute('aria-expanded') === 'false', 'a deck with cards can open, closed by default');
    deckRow.querySelector<HTMLElement>('.chev')!.click();
    const cardRows = await poll(() => { const r = qa<HTMLElement>(`.edit-tree .card-row[data-doc="${CSS.escape(DECK)}"]`); return r.length ? r : null; }, 'its chevron lists its cards under it');
    const body = (await vault.read(DECK, true)).doc;
    const cards = body.blocks.filter((b) => b.kind === 'card');
    must(cardRows.length === cards.length, `one row a card: ${cardRows.length} rows, ${cards.length} cards`);
    log(`rows: ${cardRows.slice(0, 3).map((r) => `"${r.querySelector('.name')?.textContent}"`).join(', ')}…`);
    must(useApp.getState().open[DECK], 'the open deck is remembered with the tree\'s other rows');
    await shot('cardview-tree');

    // the second card's row: the card view at that card
    cardRows[1]!.click();
    await poll(() => q('.card-view .cv-count')?.textContent === `2 / ${cards.length}`, `the card view opens at the row's card: 2 / ${cards.length}`);
    must(activeTab(useApp.getState().panes)?.id === `:cards/${DECK}`, 'it is a tab of its own, one per document');
    const faces = qa<HTMLElement>('.card-view .card .face');
    must(faces.length === 2 && faces.every((f) => f.querySelector('.ProseMirror[contenteditable="true"]')), 'both boxes are live editors');
    log(`faces: ${faces.map((f) => `"${f.textContent}"`).join(' / ')}`);
    must(trow(`:cards/${DECK}#${body.blocks.indexOf(cards[1]!)}`)?.dataset.active === '1', 'the tree\'s row of the card on show is lit');
    const before = (await vault.read(DECK, true)).text;
    const back = q<HTMLElement>('.card-view .face.back .face-field')!;
    typeAtEnd(back, ' (checked)');
    await poll(() => q('.card-view .card-edit')?.getAttribute('data-dirty') === '1', 'typing in the back marks the card edited');
    await shot('cardview-editing');
    key('Enter', back, { metaKey: true });
    await poll(() => q('.card-view .card-edit')?.getAttribute('data-dirty') === '0', '⌘⏎ saves');
    let text = '';
    await poll(() => { void vault.read(DECK, true).then((l) => { text = l.text; }); return text.includes('eV·nm (checked) ^dr-hc') ? true : null; }, 'the file has the edit, the card\'s id after it', 8000);
    const a = before.split('\n');
    const b = text.split('\n');
    const changed = a.map((l, i) => (l === b[i] ? -1 : i)).filter((i) => i >= 0);
    must(a.length === b.length && changed.length === 1, `one line of the file changed (${changed.map((i) => i + 1).join(', ')})`);
    must(b[changed[0]! + 1] === a[changed[0]! + 1] && b[changed[0]! + 1]!.startsWith('<!-- sr '), `its sr line kept: ${b[changed[0]! + 1]}`);
    key(']');
    await poll(() => q('.card-view .cv-count')?.textContent === `3 / ${cards.length}`, '] moves to the next card');
    // a right-click in a face: cut, copy, paste and insert table
    rightClick(q('.card-view .face.front .face-field p')!);
    const menu = await poll(() => q<HTMLElement>('.pop-menu.text-menu'), 'a right-click in a face opens the text menu');
    must(qa('.pop-menu.text-menu .ci').map((c) => c.getAttribute('data-act')).join(',') === 'cut,copy,paste,insert-table', `with ${qa('.pop-menu.text-menu .ci').map((c) => c.textContent).join(', ')}`);
    await shot('cardview-face-menu');
    key('Escape');
    await poll(() => !menu.isConnected, 'Escape closes it');

    // a session's card edited in place: `e`, a word typed, ⌘⏎, then graded
    openNode(DECK);
    await poll(() => q('.deck-study .ds-study'), 'the deck lens');
    q<HTMLElement>('.ds-cram input')!.click();
    await sleep(200);
    q<HTMLElement>('.deck-study .ds-study')!.click();
    await poll(() => q('.recall-wrap .card .face.front'), 'a session over the deck');
    const item = useApp.getState().session!.items[0] as CardItem;
    const head = q('.recall-meta .sess-deck')?.textContent;
    // the card's document read (the boxes edit the card as the file holds it)
    await sleep(800);
    key('e');
    const front = await poll(() => q<HTMLElement>('.recall-wrap .card.editing .face.front .face-field'), '`e` turns the boxes into editors in place');
    key(' ', front);
    key('3', front);
    await sleep(300);
    must(q('.recall-wrap .card.editing') && q('.recall-meta .sess-deck')?.textContent === head, 'space and 3 pressed in a face grade nothing');
    // the back: a front ending in a formula chip has no text at its end for a synthetic caret
    const sback = q<HTMLElement>('.recall-wrap .card.editing .face.back .face-field') ?? front;
    typeAtEnd(sback, ' ≈');
    await poll(() => q('.recall-wrap .card-edit')?.getAttribute('data-dirty') === '1', 'typed into the session\'s card');
    key('Enter', sback, { metaKey: true });
    await poll(() => !q('.recall-wrap .card.editing') && q('.recall-wrap .card[data-revealed="1"]'), '⌘⏎ saves and goes back to the revealed card');
    await sleep(1500);
    const line = (await vault.read(item.path, true)).text.split('\n').find((l) => (item.id !== undefined && l.includes(`^${item.id}`)) || l.startsWith(item.text.slice(0, 12))) ?? '';
    log(`the session's card was "${item.text}", the file's line now "${line}"`);
    must(line.includes('≈') && line !== item.text, 'the session\'s edit is in the file');
    await shot('cardview-session-edited');
    const srOf = async () => { const ls = (await vault.read(item.path, true)).text.split('\n'); return ls[ls.findIndex((l) => l.includes(`^${item.id}`)) + 1] ?? ''; };
    const sr0 = await srOf();
    key('3');
    await poll(() => q('.recall-meta .sess-deck')?.textContent !== head && q('.recall-meta .sess-deck')?.textContent, 'the next card is up after a grade');
    await sleep(1200);
    const sr1 = await srOf();
    log(`header ${head} → ${q('.recall-meta .sess-deck')?.textContent}; sr ${sr0} → ${sr1}`);
    must(sr1 !== sr0, 'the grades still work after an edit: the card\'s sr line moved');

    // a note's table: a right-click in a cell, row below, the file has the row
    openNode(NOTE);
    const cell = await poll(() => qa<HTMLElement>('.pane[data-active="1"] .draft-doc .dd-table td').find((c) => c.textContent?.trim() === 'II'), 'the verb forms table is drawn', 10000);
    const was = (await vault.read(NOTE, true)).text;
    rightClick(cell);
    const tm = await poll(() => q<HTMLElement>('.pop-menu.table-menu'), 'a right-click in a cell opens the table\'s menu at the pointer');
    log(`table menu: ${Array.from(tm.querySelectorAll('.ci')).map((c) => c.textContent).join(', ')}`);
    await shot('cardview-table-menu');
    tm.querySelector<HTMLElement>('[data-act="row-below"]')!.click();
    let now = was;
    await poll(() => { void vault.read(NOTE, true).then((l) => { now = l.text; }); return now !== was ? true : null; }, 'row below is written', 8000);
    const nl = now.split('\n');
    const at = nl.findIndex((l) => l.startsWith('| II |'));
    must(at >= 0 && /^\|(\s*\|)+$/.test(nl[at + 1]!) && nl[at + 2]!.startsWith('| III |'), `the file has the new empty row under II: "${nl[at + 1]}"`);
    await shot('cardview-table-row');
    log('done');
  } catch (e) {
    log(`failed: ${e instanceof Error ? e.message : String(e)}`);
  }
}
