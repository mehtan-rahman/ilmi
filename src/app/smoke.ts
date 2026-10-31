// Dev only: `ILMI_VAULT=/path ILMI_SMOKE=1 npm run tauri dev` runs every
// tree operation through the real Tauri fs adapter and logs each result to
// the terminal, since this sandbox cannot see the window. Point it at a
// scratch copy of a vault: it creates, renames, moves, and deletes files.
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
// `ILMI_SMOKE=pdf` drops the corpus PDF on the intake, places it as the
// pair, opens it as pages, selects on the text layer and presses `e` and
// `m`, searches, goes to a page, reads the text instead, reads on from the
// session, and reopens it to find the extract drawn as a highlight.
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
// `ILMI_SMOKE=welcome` runs before any vault opens: it seeds the recents
// with the scratch vault (`ILMI_VAULT`) and a path that does not exist,
// turns `reopen the last vault on start` off, reads the welcome's rows and
// the dimmed one, opens the scratch vault from its row, closes it from the
// palette, names a new vault beside the scratch one and reads its
// `start here.md`, switches back through the palette's `vaults` group,
// turns the toggle on, and reloads the page; the second run (a
// sessionStorage marker) only checks that the vault opened itself.

import { invoke } from '@tauri-apps/api/core';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { info } from '@tauri-apps/plugin-log';
import { queue, type CardItem } from '../schedule/index.js';
import type { Vault } from '../vault/index.js';
import { cardLabel } from './chrome.js';
import { GLYPH, SESSION, queueId, titleOf } from './names.js';
import { vaultName } from './recents.js';
import { useApp } from './store.js';
import { runMenu } from './menu.js';
import { createNode, currentVault, importNode, moveNode, toggleOpen, openCard, openIntake, openNode, openSession, removeNode, renameNode, setInspector, setSidebar, startFromRecents } from './vault.js';
import { activeTab } from './panes.js';

const WOZ = 'papers/wozniak-1990.md';

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

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
    const schedBlock = () => Array.from(document.querySelectorAll<HTMLElement>('.insp .block')).find((b) => b.querySelector('h6')?.textContent === 'schedule');
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
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input, label);
      input.dispatchEvent(new Event('input', { bubbles: true }));
      await sleep(100);
      const rowsNow = Array.from(document.querySelectorAll<HTMLElement>('.palette-row'));
      const at = rowsNow.findIndex((r) => r.dataset.t === 'card' && r.querySelector('.pt')?.textContent === label);
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


