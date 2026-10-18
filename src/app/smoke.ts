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
// `ILMI_SMOKE=plugins` opens tweaks and reads the sample plugin's row, turns
// it off and on, runs its command from the palette, selects a passage and
// runs its verb from the cue, finds the `[hello]` it lights in a source and
// in a deck, edits its setting, grades a card and reads the plugin's
// notice, touches `main.js` on disk for the reload notice, removes the
// plugin's folder, and adds it back from a zip (`ILMI_PLUGIN_ZIP=<path>`,
// `plugins/dist/hello.zip` after `npm run plugins`) through the section's
// hook.

import { invoke } from '@tauri-apps/api/core';
import { info } from '@tauri-apps/plugin-log';
import { queue } from '../schedule/index.js';
import type { Vault } from '../vault/index.js';
import { cardLabel } from './chrome.js';
import { GLYPH, SESSION, queueId, titleOf } from './names.js';
import { useApp } from './store.js';
import { createNode, moveNode, openCard, openIntake, openNode, openSession, removeNode, renameNode, setInspector } from './vault.js';
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

/** Select `text` inside the paragraph `p`, as a pointer would. */
function select(p: HTMLElement, text: string): void {
  const node = p.firstChild;
  const at = node?.textContent?.indexOf(text) ?? -1;
  if (!node || at < 0) throw new Error(`no "${text}" in the paragraph`);
  const r = document.createRange();
  r.setStart(node, at);
  r.setEnd(node, at + text.length);
  const sel = window.getSelection()!;
  sel.removeAllRanges();
  sel.addRange(r);
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
    q<HTMLButtonElement>('.intake .paste-hint .link')!.click();
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
    q<HTMLButtonElement>('.intake .paste-hint .link')!.click();
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
    menu2.querySelector<HTMLElement>('.ci.has-sub')!.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));
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
  const shot = async (name: string, ms = 1800) => { await sleep(600); log(`shot: ${name}`); await sleep(ms); };
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
    q<HTMLButtonElement>('.intake .paste-hint .link')!.click();
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
