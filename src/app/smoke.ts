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

import { info } from '@tauri-apps/plugin-log';
import type { Vault } from '../vault/index.js';
import { createNode, moveNode, openIntake, openNode, removeNode, renameNode } from './vault.js';

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
