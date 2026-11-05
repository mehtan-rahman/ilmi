// @vitest-environment jsdom
//
// The dictionary plugin: the word's normalization and the order its
// clitics come off, the request URL, the mapping of a saved Wiktionary
// response for an Arabic word and for an English one, the card's text,
// and, through the runtime over the corpus vault, the popover and the deck
// created on the first add. The fixtures are real responses from
// `https://en.wiktionary.org/api/rest_v1/page/definition/<word>`.

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { cardFields, parse } from '../../../src/format/index.js';
import { ROOT, Vault, enable, fakeBridge, memFs, seed, sleep, type FakeBridge, type MemFs } from '../../../src/plugins/__tests__/memfs.js';
import { PluginHost } from '../../../src/plugins/runtime.js';
import type { Selection } from '../../ilmi.js';
import { DEFAULT_URL, bare, candidates, cardText, entriesAt, firstDefinition, htmlToText, languageFor, lookup, requestUrl, stringsAt, trimWord, vocalized, wiktionarySection } from '../main.js';

const fixture = (name: string): unknown => JSON.parse(readFileSync(join(import.meta.dirname, name), 'utf8'));
const DHIKR = fixture('wiktionary-ar-dhikr.json');
const KITAB = fixture('wiktionary-ar-kitab.json');
const MEMORY = fixture('wiktionary-en-memory.json');
const NOT_FOUND = fixture('wiktionary-404.json');

/** What the endpoint holds, by page title. */
const PAGES: Record<string, unknown> = { 'ذكر': DHIKR, 'كتاب': KITAB, memory: MEMORY };

const titleOf = (url: string) => decodeURIComponent(url.slice(url.lastIndexOf('/') + 1));
const answer = (url: string): Response => {
  const body = PAGES[titleOf(url)];
  return body ? new Response(JSON.stringify(body), { status: 200 }) : new Response(JSON.stringify(NOT_FOUND), { status: 404 });
};
const fetchFixtures = async (url: string) => answer(url);

const SENTENCE = 'الذِّكْرُ يَحْفَظُ العِلْمَ، وَالْكِتَابُ يَحْفَظُ الذِّكْرَ.';
const RECT = { top: 100, left: 40, bottom: 120, right: 140, width: 100, height: 20 };
const sel = (text: string, context = text): Selection => ({ text, path: 'papers/archive/sutton-2019.md', block: 3, rect: RECT, context });

describe('the word', () => {
  it('strips the tashkeel and the tatweel, and the punctuation at the edges', () => {
    expect(bare('كِتَابٌ')).toBe('كتاب');
    expect(bare('الذِّكْرُ')).toBe('الذكر');
    expect(bare('كـتـاب')).toBe('كتاب');
    expect(bare('الرَّحْمَٰن')).toBe('الرحمن');
    expect(trimWord('  “memory,” ')).toBe('memory');
    expect(trimWord('الذِّكْرُ،')).toBe('الذِّكْرُ');
    expect(trimWord('(العِلْمَ.)')).toBe('العِلْمَ');
    expect(trimWord('ice   cream')).toBe('ice cream');
  });

  it('tries the word, then each clitic in order, then a second clitic after a conjunction', () => {
    expect(candidates('الذِّكْرُ')).toEqual(['الذكر', 'ذكر']);
    expect(candidates('وَالْكِتَابُ')).toEqual(['والكتاب', 'الكتاب', 'كتاب']);
    expect(candidates('لِلْكِتَابِ')).toEqual(['للكتاب', 'لكتاب', 'كتاب']);
    expect(candidates('بِسْمِ')).toEqual(['بسم', 'سم']);
    expect(candidates('سَيَحْفَظُ')).toEqual(['سيحفظ', 'يحفظ']);
    expect(candidates('فَبِالْحَقِّ')).toEqual(['فبالحق', 'بالحق', 'الحق']);
    // `ك` is a clitic too; the word itself is asked for first, so the shorter form is reached only when it is not a page
    expect(candidates('كتاب')).toEqual(['كتاب', 'تاب']);
    expect(candidates('في')).toEqual(['في']);
    expect(candidates('Memory')).toEqual(['Memory', 'memory']);
    expect(candidates('memory.')).toEqual(['memory']);
    expect(candidates('  ')).toEqual([]);
  });

  it('keeps the vowels of the selection on the headword, less the clitic and the case ending', () => {
    expect(vocalized('الذِّكْرُ', 'ذكر')).toBe('ذِكْر');
    expect(vocalized('كِتَابٌ', 'كتاب')).toBe('كِتَاب');
    expect(vocalized('وَالْكِتَابُ', 'كتاب')).toBe('كِتَاب');
    expect(vocalized('العِلْمَ', 'علم')).toBe('عِلْم');
    expect(vocalized('الذكر', 'ذكر')).toBe('ذكر');
    expect(vocalized('memory', 'memory')).toBe('memory');
    expect(vocalized('Memory', 'memory')).toBe('memory');
  });

  it('picks the language section by the setting, else by the script', () => {
    expect(languageFor('ذكر', undefined)).toBe('ar');
    expect(languageFor('memory', undefined)).toBe('en');
    expect(languageFor('ذكر', 'fa')).toBe('fa');
    expect(languageFor('x', ' EN ')).toBe('en');
    expect(languageFor('x', '')).toBe('en');
  });

  it('fills the url template with the word encoded as a path segment', () => {
    expect(requestUrl('', 'ذكر', 'ar')).toBe('https://en.wiktionary.org/api/rest_v1/page/definition/%D8%B0%D9%83%D8%B1');
    expect(requestUrl(DEFAULT_URL, 'memory', 'en')).toBe('https://en.wiktionary.org/api/rest_v1/page/definition/memory');
    expect(requestUrl('https://d.example/{lang}/{word}', 'ice cream', 'en')).toBe('https://d.example/en/ice_cream');
  });
});

