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

import { info } from '@tauri-apps/plugin-log';
import { queue } from '../schedule/index.js';
import type { Vault } from '../vault/index.js';
import { cardLabel } from './chrome.js';
import { GLYPH, SESSION, queueId, titleOf } from './names.js';
import { useApp } from './store.js';
import { createNode, moveNode, openCard, openIntake, openNode, removeNode, renameNode, setInspector } from './vault.js';

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

