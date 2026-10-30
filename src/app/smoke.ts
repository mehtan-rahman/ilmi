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
// `ILMI_SMOKE=notes` (`smokeNotes`) over a copy of `samples/double-major`:
// a typeless file opens as a note, the five kind words in the menus, a note
// revisited from the top and from a heading, `e` typed over a selection in
// a note, ⌘⇧E and ⌘⇧M there, bare `e` in a frozen source, F2 only in the
// tree, and an import landing as a source (see the function).
// `ILMI_SMOKE=editing` (`smokeEditing`) over a copy of `samples/double-major`:
// the formatting keys, the block rules, lists moved and indented with their
// children, ⌘K and a pasted address, and the selection toolbar (see the
// function).
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
import { queue } from '../schedule/index.js';
import type { Vault } from '../vault/index.js';
import { cardLabel } from './chrome.js';
import { GLYPH, SESSION, queueId, titleOf } from './names.js';
import { vaultName } from './recents.js';
import { useApp } from './store.js';
import { runMenu } from './menu.js';
import { createNode, currentVault, importNode, moveNode, toggleOpen, openCard, openIntake, openNode, openSession, removeNode, renameNode, setInspector, startFromRecents } from './vault.js';
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
    log(`rule ${rule ? `${rule.style.top} + ${rule.style.height}` : 'none'}; frozen ${document.querySelector('.frozen-tag')?.textContent}; editable ${surface.contentEditable}`);

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
    (document.querySelector<HTMLElement>('.frozen-tag'))?.click();
    await until(() => (document.querySelector('.frozen-tag')?.textContent === 'editable' ? true : null));
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
    log(`reader: h1 "${h1.textContent}"; ${q('.frozen-tag')?.textContent}; paragraphs ${document.querySelectorAll('.draft-doc p.dd-p').length}; intake tabs left ${document.querySelectorAll('.tabbar .tab[data-t="intake"]').length}`);

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
    log(`imported ${path}; frozen ${q('.frozen-tag')?.textContent}; enrol button "${q('.frozen-tag.enrol')?.textContent}"; bottom strip "${q('.bot')?.textContent}"; inspector "${qa('.insp .block h6').map((h) => h.textContent).join(', ')}"`);

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
    log(`reader: crumb "${q('.doc-view .crumb')?.textContent}"; blocks ${surface.children.length}; marks ${surface.querySelectorAll('.ed-mark').length}; frozen ${q('.frozen-tag')?.textContent}; enrol "${q('.frozen-tag.enrol')?.textContent}"; first block "${surface.firstElementChild?.textContent?.slice(0, 60)}"`);
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
    log(`new with content: ${p1}; ${await fileLines(p1)}; ${tab()}; ${notice()}; h1 "${q('.doc-view h1')?.textContent}"; ${q('.frozen-tag')?.textContent}`);
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
    log(`reader: h1 "${h1.textContent}"; ${q('.frozen-tag')?.textContent}; inspector ${qa('.insp .kv .kvr').map((r) => `${r.querySelector('dt')?.textContent}=${r.querySelector('dd')?.textContent?.slice(0, 80)}`).join(' | ')}`);
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
    log(`reader: children ${s1.children.length}; p "${s1.querySelector('p.dd-p')?.textContent}"; marks ${s1.querySelectorAll('.ed-mark').length}; frozen ${q('.frozen-tag')?.textContent}`);
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
    log(`sampler: blocks ${surface.children.length}; frozen ${q('.frozen-tag')?.textContent}; editable ${surface.contentEditable}; ${drawn()}`);
    log(`first paragraph reads: "${surface.querySelector('p.dd-p')?.textContent}"`);
    log(`markers hidden: ${qa<HTMLElement>('.draft-doc p .md-mark.hidden').slice(0, 3).map((m) => `"${m.textContent}" ${Math.round(m.getBoundingClientRect().width)}px wide`).join(', ')}`);
    await shot('render-sampler');

    // thawed: the markers show, dimmed
    q<HTMLButtonElement>('.frozen-tag[data-frozen="1"]')!.click();
    await until(() => (q('.frozen-tag[data-frozen="0"]') ? true : null));
    await sleep(400);
    const mark = q<HTMLElement>('.draft-doc p .md-mark');
    log(`thawed: editable ${surface.contentEditable}; markers ${n('.draft-doc .md-mark')} (hidden ${n('.draft-doc .md-mark.hidden')}); first marker "${mark?.textContent}" ${mark ? Math.round(mark.getBoundingClientRect().width) : 0}px wide, colour ${mark ? getComputedStyle(mark).color : ''}`);
    await shot('render-markers');
    q<HTMLButtonElement>('.frozen-tag[data-frozen="0"]')!.click();
    await until(() => (q('.frozen-tag[data-frozen="1"]') ? true : null));
    await sleep(300);

    // a drawn atom's source while it is selected: click the table (a list is edited in place since 27)
    const list = surface.querySelector<HTMLElement>('.raw.rendered[data-kind="table"]')!;
    const lb = list.getBoundingClientRect();
    const target = list.querySelector<HTMLElement>('.raw-view td') ?? list;
    for (const type of ['mousedown', 'mouseup', 'click']) target.dispatchEvent(new MouseEvent(type, { bubbles: true, cancelable: true, button: 0, buttons: type === 'mousedown' ? 1 : 0, detail: 1, clientX: lb.left + 10, clientY: lb.top + 10, view: window }));
    await sleep(200);
    log(`table clicked: selected ${list.classList.contains('selected')}; source shown ${list.querySelector('.raw-src') ? getComputedStyle(list.querySelector('.raw-src')!).display : 'none'}; view shown ${getComputedStyle(list.querySelector('.raw-view')!).display}`);
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
    q<HTMLButtonElement>('.frozen-tag[data-frozen="1"]')!.click();
    await until(() => (q('.frozen-tag[data-frozen="0"]') ? true : null));
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
    log(`maxwell open: blocks ${mx.children.length}, chips ${mx.querySelectorAll('.math').length} (${Array.from(mx.querySelectorAll<HTMLElement>('.math')).map((c) => `${c.parentElement?.tagName.toLowerCase()}.${c.parentElement?.className.split(' ')[0]}${c.closest('.card-span') ? '/card' : ''}`).join(' ')}); frozen tag ${q('.frozen-tag')?.getAttribute('data-frozen')}`);
    const frozenTag = q<HTMLButtonElement>('.frozen-tag[data-frozen="1"]');
    if (frozenTag) { frozenTag.click(); await until(() => (q('.frozen-tag[data-frozen="0"]') ? true : null)); }
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
    q<HTMLButtonElement>('.frozen-tag[data-frozen="1"]')!.click();
    await until(() => (q('.frozen-tag[data-frozen="0"]') ? true : null));
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
  const depth = (el: HTMLElement) => Math.round((parseFloat(el.style.paddingLeft || '6') - 6) / 13);
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
 * tab), steps with ⌘⌥↑, and folds the rail with ⌘⇧[; logs the rail, the
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
      const depth = Math.round((parseFloat(r.style.paddingLeft || '6') - 6) / 14);
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
    chord({ key: '{', code: 'BracketLeft', shiftKey: true });
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
// heavy collection shows, one capture each, for a look over the whole app.
export async function smokeTour(vault: Vault): Promise<void> {
  const log = (s: string) => info(`smoke tour: ${s}`);
  const q = <T extends Element>(sel: string) => document.querySelector<T>(sel);
  const shot = async (name: string, ms = 9000) => { await sleep(1500); log(`shot: ${name}`); await sleep(ms); };
  const scrollTo = (text: string) => {
    const el = Array.from(document.querySelectorAll<HTMLElement>('.doc-view .draft-doc > *')).find((e) => e.textContent?.includes(text));
    el?.scrollIntoView({ block: 'start' });
  };
  const open = async (path: string) => { openNode(path); await until(() => q('.doc-view .draft-doc, .deck-view, .folder-view, .pdf-view'), 10000); };
  try {
    for (const p of ['courses', 'courses/fall-2026', 'courses/fall-2026/phys-412-quantum-ii', 'library', 'library/lindqvist-statistical-physics', 'arabic']) toggleOpen(p, true);
    openNode(queueId('today'));
    await until(() => q('.queue'));
    await shot('queue');
    await open('courses/fall-2026/phys-412-quantum-ii/nondegenerate-perturbation-theory.md');
    await shot('note-physics-top');
    scrollTo('second order');
    await shot('note-physics-mid');
    await open('courses/fall-2026/phys-412-quantum-ii.md');
    await shot('notebook');
    await open('courses/fall-2026/arab-401-advanced-grammar/kana-and-its-sisters.md');
    await shot('note-arabic');
    scrollTo('خبر');
    await shot('note-arabic-mid');
    await open('library/lindqvist-statistical-physics/ch-3-the-canonical-ensemble.md');
    await shot('textbook');
    await open('library/classical-prose-reader/11-the-judge-and-the-two-litigants.md');
    await shot('reader-arabic');
    await open('arabic/vocabulary.md');
    await shot('vocab-deck');
    await open('courses/fall-2026/arab-455-abbasid-poetry/term-paper.md');
    await shot('draft');
    await open('courses/fall-2026');
    await shot('folder');
    openNode(queueId('today'));
    await until(() => q('.queue'));
    press('Enter');
    await until(() => q('.recall-wrap .card, .doc-session'), 10000);
    await shot('session-1');
    press(' ');
    await shot('session-1-shown');
    for (let i = 0; i < 6; i++) { press(']'); await sleep(150); }
    await shot('session-2');
    useApp.getState().setTheme('dark');
    await open('courses/fall-2026/phys-415-stat-mech/canonical-ensemble.md');
    await shot('dark-note');
    useApp.getState().setTheme('light');
    log(`done; vault ${vault.root}`);
  } catch (e) {
    log(`failed: ${e instanceof Error ? e.message : String(e)}`);
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
  /** The file once the reader's write has landed (or a little while has passed). */
  const settled = async () => {
    for (let i = 0; i < 30; i++) {
      await sleep(100);
      const t = await text();
      if (t !== last) { await sleep(150); last = await text(); return last; }
    }
    return last;
  };
  /** The note's lines from the anchor paragraph on: what the smoke typed. */
  const region = (t: string) => {
    const lines = t.split('\n');
    const i = lines.findIndex((l) => l.includes(ANCHOR));
    return lines.slice(i + 1).filter((l, k, all) => l || (k > 0 && all[k - 1])).join(' ⏎ ');
  };
  const lineWith = (t: string, needle: string) => t.split('\n').find((l) => l.includes(needle)) ?? '(none)';
  const step = async (label: string) => log(`${label}: ${region(await settled())}`);
  const stepLine = async (label: string, needle: string) => log(`${label}: ${lineWith(await settled(), needle)}`);
  const open = async (path: string) => {
    openNode(path);
    await until(() => (activeTab(useApp.getState().panes)?.id === path ? q('.pane-body .doc-view .draft-doc') : null), 10000);
    await sleep(500);
  };
  const surface = () => q<HTMLElement>('.pane-body .doc-view .draft-doc')!;
  /** The textblock showing `needle`: a paragraph, a heading, an item's text, a quote line, code. */
  const block = (needle: string) => qa<HTMLElement>('p.dd-p, .dd-h, .dd-li .li-text, .dd-ql, pre.dd-code code', surface()).find((p) => p.textContent?.includes(needle));
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
  try {
    for (const p of ['fleeting', 'library', 'library/lindqvist-statistical-physics']) toggleOpen(p, true);
    await open(NOTE);
    last = await text();
    log(`note ${NOTE}: kind ${useApp.getState().docs[NOTE]?.type}, editable ${surface().isContentEditable}; last lines "${region(last) || '(nothing after the anchor)'}"`);

    // a heading: typed, ⌘2, ⌘0 back to a paragraph, ⌘2 again
    await atEnd(ANCHOR);
    await enter();
    await type('Notes for Friday');
    log(`⌘2 taken ${await key('2', { code: 'Digit2', ...MOD })}`);
    await step('⌘2');
    await key('0', { code: 'Digit0', ...MOD });
    await step('⌘0');
    await key('2', { code: 'Digit2', ...MOD });
    await step('⌘2 again');

    // a list by `- `, nested by Tab
    await atEnd('Notes for Friday');
    await enter();
    await type('- ');
    log(`after "- ": caret in ${document.getSelection()?.anchorNode?.parentElement?.closest('.dd-li') ? 'an item' : 'something else'}`);
    await type('adiabatic invariants');
    await enter();
    await type('the action J');
    await key('Tab', { code: 'Tab' });
    await enter();
    await type('area of the ellipse');
    await key('Tab', { code: 'Tab' });
    await enter();
    await key('Tab', { code: 'Tab', shiftKey: true });
    await key('Tab', { code: 'Tab', shiftKey: true });
    await type('the golden rule');
    await enter();
    await type('Fermi constant');
    await step('list typed');
    await shot('editing-list');

    // moved with its children
    await at('adiabatic invariants', 3);
    log(`⌥⇧↓ taken ${await key('ArrowDown', { code: 'ArrowDown', altKey: true, shiftKey: true })}`);
    await step('⌥⇧↓ adiabatic invariants');
    await shot('editing-moved');
    await key('ArrowUp', { code: 'ArrowUp', altKey: true, shiftKey: true });
    await step('⌥⇧↑ back');

    // outdented and indented with its child
    await at('the action J', 2);
    await key('Tab', { code: 'Tab', shiftKey: true });
    await step('⇧Tab the action J (with its child)');
    await key('Tab', { code: 'Tab' });
    await step('Tab the action J back');

    // ⏎ on an empty item: set in, it comes out; at the top, it leaves
    await atEnd('Fermi constant');
    await enter();
    await key('Tab', { code: 'Tab' });
    await step('⏎ then Tab after Fermi constant');
    await enter();
    await step('⏎ on the empty nested item');
    await enter();
    await step('⏎ on the empty item');
    log(`caret in ${document.getSelection()?.anchorNode?.parentElement?.closest('p.dd-p') ? 'a paragraph' : 'something else'}`);

    // Backspace at an item's start: a paragraph; ⌘Z puts it back
    await at('Fermi constant', 0);
    await key('Backspace', { code: 'Backspace' });
    await step('Backspace at the start of Fermi constant');
    await key('z', { code: 'KeyZ', ...MOD });
    await step('⌘Z');

    // a task by `[ ] `, ticked by ⌘⏎, cleared by its box
    await atEnd('Fermi constant');
    await enter();
    await enter();
    await type('[ ] ');
    await type('ask Okonkwo about the shadow');
    await step('[ ] typed');
    await key('Enter', { code: 'Enter', ...MOD });
    await step('⌘⏎');
    const box = await until(() => block('ask Okonkwo')?.closest('.dd-li')?.querySelector<HTMLElement>('.li-task'));
    box.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }));
    await step('the box clicked');

    // numbered by `1. `, an item moved and the numbers following
    await atEnd('ask Okonkwo about the shadow');
    await enter();
    await enter();
    await type('1. ');
    await type('first');
    await enter();
    await type('second');
    await enter();
    await type('third');
    await step('1. typed');
    await at('third', 1);
    await key('ArrowUp', { code: 'ArrowUp', altKey: true, shiftKey: true });
    await step('⌥⇧↑ third');

    // a quote by `> `, off and on by ⌘⇧.
    await atEnd('second');
    await enter();
    await enter();
    await type('> ');
    await type('the classical shadow of this');
    await step('> typed');
    await key('>', { code: 'Period', shiftKey: true, ...MOD });
    await step('⌘⇧. off');
    await key('>', { code: 'Period', shiftKey: true, ...MOD });
    await step('⌘⇧. on');

    // a rule by `---`; `* ` taken back by Backspace
    await atEnd('the classical shadow of this');
    await enter();
    await enter();
    await type('---');
    await step('--- typed');
    await type('* ');
    const listed = !!document.getSelection()?.anchorNode?.parentElement?.closest('.dd-li');
    await key('Backspace', { code: 'Backspace' });
    const back = block('* ')?.tagName.toLowerCase() ?? '(none)';
    log(`"* " made an item ${listed}; Backspace: the text back in a ${back}`);
    document.execCommand('delete');
    document.execCommand('delete');
    await sleep(100);

    // code by a fence and ⏎; ⌘⏎ leaves it
    await type('```py');
    await enter();
    log(`fence ⏎: caret in ${document.getSelection()?.anchorNode?.parentElement?.closest('pre.dd-code') ? 'code' : 'something else'}`);
    await type('E = hbar * omega');
    await key('Enter', { code: 'Enter', ...MOD });
    await step('``` ⏎ and code typed');
    await shot('editing-blocks');

    // display math by `$$` ⏎: the formula's editor opens
    await type('$$');
    await enter();
    const field = await until(() => q<HTMLTextAreaElement>('.pane-body .math-edit textarea'), 3000).catch(() => null);
    log(`$$ ⏎: editor ${field ? `open, "${field.value}"` : 'not open'}`);
    if (field) {
      Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')!.set!.call(field, 'E_n = \\hbar\\omega(n + \\tfrac12)');
      field.dispatchEvent(new Event('input', { bubbles: true }));
      await shot('editing-math');
      field.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));
    }
    await step('$$ written');

    // the formatting keys over the note's own words
    await pickIn('it was due', 'Skipped');
    log(`⌘B taken ${await key('b', { code: 'KeyB', ...MOD })}`);
    await stepLine('⌘B Skipped', 'the 301 re-read');
    await pickIn('it was due', 'today');
    await key('i', { code: 'KeyI', ...MOD });
    await stepLine('⌘I today', 'the 301 re-read');
    await pickIn('it was due', '301');
    await key('e', { code: 'KeyE', ...MOD });
    await stepLine('⌘E 301', 'the 301 re-read');
    await pickIn('it was due', 'Tomorrow.');
    await key('x', { code: 'KeyX', shiftKey: true, ...MOD });
    await stepLine('⌘⇧X Tomorrow.', 'the 301 re-read');
    await pickIn('it was due', 'Skipped');
    await key('b', { code: 'KeyB', ...MOD });
    await stepLine('⌘B Skipped again (off)', 'the 301 re-read');
    await at('it was due', 2);
    await key('3', { code: 'Digit3', ...MOD });
    await stepLine('⌘3', 'the 301 re-read');
    await key('0', { code: 'Digit0', ...MOD });
    await stepLine('⌘0', 'the 301 re-read');
    for (const [code, name] of [['Digit8', '⌘⇧8'], ['Digit7', '⌘⇧7'], ['Digit9', '⌘⇧9'], ['Period', '⌘⇧.']] as const) {
      await at('it was due', 2);
      await key(code === 'Period' ? '>' : '*', { code, shiftKey: true, ...MOD });
      await stepLine(`${name} on`, 'the 301 re-read');
      await at('it was due', 2);
      await key(code === 'Period' ? '>' : '*', { code, shiftKey: true, ...MOD });
      await stepLine(`${name} off`, 'the 301 re-read');
    }

    // ⌘K: the address field over a selection; a pasted address over another
    await pickIn('mostly', 'Ibn Sīnā');
    log(`⌘K taken ${await key('k', { code: 'KeyK', ...MOD })}; palette ${useApp.getState().paletteOpen ? 'open' : 'closed'}`);
    const addr = await until(() => q<HTMLInputElement>('.link-pop .field'), 3000).catch(() => null);
    log(`link field: ${addr ? 'open' : 'not open'}`);
    if (addr) {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(addr, 'https://plato.stanford.edu/entries/ibn-sina-natural/');
      addr.dispatchEvent(new Event('input', { bubbles: true }));
      await shot('editing-link');
      addr.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));
    }
    await stepLine('⌘K link', 'Ibn Sīnā');
    await at('adiabatic theorem today', 2);
    log(`⌘K with a bare caret: taken ${await key('k', { code: 'KeyK', ...MOD })}`);
    await sleep(300);
    log(`palette ${useApp.getState().paletteOpen ? 'open' : 'closed'}`);
    if (useApp.getState().paletteOpen) useApp.setState({ paletteOpen: false });
    await pickIn('adiabatic theorem today', 'adiabatic theorem');
    try {
      const dt = new DataTransfer();
      dt.setData('text/plain', 'https://en.wikipedia.org/wiki/Adiabatic_theorem');
      surface().dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true }));
    } catch (e) {
      log(`paste: ${e instanceof Error ? e.message : String(e)}`);
    }
    await stepLine('pasted address', 'adiabatic theorem');

    // the toolbar: over a selection, above it; `b` from it; gone with the selection
    await pickIn('canonical-transformation', 'the canonical-transformation section');
    const cue = await until(() => q<HTMLElement>('.pane-body .sel-cue'), 3000).catch(() => null);
    const range = window.getSelection()?.rangeCount ? window.getSelection()!.getRangeAt(0).getBoundingClientRect() : null;
    log(`toolbar: ${cue ? qa<HTMLElement>('button', cue).map((b) => b.textContent?.trim()).join(' | ') : 'none'}; place ${cue?.dataset.place}; its bottom ${cue ? Math.round(cue.getBoundingClientRect().bottom) : '-'} vs the selection's top ${range ? Math.round(range.top) : '-'}`);
    await shot('editing-toolbar');
    q<HTMLElement>('.pane-body .sel-cue .cue-fmt[data-fmt="strong"]')?.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }));
    await stepLine('toolbar b', 'canonical-transformation');
    window.getSelection()?.collapseToEnd();
    await sleep(300);
    log(`selection collapsed: toolbar ${q('.pane-body .sel-cue') ? 'still there' : 'gone'}`);

    // a frozen source: the toolbar is card and extract only
    await open(SOURCE);
    const sp = await until(() => qa<HTMLElement>('p.dd-p', surface()).find((p) => (p.textContent?.length ?? 0) > 80));
    select(sp, sp.textContent!.split(/\s+/).slice(0, 4).join(' '));
    const fcue = await until(() => q<HTMLElement>('.pane-body .sel-cue'), 3000).catch(() => null);
    log(`frozen source toolbar: ${fcue ? qa<HTMLElement>('button', fcue).map((b) => b.textContent?.trim()).join(' | ') : 'none'}; editable ${surface().isContentEditable}`);
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