describe('the response', () => {
  it('reduces a definition to text', () => {
    expect(htmlToText('to <a rel="mw:WikiLink" href="/wiki/mention" title="mention">mention</a>')).toBe('to mention');
    expect(htmlToText('verbal noun of <i class="Arab mention" lang="ar">كَتَبَ</i>&nbsp;')).toBe('verbal noun of كَتَبَ');
    expect(htmlToText('a &amp; b &lt;c&gt;')).toBe('a & b <c>');
    expect(htmlToText('  ')).toBe('');
  });

  it('maps the Arabic entries, dropping empty definitions and marking the pointers', () => {
    const s = wiktionarySection(DHIKR, 'ar')!;
    expect(s.lang).toBe('ar');
    expect(s.entries.map((e) => e.pos)).toEqual(['verb', 'verb', 'noun', 'noun', 'noun', 'verb']);
    expect(s.entries[0]).toMatchObject({ pos: 'verb', language: 'Arabic' });
    expect(s.entries[0]!.definitions.slice(0, 3).map((d) => d.text)).toEqual(['to mention', 'to remember, to recall', 'to bear in mind']);
    expect(s.entries[2]!.definitions[0]).toEqual({ text: 'verbal noun of ذَكَرَ (ḏakara)', formOf: true });
    expect(s.entries[2]!.definitions[1]).toEqual({ text: 'recollection, remembrance', formOf: false });
    expect(firstDefinition(s.entries)).toBe('to mention');

    const k = wiktionarySection(KITAB, 'ar')!;
    expect(k.entries[0]!.definitions.length).toBe(7);
    expect(k.entries[0]!.definitions.map((d) => d.text)).toContain('book');
    expect(k.entries[0]!.definitions.find((d) => d.example)).toMatchObject({ text: "the Scripture, the Qur'an or the Bible" });
    // the first meaning, not the first pointer
    expect(firstDefinition(k.entries)).toBe('book');
  });

  it('maps the English entry', () => {
    const s = wiktionarySection(MEMORY, 'en')!;
    expect(s.lang).toBe('en');
    expect(s.entries.length).toBe(1);
    expect(s.entries[0]!.pos).toBe('noun');
    expect(s.entries[0]!.definitions.length).toBe(8);
    expect(s.entries[0]!.definitions[0]!.text).toMatch(/^The ability of the brain to record information/);
    expect(s.entries[0]!.definitions.filter((d) => d.formOf).map((d) => d.text)).toEqual(['Synonym of pelmanism (“memory card game”).']);
    expect(firstDefinition(s.entries)).toMatch(/^The ability of the brain/);
  });

  it('falls back to the first section that has entries, and is null for an error body', () => {
    expect(wiktionarySection(DHIKR, 'en')!.lang).toBe('ar');
    expect(wiktionarySection(MEMORY, 'ar')!.lang).toBe('en');
    expect(wiktionarySection(NOT_FOUND, 'ar')).toBeNull();
    expect(wiktionarySection(null, 'ar')).toBeNull();
    expect(wiktionarySection({ ar: [] }, 'ar')).toBeNull();
  });

  it('reads another dictionary through a json path', () => {
    expect(stringsAt({ a: [{ b: 'x' }, { b: '<i>y</i>' }, {}] }, 'a[].b')).toEqual(['x', 'y']);
    expect(stringsAt([{ meanings: [{ definitions: [{ definition: 'one' }, { definition: 'two' }] }] }], '[].meanings[].definitions[].definition')).toEqual(['one', 'two']);
    expect(stringsAt({ a: { b: 'deep' } }, 'a.b')).toEqual(['deep']);
    expect(stringsAt({}, 'a[].b')).toEqual([]);
    expect(entriesAt({ d: ['p', 'q'] }, 'd[]')).toEqual([{ pos: '', language: '', definitions: [{ text: 'p', formOf: false }, { text: 'q', formOf: false }] }]);
    expect(entriesAt({}, 'd[]')).toEqual([]);
  });
});