export async function smokePdf(vault: Vault): Promise<void> {
  const log = (s: string) => info(`smoke pdf: ${s}`);
  const shot = async (name: string, ms = 10000) => { await sleep(600); log(`shot: ${name}`); await sleep(ms); };
  const q = <T extends Element>(sel: string) => document.querySelector<T>(sel);
  const qa = (sel: string) => Array.from(document.querySelectorAll<HTMLElement>(sel));
  const lines = (text: string, from: string, n = 6) => { const ls = text.split('\n'); const i = ls.findIndex((l) => l.startsWith(from)); return i < 0 ? 'none' : ls.slice(i, i + n).join(' / '); };
  const fm = (text: string) => text.split('\n').slice(0, text.split('\n').indexOf('---', 1) + 1).join(' / ');
  const highlights = (kind: string) => (typeof CSS !== 'undefined' && CSS.highlights ? CSS.highlights.get(kind)?.size ?? 0 : 'no api');
  /** Select the first text-layer span on page `n` whose text holds `word`: the whole span, or just `part` of it. */
  const selectOn = (n: number, word: string, part?: string) => {
    const span = qa(`.pdf-page[data-page="${n}"] .textLayer span`).find((s) => s.textContent?.includes(word));
    if (!span?.firstChild) throw new Error(`no "${word}" on page ${n}`);
    const r = document.createRange();
    if (part === undefined) r.selectNodeContents(span.firstChild);
    else {
      const at = span.textContent!.indexOf(part);
      r.setStart(span.firstChild, at);
      r.setEnd(span.firstChild, at + part.length);
    }
    const sel = window.getSelection()!;
    sel.removeAllRanges();
    sel.addRange(r);
    return part ?? span.textContent ?? '';
  };
  try {
    setInspector({ open: true });
    // the intake: the corpus PDF dropped on it (through the dev hook; the OS drop cannot be faked)
    openIntake('papers');
    await until(() => q<HTMLTextAreaElement>('.intake textarea'));
    log(`intake hint: "${q('.intake .paste-hint')?.textContent}"`);
    const { intakeHooks } = await import('./Intake.js');
    const { readDroppedPdf } = await import('./fetch.js');
    try {
      const r = await readDroppedPdf(vault.abs('papers/two-pages.pdf'));
      log(`read: ${r.bytes.length} bytes, ${r.pages} pages, title "${r.title}", text ${r.text.length} chars`);
    } catch (e) {
      log(`read failed: ${e instanceof Error ? `${e.name}: ${e.message}` : String(e)}`);
    }
    await intakeHooks.ingestFile!(vault.abs('papers/two-pages.pdf'));
    const detail = await until(() => q('.intake-detail') ?? (q('.intake .paste-hint .note')?.textContent && q('.intake .paste-hint .note')?.textContent !== 'reading' ? q('.intake .paste-hint') : null), 15000);
    if (!detail.classList.contains('intake-detail')) throw new Error(`intake said "${detail.textContent}"`);
    log(`dropped: stats "${detail.querySelector('.stats')?.textContent}"; title "${q<HTMLInputElement>('.intake .field input')?.value}"; text "${q<HTMLTextAreaElement>('.intake textarea')?.value.slice(0, 60).replace(/\n/g, ' ')}…"`);
    await shot('pdf-intake');
    q<HTMLButtonElement>('.intake .place.primary')!.click();
    const path = await until(() => vault.documents().find((d) => d.startsWith('papers/two-pages') && d !== 'papers/two-pages.md' && !d.includes('/two-pages/')));
    await sleep(400);
    const pdfPath = useApp.getState().docs[path]?.pdf;
    const landed = await vault.read(path, true);
    log(`placed ${path}; pages ${pdfPath}; on disk ${(await vault.fs.stat(vault.abs(pdfPath ?? '')))?.size ?? '?'} bytes; front-matter ${fm(landed.text)}; body ${landed.doc.blocks.map((b) => b.kind).join(',')}; diagnostics ${landed.diagnostics.length}`);

    // the lens: pages rendered, the text layer on, the meta row
    await until(() => q('.pdf-view'));
    await until(() => q('.pdf-page[data-page="1"] .textLayer span'), 15000);
    await until(() => q('.pdf-page[data-page="2"] .textLayer span'), 15000);
    await sleep(400);
    log(`lens: pages ${qa('.pdf-page').length}, canvases ${qa('.pdf-page canvas').length}, text spans ${qa('.textLayer span').length}; meta "${q('.pdf-view .meta')?.textContent}"; strip "${q('.bot')?.textContent}"; inspector rows "${q('.insp .kv')?.textContent?.slice(0, 120)}"; rule ${q('.read-rule') ? 'yes' : 'none'}`);
    await shot('pdf-pages');

    // start reading: the ruler appears
    press('r');
    await until(() => q('.pdf-view .read-gutter'));
    await sleep(400);
    log(`reading: ${lines((await vault.read(path, true)).text, 'read:', 1)}; rule height ${q<HTMLElement>('.read-rule')?.style.height}`);

    // extract: a line of page 1 selected on the text layer, e
    const picked = selectOn(1, 'ruler');
    const cue = await until(() => q('.sel-cue'));
    log(`selected "${picked}" → cue "${cue.textContent}"`);
    press('e');
    const child = await until(() => vault.documents().find((d) => d.startsWith(`${path.slice(0, -3)}/`)));
    await sleep(800);
    const ex = await vault.read(child, true);
    const parent = await vault.read(path, true);
    log(`extract ${child}: ${fm(ex.text)}; body "${ex.doc.blocks[0]?.text}"; diagnostics ${ex.diagnostics.length}`);
    log(`parent: ${lines(parent.text, '## p. 1')}; diagnostics ${parent.diagnostics.length}; highlights ${highlights('ilmi-extract')}; rail "${qa('.rail-page').map((r) => r.textContent).join(' | ')}"`);
    await shot('pdf-extract');

    // a card: a line of page 2 selected, m, a blank, ⌘↵
    const line2 = selectOn(2, 'Spaced');
    await until(() => q('.sel-cue'));
    press('m');
    const ta = await until(() => q<HTMLTextAreaElement>('.composer textarea'));
    log(`composer seed "${ta.value}" (selected "${line2}")`);
    const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')!.set!;
    setter.call(ta, 'Spaced practice beats {{massed}} practice, and the gap should grow');
    ta.dispatchEvent(new Event('input', { bubbles: true }));
    await sleep(100);
    press('Enter', { metaKey: true });
    await until(() => (q('.composer') ? null : true));
    await sleep(800);
    const withCard = await vault.read(path, true);
    log(`card: ${lines(withCard.text, '## p. 2')}; cards ${withCard.doc.blocks.filter((b) => b.kind === 'card').length}; diagnostics ${withCard.diagnostics.length}; rail "${qa('.rail-page').map((r) => r.textContent).join(' | ')}"`);
    // the rail's card row selects it; the inspector names the page
    qa('.rail-item[data-t="card"]')[0]?.click();
    await sleep(300);
    log(`rail card: selected ${JSON.stringify(useApp.getState().selectedCard)}; inspector "${qa('.insp .block')[0]?.querySelector('.kv')?.textContent}"`);
    await shot('pdf-card');

    // search and go to page
    press('/');
    const findInput = await until(() => q<HTMLInputElement>('.pdf-bar input'));
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(findInput, 'written');
    findInput.dispatchEvent(new Event('input', { bubbles: true }));
    await sleep(50);
    findInput.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));
    await sleep(600);
    log(`search "written": bar "${q('.pdf-bar')?.textContent}"; hits highlighted ${highlights('ilmi-hit')}; page in view ${q<HTMLElement>('.pdf-view')?.dataset.page}`);
    await shot('pdf-find');
    press('Escape');
    await sleep(100);
    press('g');
    const gotoInput = await until(() => q<HTMLInputElement>('.pdf-bar input[type="number"]'));
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(gotoInput, '1');
    gotoInput.dispatchEvent(new Event('input', { bubbles: true }));
    gotoInput.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));
    await sleep(500);
    log(`go to 1: bar ${q('.pdf-bar') ? 'open' : 'closed'}; page in view ${q<HTMLElement>('.pdf-view')?.dataset.page}`);
    press(']');
    await sleep(500);
    log(`]: page in view ${q<HTMLElement>('.pdf-view')?.dataset.page}`);

    // smart jump: a figure reference and a citation on page 1, ⏎, the peek names the page of the caption and the entry
    q<HTMLElement>('.pdf-page[data-page="1"]')?.scrollIntoView({ block: 'start' });
    await sleep(400);
    for (const [word, part] of [['Figure 1 shows', 'Figure 1'], ['names the method', '[1]']] as const) {
      selectOn(1, word, part);
      // the lens reads the selection on `selectionchange`, a task later; the cue from the last selection is still up
      await sleep(300);
      await until(() => (q('.sel-cue') && useApp.getState() ? true : null));
      press('Enter');
      const peek = await until(() => q('.pdf-peek canvas[width]'), 8000);
      await sleep(300);
      log(`jump "${part}": peek "${q('.pdf-peek .pk-hd')?.textContent}"; canvas ${peek.getAttribute('width')}×${peek.getAttribute('height')}; still on page ${q<HTMLElement>('.pdf-view')?.dataset.page}`);
      if (part === 'Figure 1') await shot('pdf-jump');
      press('Escape');
      await until(() => (q('.pdf-peek') ? null : true));
    }
    // a selection that is no reference: ⏎ does nothing here
    selectOn(1, 'ruler');
    await sleep(300);
    press('Enter');
    await sleep(400);
    log(`⏎ on prose: peek ${q('.pdf-peek') ? 'open' : 'none'}`);
    window.getSelection()?.removeAllRanges();
    await until(() => (q('.sel-cue') ? null : true));

    // the text toggle: the Markdown in the reader, and back
    q<HTMLButtonElement>('.pdf-view .meta .frozen-tag')!.click();
    await until(() => q('.draft-doc'));
    await sleep(300);
    log(`text: blocks ${q('.draft-doc')?.children.length}; meta "${q('.doc-view .meta')?.textContent}"`);
    await shot('pdf-text');
    qa('.doc-view .meta .frozen-tag').find((b) => b.textContent === 'pages')?.click();
    await until(() => q('.pdf-view'));

    // the session: the reading element opens as pages; read on records the page in view
    openNode(queueId('today'));
    await until(() => q('.queue .qlist li'));
    await sleep(300);
    // the corpus's own two-pages pair is due today as well and carries the same title, so the element is picked from the queue by path
    const item = useApp.getState().queue.find((i) => i.kind === 'read' && i.path === path);
    log(`queue: item ${item ? `${item.kind} ${item.path} due ${item.due}` : 'none'}; rows naming two-pages ${qa('.queue .qlist li').filter((r) => r.textContent?.includes('two-pages')).length}`);
    if (!item) throw new Error('not in the queue');
    const corpusBefore = (await vault.read('papers/two-pages.md', true)).text;
    openSession(item);
    await until(() => q('.doc-session .pdf-view'));
    await until(() => q('.doc-session .pdf-page[data-page="2"] .textLayer span'), 15000);
    await sleep(300);
    q<HTMLElement>('.doc-session .pdf-page[data-page="2"]')?.scrollIntoView({ block: 'start' });
    await sleep(500);
    log(`session: bar "${q('.session-bar')?.textContent?.slice(0, 80)}"; page in view ${q<HTMLElement>('.pdf-view')?.dataset.page}; highlights ${highlights('ilmi-extract')}`);
    await shot('pdf-session');
    press('Enter');
    await sleep(800);
    log(`read on: ${lines((await vault.read(path, true)).text, 'read:', 1)}; log "${useApp.getState().log[0]}"; the corpus pair untouched ${(await vault.read('papers/two-pages.md', true)).text === corpusBefore}; session now on "${useApp.getState().sessionEl?.label}"`);

    // reopened: the extract is a highlight again, the ruler on the page read to
    openNode(path);
    await until(() => q('.pdf-view:not(.doc-session .pdf-view)'));
    await until(() => q('.pdf-page[data-page="1"] .textLayer span'), 15000);
    await sleep(600);
    log(`reopened: highlights ${highlights('ilmi-extract')}; rule height ${q<HTMLElement>('.read-rule')?.style.height}; rail "${qa('.rail-page').map((r) => r.textContent).join(' | ')}"; inspector rows "${q('.insp .kv')?.textContent?.slice(0, 160)}"`);
    await shot('pdf-reopened');
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
    const apkg = (await invoke<string | null>('dev_env', { name: 'ILMI_APKG' })) ?? vault.abs('two-decks.apkg');
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
    const epub = (await invoke<string | null>('dev_env', { name: 'ILMI_EPUB' })) ?? vault.abs('three-chapters.epub');
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
    if (!scratch) throw new Error('ILMI_VAULT names the scratch vault to seed the recents with');
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

    // the first run: seed the recents, toggle off, then let the start decide
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

    // a new vault beside the scratch one: the picker cannot be faked, so the parent is set through the store
    const parent = scratch.slice(0, scratch.lastIndexOf('/'));
    const name = `welcome-smoke-${new Date().toISOString().slice(11, 19).replace(/:/g, '')}`;
    useApp.setState({ newVaultIn: parent });
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
    const epub = (await invoke<string | null>('dev_env', { name: 'ILMI_EPUB' })) ?? vault.abs('three-chapters.epub');
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
    const pdf = vault.abs('papers/two-pages.pdf');
    const epub = (await invoke<string | null>('dev_env', { name: 'ILMI_EPUB' })) ?? vault.abs('three-chapters.epub');
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

    // ⏎ on the fourth row: type onto its back, ⌘⏎ saves
    click(rows()[3]!);
    key('Enter');
    const back = await until(() => q<HTMLElement>('.deck-edit .face.back .face-field'));
    await shot('decks-editor', 4000);
    back.focus();
    const sel = window.getSelection()!;
    sel.selectAllChildren(back);
    sel.collapseToEnd();
    document.execCommand('insertText', false, '; to lose');
    await sleep(200);
    back.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', metaKey: true, bubbles: true, cancelable: true }));
    await until(() => (!q('.deck-edit') ? true : null), 5000);
    await sleep(600);
    log(`edited back: lines: ${await lines()}`);

    // the fifth row to cloze from the editor's switch, saved by a press outside
    click(rows()[4]!);
    key('Enter');
    await until(() => q('.deck-edit'));
    qa<HTMLElement>('.deck-edit .type-toggle button').find((b) => b.textContent?.startsWith('cloze'))?.click();
    await sleep(300);
    log(`switched to cloze: front "${q('.deck-edit .face.front')?.textContent}"`);
    q<HTMLElement>('.deck-view h1')!.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }));
    await until(() => (!q('.deck-edit') ? true : null), 5000);
    await sleep(600);
    log(`to cloze: lines: ${await lines()}`);
    await shot('decks-edited');

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
    must(tags.every((t) => t === t.toLowerCase() && t !== 'bidir') && getComputedStyle(q('.qlist .kindtag')!).textTransform === 'none', `kinds lowercase (${tags.join(', ')})`);
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
    must(!q('.pane-body .doc-view > h1') && /Chapter 3/.test(q('.pane-body .draft-doc')?.textContent ?? ''), 'the chapter is titled once');

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

    // the session: a one-line cloze is a short card, answered in place
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
      must(card.getBoundingClientRect().height < 220, 'a one-line cloze is a short card');
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
  const dragEv = (type: string, dt: DataTransfer, x: number, y: number) => new DragEvent(type, { bubbles: true, cancelable: true, clientX: x, clientY: y, dataTransfer: dt });
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
    const dt = new DataTransfer();
    // the target in the middle of its scroller, so the edge scroll does not move it under the pointer during a rest (39)
    to.scrollIntoView({ block: 'center' });
    await sleep(100);
    from.dispatchEvent(dragEv('dragstart', dt, 0, 0));
    await sleep(60);
    const r = to.getBoundingClientRect();
    const y = r.top + r.height * (where === 'top' ? 0.12 : where === 'mid' ? 0.5 : 0.88);
    const x = r.left + (opts.x ?? r.width - 40);
    to.dispatchEvent(dragEv('dragenter', dt, x, y));
    const over = dragEv('dragover', dt, x, y);
    to.dispatchEvent(over);
    if (opts.rest) {
      for (let t = 0; t < opts.rest; t += 100) { await sleep(100); to.dispatchEvent(dragEv('dragover', dt, x, y)); }
    }
    await sleep(120);
    const d = useDrag.getState().drop;
    log(`${name}: ${moving} over the ${where} of ${to.dataset.path}${opts.x !== undefined ? ` (x ${opts.x})` : ''}${opts.rest ? ` resting ${opts.rest} ms` : ''}: accepted ${over.defaultPrevented}, drawn ${mark()}, drop ${d ? `${d.mode} ${d.target}` : 'none (refused)'}`);
    if (opts.shot) await shot(opts.shot, 2500);
    if (opts.esc) {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
      await sleep(80);
      log(`${name}: Esc, drawn ${mark()}`);
    }
    to.dispatchEvent(dragEv('drop', dt, x, y));
    from.dispatchEvent(dragEv('dragend', dt, x, y));
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
      const dt = new DataTransfer();
      trow('fleeting/2026-10-30.md')?.dispatchEvent(dragEv('dragstart', dt, 0, 0));
      for (let k = 0; k < 6 && low; k++) { low.dispatchEvent(dragEv('dragover', dt, sb.left + 60, sb.bottom - 4)); await sleep(40); }
      log(`edge scroll: the sidebar scrolled from 0 to ${side.scrollTop} (${low ? `over ${low.dataset.path}` : 'no row at the edge'})`);
      trow('fleeting/2026-10-30.md')?.dispatchEvent(dragEv('dragend', dt, 0, 0));
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
    await expectLines('/both ways', ['qalam ::: pen']);
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
    must(q('.cs-arrow', qrow)?.textContent === '→' && q('.kindtag', qrow)?.textContent === 'both ways', 'a reverse row reads its asked side first, an arrow to the answer, tagged both ways');
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
  const log = (s: string) => info(`smoke numbers: ${s}`);
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
  const front = async (path: string) => meta(parse(await vault.fs.readText(vault.abs(path))).doc);
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
      const block = Number(leechRows[0]!.dataset.block);
      click(q('button', leechRows[0]!)!);
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
      const doc = parse(await vault.fs.readText(vault.abs(cand!.path))).doc;
      const c = doc.blocks.find((b): b is Card => b.kind === 'card' && b.id === cand!.id);
      const s = c && scheduleOf(c, cand!.group, cand!.dir);
      return s && s.lapses === threshold ? s : null;
    }, `${cand!.id} graded again: ${threshold} lapses`);
    must(graded.suspended === true, `at the threshold it is suspended, its schedule kept (s=${graded.stability?.toFixed(2)}, r=${graded.reps})`);
    // a q&a writes its bare line; a one-blank cloze its bare line, or its own `sr cN` line when it has one
    const keyOk = (k: string | undefined) => (cand!.form === 'qa' ? k === undefined : k === undefined || /^c\d+$/.test(k));
    const lastLine = await poll(async () => {
      const text = await vault.fs.readText(vault.abs(reviewFile(new Date().toISOString())));
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
  }
}