describe('the card', () => {
  it('is headword :: first definition, the context as a second line of the back', () => {
    expect(cardText('ذِكْر', 'to mention')).toBe('ذِكْر :: to mention');
    const text = cardText('ذِكْر', 'to mention', SENTENCE);
    expect(text).toBe(`ذِكْر :: to mention\n${SENTENCE}`);
    expect(cardFields(text)).toEqual({ form: 'qa', front: 'ذِكْر', back: `to mention\n${SENTENCE}` });
    const { doc, diagnostics } = parse(`${text}\n`);
    expect(diagnostics).toEqual([]);
    expect(doc.blocks).toEqual([{ kind: 'card', text }]);
  });

  it('keeps separators and braces out of the sides, and drops a context that is the definition', () => {
    expect(cardText('a :: b', 'c {{d}} ::: e', 'x\n  y')).toBe('a : b :: c { {d} } : e\nx y');
    expect(cardText('w', 'same', 'same')).toBe('w :: same');
    expect(cardFields(cardText('a :: b', 'c :: d'))).toMatchObject({ form: 'qa', front: 'a : b', back: 'c : d' });
  });
});

describe('the lookup', () => {
  it('moves past a 404 to the next form and reports what it tried', async () => {
    const asked: string[] = [];
    const fetch = async (url: string) => { asked.push(titleOf(url)); return answer(url); };
    const r = await lookup('الذِّكْرُ', fetch);
    expect(asked).toEqual(['الذكر', 'ذكر']);
    expect(r.tried).toEqual(['الذكر', 'ذكر']);
    expect(r.result).toMatchObject({ found: 'ذكر', lang: 'ar' });
    expect(r.result!.entries.length).toBe(6);
    const none = await lookup('xyzzy', fetch);
    expect(none).toEqual({ result: null, tried: ['xyzzy'] });
    expect(await lookup('Memory', fetch)).toMatchObject({ result: { found: 'memory', lang: 'en' }, tried: ['Memory', 'memory'] });
  });

  it('throws on another failure and on a body that is not json', async () => {
    await expect(lookup('x', async () => new Response('busy', { status: 503 }))).rejects.toThrow('the dictionary answered 503');
    await expect(lookup('x', async () => new Response('<html>', { status: 200 }))).rejects.toThrow('did not answer with json');
  });

  it('uses the template and the json path of another dictionary', async () => {
    const urls: string[] = [];
    const fetch = async (url: string) => { urls.push(url); return new Response(JSON.stringify([{ meanings: [{ definitions: [{ definition: 'a store of things remembered' }] }] }]), { status: 200 }); };
    const r = await lookup('memory', fetch, { url: 'https://api.dictionaryapi.dev/api/v2/entries/{lang}/{word}', path: '[].meanings[].definitions[].definition' });
    expect(urls).toEqual(['https://api.dictionaryapi.dev/api/v2/entries/en/memory']);
    expect(r.result).toEqual({ found: 'memory', lang: 'en', entries: [{ pos: '', language: '', definitions: [{ text: 'a store of things remembered', formOf: false }] }] });
  });
});

// ── through the runtime, from the corpus's copy of the built plugin ──

async function until<T>(probe: () => T | null | undefined | false, ms = 3000): Promise<T> {
  const t0 = Date.now();
  for (;;) {
    const v = probe();
    if (v) return v;
    if (Date.now() - t0 > ms) throw new Error('timed out');
    await sleep(10);
  }
}

const q = <T extends Element>(s: string) => document.querySelector<T>(s);
const qa = (s: string) => Array.from(document.querySelectorAll(s));
const popText = () => q('.plug-pop')?.textContent ?? null;
const keyOnPopover = (key: string) => q<HTMLElement>('.plug-pop')!.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }));

describe('in the app', () => {
  let fs: MemFs;
  let vault: Vault;
  let bridge: FakeBridge;
  let host: PluginHost;

  const open = async (fetch: (url: string) => Response | Promise<Response> = fetchFixtures) => {
    vault = await Vault.open(fs, ROOT);
    bridge = fakeBridge(fetch);
    host = new PluginHost(vault, bridge);
    await host.start();
  };

  beforeEach(async () => {
    fs = memFs();
    await seed(fs, ['hello', 'dictionary']);
    await enable(fs, ['dictionary']);
    await open();
  });

  afterEach(() => {
    host.stop();
    document.body.innerHTML = '';
    document.head.querySelectorAll('style[data-plugin]').forEach((el) => el.remove());
  });

  it('is in the corpus, off, and runs when turned on, with its verb, its style, and its settings', async () => {
    expect(JSON.parse(readFileSync(join(import.meta.dirname, '../../../src/format/__tests__/corpus/vault/.ilmi/plugins.json'), 'utf8'))).toEqual(['hello']);
    expect(host.rows().map((r) => [r.id, r.state])).toEqual([['dictionary', 'on'], ['hello', 'off']]);
    expect(host.actionsFor(sel('الذِّكْرُ'))).toEqual([{ id: 'dictionary:look-up', name: 'look up', key: 'd' }]);
    expect(host.actionsFor(sel('a whole passage of four words'))).toEqual([]);
    expect(document.head.querySelector('style[data-plugin="dictionary"]')?.textContent).toContain('.dict-pop');
    expect(host.settingsOf('dictionary').map((c) => (c.kind === 'note' ? c.text : `${c.kind} ${c.key} "${c.label}"`))).toEqual([
      `text url "dictionary url"`, `text path "definitions at"`, `text language "language"`, `text deck "deck"`, `toggle context "context on the back"`,
    ]);
    for (let i = 0; !(await fs.has(`${ROOT}/.ilmi/plugins/dictionary/data.json`)) && i < 300; i++) await sleep(10);
    expect(JSON.parse((await fs.get(`${ROOT}/.ilmi/plugins/dictionary/data.json`))!)).toEqual({ context: true });
  });

  it('looks the Arabic word up past its article, shows the entries, and adds the card to a deck it creates', async () => {
    expect(host.runAction('dictionary:look-up', sel('الذِّكْرُ', SENTENCE))).toBe(true);
    expect(q('.plug-pop .dict-word')?.textContent).toBe('الذِّكْرُ');
    await until(() => q('.plug-pop .dict-entry'));
    expect(bridge.fetched.map(titleOf)).toEqual(['الذكر', 'ذكر']);
    expect(q('.dict-word')?.textContent).toBe('ذِكْر');
    expect(q('.dict-from')?.textContent).toBe('الذِّكْرُ');
    expect(q('.dict-lang')?.textContent).toBe('arabic');
    expect(qa('.dict-entry h3').map((h) => h.textContent)).toEqual(['verb', 'verb', 'noun', 'noun', 'noun', 'verb']);
    expect(q('.dict-entry li')?.textContent).toBe('to mention');
    expect(q('.dict-formof')?.textContent).toBe('verbal noun of ذَكَرَ (ḏakara)');
    expect(q('.dict-acts button')?.textContent).toBe('add to decka');
    expect(q('.dict-acts kbd')?.textContent).toBe('a');
    expect(q<HTMLElement>('.dict-pop')?.dir).toBe('auto');

    // keys inside the popover stay inside
    let leaked = 0;
    const spy = () => { leaked++; };
    window.addEventListener('keydown', spy);
    keyOnPopover('a');
    window.removeEventListener('keydown', spy);
    expect(leaked).toBe(0);
    await until(() => vault.documents().includes('vocab.md'));
    await until(() => !q('.plug-pop'));
    const text = await vault.fs.readText(`${ROOT}/vocab.md`);
    expect(text).toBe(`---\ntype: deck\n---\n\nذِكْر :: to mention\n${SENTENCE}\n`);
    const { doc, diagnostics } = parse(text);
    expect(diagnostics).toEqual([]);
    expect(doc.blocks).toEqual([{ kind: 'card', text: `ذِكْر :: to mention\n${SENTENCE}` }]);
    expect(bridge.notices).toEqual(['added to vocab']);

    // a second word lands in the same deck, after the first
    host.runAction('dictionary:look-up', sel('كِتَابٌ', 'وَالْكِتَابُ يَحْفَظُ الذِّكْرَ.'));
    await until(() => q('.dict-acts'));
    q<HTMLButtonElement>('.dict-acts button')!.click();
    await until(() => bridge.notices.length === 2);
    const second = parse(await vault.fs.readText(`${ROOT}/vocab.md`));
    expect(second.diagnostics).toEqual([]);
    expect(second.doc.blocks.map((b) => b.kind)).toEqual(['card', 'card']);
    expect(second.doc.blocks[1]).toMatchObject({ kind: 'card', text: 'كِتَاب :: book\nوَالْكِتَابُ يَحْفَظُ الذِّكْرَ.' });
  });

  it('follows the deck and context settings, for an English word', async () => {
    await host.setSetting('dictionary', 'deck', 'words/english');
    await host.setSetting('dictionary', 'context', false);
    host.runAction('dictionary:look-up', sel('Memory', 'Memory keeps knowledge.'));
    await until(() => q('.dict-acts'));
    expect(bridge.fetched.map(titleOf)).toEqual(['Memory', 'memory']);
    expect(q('.dict-word')?.textContent).toBe('memory');
    expect(q('.dict-from')?.textContent).toBe('Memory');
    expect(q('.dict-lang')?.textContent).toBe('english');
    expect(qa('.dict-entry li').length).toBe(8);
    keyOnPopover('a');
    await until(() => vault.documents().includes('words/english.md'));
    const text = await vault.fs.readText(`${ROOT}/words/english.md`);
    expect(text).toMatch(/^---\ntype: deck\n---\n\nmemory :: The ability of the brain to record information/);
    expect(text.trim().split('\n').length).toBe(5);
    expect(bridge.notices).toEqual(['added to english']);
  });

  it('says what it tried when nothing comes back, and does not offer a card', async () => {
    host.runAction('dictionary:look-up', sel('xyzzy'));
    await until(() => popText()?.includes('nothing found'));
    expect(popText()).toBe('xyzzynothing found for xyzzy');
    keyOnPopover('a');
    await sleep(20);
    expect(vault.documents()).not.toContain('vocab.md');
    expect(q('.plug-pop')).not.toBeNull();
    host.runAction('dictionary:look-up', sel('وَالْقَلَمِ'));
    await until(() => q('.dict-tried'));
    expect(q('.dict-quiet')?.textContent).toBe('nothing found for وَالْقَلَمِ');
    expect(q('.dict-tried')?.textContent).toBe('tried والقلم · القلم · قلم');
    expect(bridge.notices).toEqual([]);
    expect(host.rows()[0]?.state).toBe('on');
  });

  it('says when the dictionary cannot be reached, and stays on', async () => {
    host.stop();
    await open(() => { throw new Error('offline'); });
    host.runAction('dictionary:look-up', sel('كتاب'));
    await until(() => popText()?.includes('could not reach'));
    expect(q('.dict-quiet')?.textContent).toBe('could not reach en.wiktionary.org');
    expect(host.rows()[0]?.state).toBe('on');
    host.stop();
    await open(async () => new Response('', { status: 500 }));
    host.runAction('dictionary:look-up', sel('كتاب'));
    await until(() => popText()?.includes('answered'));
    expect(q('.dict-quiet')?.textContent).toBe('the dictionary answered 500');
  });
});
