// The dictionary: `look up` on the selection cue (key `d`) normalizes the
// selected word, asks Wiktionary's REST definitions endpoint (or any
// dictionary with a URL template and a JSON path), and shows the entries
// in a popover under the selection; `add to deck` there (key `a`) writes
// `<headword> :: <first definition>` to the vocab deck, with the sentence
// around the word as a second line of the back when `context` is on.
// The pure pieces are exported for the tests; `activate` is the plugin.

import type { Ilmi, Selection } from '../ilmi.js';

export const DEFAULT_URL = 'https://en.wiktionary.org/api/rest_v1/page/definition/{word}';
export const DEFAULT_DECK = 'vocab';
/** The settings, as keys of `data.json`. */
export const KEYS = { url: 'url', path: 'path', language: 'language', deck: 'deck', context: 'context' } as const;

// ── the word ──────────────────────────────────────────────────────

/** The marks a dictionary head leaves out: harakat, tanwin, shadda, sukun (U+064B–U+0652), the hamza and madda marks, the dagger alif, and the tatweel. */
const TASHKEEL = /[ً-ٰٕـ]/g;
/** A trailing case or mood ending: the short vowels, tanwin, sukun. */
const ENDING = /[ً-ْ]+$/;
const SHADDA = 'ّ';
const MARK = /[ً-ٰٕ]/;
const ARABIC = /[؀-ۿ]/;
/** Punctuation and symbols at the edges of the selection; marks (the tashkeel) are letters' and stay. */
const EDGE = /^[\s\p{P}\p{S}]+|[\s\p{P}\p{S}]+$/gu;
/** The one-letter and two-letter clitics, in the order they are tried. */
export const CLITICS = ['و', 'ف', 'ب', 'ك', 'ل', 'ال', 'لل', 'س'] as const;
/** After a conjunction is removed the rest can carry a second clitic. */
const CONJUNCTIONS = ['و', 'ف'];

/** The selection as a word: whitespace collapsed, punctuation at the edges gone. */
export function trimWord(text: string): string {
  return text.replace(/\s+/g, ' ').replace(EDGE, '').trim();
}

/** The word without its tashkeel and tatweel. */
export function bare(word: string): string {
  return word.replace(TASHKEEL, '');
}

export function isArabic(word: string): boolean {
  return ARABIC.test(word);
}

function stripped(word: string, clitic: string): string | null {
  if (!word.startsWith(clitic)) return null;
  const rest = word.slice(clitic.length);
  return rest.length >= 2 ? rest : null;
}

/**
 * The forms to look up, in order: the word as written (tashkeel stripped),
 * then with one clitic removed in `CLITICS` order, then, for a conjunction,
 * the rest with its own clitic removed. A Latin word adds its lowercase.
 */
export function candidates(selection: string): string[] {
  const word = bare(trimWord(selection));
  if (!word) return [];
  const out: string[] = [word];
  const add = (w: string | null) => { if (w && !out.includes(w)) out.push(w); };
  if (isArabic(word)) {
    for (const c of CLITICS) add(stripped(word, c));
    for (const c of CONJUNCTIONS) {
      const rest = stripped(word, c);
      if (!rest) continue;
      for (const d of CLITICS) if (!CONJUNCTIONS.includes(d)) add(stripped(rest, d));
    }
  } else {
    add(word.toLowerCase() === word ? null : word.toLowerCase());
  }
  return out;
}

/**
 * The headword with its vowels: the selection as written, less the clitic
 * that was stripped to find `found` (and the shadda a sun letter took from
 * the article) and less its case ending. The bare `found` when the
 * selection carries no tashkeel.
 */
export function vocalized(selection: string, found: string): string {
  const word = trimWord(selection).replace(/ـ/g, '');
  if (!isArabic(word) || bare(word) === word) return found;
  let i = 0;
  while (i < word.length && bare(word.slice(i)) !== found) i++;
  if (i >= word.length) return found;
  let head = word.slice(i);
  // the stripped prefix's own marks sit before the first letter kept
  while (head && MARK.test(head[0]!)) head = head.slice(1);
  if (i > 0) {
    // a sun letter's shadda came with the article
    const run = /^(.)([ً-ٰٕ]*)/u.exec(head);
    if (run && run[2]!.includes(SHADDA)) head = run[1]! + run[2]!.replace(SHADDA, '') + head.slice(run[0].length);
  }
  head = head.replace(ENDING, '');
  return bare(head) === found ? head : found;
}

/** The language section to read: the setting, else `ar` for Arabic script and `en` otherwise. */
export function languageFor(word: string, setting: string | undefined): string {
  const s = (setting ?? '').trim().toLowerCase();
  if (s) return s;
  return isArabic(word) ? 'ar' : 'en';
}

/** `{word}` and `{lang}` in the template filled, the word encoded as a path segment (spaces as `_`). */
export function requestUrl(template: string, word: string, lang: string): string {
  const t = template.trim() || DEFAULT_URL;
  return t.replace(/\{word\}/g, encodeURIComponent(word.replace(/ /g, '_'))).replace(/\{lang\}/g, encodeURIComponent(lang));
}

// ── the response ──────────────────────────────────────────────────

export interface Definition {
  text: string;
  /** Wiktionary's `verbal noun of …`, `plural of …`: a pointer, not a meaning. */
  formOf: boolean;
  example?: string;
}

export interface Entry {
  /** `noun`, `verb`, …, lowercase; `''` when the dictionary does not say. */
  pos: string;
  /** The language's name when the response names it. */
  language: string;
  definitions: Definition[];
}

export interface Found {
  /** The form that came back. */
  found: string;
  /** The section read: `ar`, `en`, …, or `other`. */
  lang: string;
  entries: Entry[];
}

export interface Lookup {
  result: Found | null;
  /** Every form asked for, in order. */
  tried: string[];
}

const ENTITIES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', '#39': "'" };

/** The text of a definition's HTML: tags gone, entities decoded, whitespace one space. */
export function htmlToText(html: string): string {
  let text: string;
  if (typeof DOMParser !== 'undefined') {
    text = new DOMParser().parseFromString(html, 'text/html').body.textContent ?? '';
  } else {
    text = html.replace(/<[^>]*>/g, '').replace(/&(#\d+|#x[0-9a-f]+|[a-z]+);/gi, (m, e: string) => {
      if (e[0] === '#') return String.fromCodePoint(parseInt(e[1]?.toLowerCase() === 'x' ? e.slice(2) : e.slice(1), e[1]?.toLowerCase() === 'x' ? 16 : 10));
      return ENTITIES[e.toLowerCase()] ?? m;
    });
  }
  return text.replace(/ /g, ' ').replace(/\s+/g, ' ').trim();
}

const isRecord = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);

function definitionOf(raw: unknown): Definition | null {
  if (!isRecord(raw) || typeof raw.definition !== 'string') return null;
  const text = htmlToText(raw.definition);
  if (!text) return null;
  const def: Definition = { text, formOf: /form-of-definition/.test(raw.definition) };
  const examples = Array.isArray(raw.parsedExamples) ? raw.parsedExamples : Array.isArray(raw.examples) ? raw.examples : [];
  const first = examples[0];
  const ex = isRecord(first) && typeof first.example === 'string' ? htmlToText(first.example) : typeof first === 'string' ? htmlToText(first) : '';
  if (ex) def.example = ex;
  return def;
}

function entriesOf(raw: unknown): Entry[] {
  if (!Array.isArray(raw)) return [];
  const out: Entry[] = [];
  for (const e of raw) {
    if (!isRecord(e)) continue;
    const definitions = (Array.isArray(e.definitions) ? e.definitions : []).map(definitionOf).filter((d): d is Definition => d !== null);
    if (!definitions.length) continue;
    out.push({ pos: typeof e.partOfSpeech === 'string' ? e.partOfSpeech.toLowerCase() : '', language: typeof e.language === 'string' ? e.language : '', definitions });
  }
  return out;
}

/**
 * The entries of a Wiktionary response (an object keyed by language code,
 * `other` for the rest) for `lang`; when that section is missing, the
 * first section that has entries, so the user sees what is there.
 */
export function wiktionarySection(json: unknown, lang: string): { lang: string; entries: Entry[] } | null {
  if (!isRecord(json)) return null;
  const want = entriesOf(json[lang]);
  if (want.length) return { lang, entries: want };
  for (const [key, raw] of Object.entries(json)) {
    const entries = entriesOf(raw);
    if (entries.length) return { lang: key, entries };
  }
  return null;
}

/**
 * The strings at a JSON path in any response: segments joined by `.`,
 * `[]` after a name (or alone) for each element of an array, so
 * `[].meanings[].definitions[].definition` reads dictionaryapi.dev's shape.
 */
export function stringsAt(json: unknown, path: string): string[] {
  let nodes: unknown[] = [json];
  for (const seg of path.split('.').map((s) => s.trim()).filter(Boolean)) {
    const each = seg.endsWith('[]');
    const name = each ? seg.slice(0, -2) : seg;
    const next: unknown[] = [];
    for (const n of nodes) {
      const v = name ? (isRecord(n) ? n[name] : undefined) : n;
      if (each) { if (Array.isArray(v)) next.push(...v); }
      else if (v !== undefined) next.push(v);
    }
    nodes = next;
  }
  return nodes.filter((n): n is string => typeof n === 'string').map(htmlToText).filter(Boolean);
}

/** One entry made of the strings at `path`. */
export function entriesAt(json: unknown, path: string): Entry[] {
  const texts = stringsAt(json, path);
  return texts.length ? [{ pos: '', language: '', definitions: texts.map((text) => ({ text, formOf: false })) }] : [];
}

/** The first definition that is a meaning, else the first there is. */
export function firstDefinition(entries: Entry[]): string | null {
  const all = entries.flatMap((e) => e.definitions);
  return (all.find((d) => !d.formOf) ?? all[0])?.text ?? null;
}

// ── the card ──────────────────────────────────────────────────────

/** A line that stays one side of a q&a card: no card separators, no blanks. */
function plain(text: string): string {
  return text.replace(/\s+/g, ' ').replace(/ :::? /g, ' : ').replace(/\{\{/g, '{ {').replace(/\}\}/g, '} }').trim();
}

/** `<headword> :: <definition>`, the context as a second line of the back when given. */
export function cardText(headword: string, definition: string, context?: string): string {
  const back = plain(definition);
  const ctx = context ? plain(context) : '';
  const first = `${plain(headword)} :: ${back}`;
  return ctx && ctx !== back ? `${first}\n${ctx}` : first;
}

// ── the lookup ────────────────────────────────────────────────────

export interface Settings {
  url?: string;
  path?: string;
  language?: string;
}

type Fetch = (url: string) => Promise<{ ok: boolean; status: number; json(): Promise<unknown> }>;

/** Try each candidate in order until one comes back with entries. A 404 moves on; another failure throws. */
export async function lookup(selection: string, fetch: Fetch, settings: Settings = {}): Promise<Lookup> {
  const forms = candidates(selection);
  const tried: string[] = [];
  const path = (settings.path ?? '').trim();
  for (const form of forms) {
    tried.push(form);
    const lang = languageFor(form, settings.language);
    const res = await fetch(requestUrl(settings.url ?? '', form, lang));
    if (res.status === 404) continue;
    if (!res.ok) throw new Error(`the dictionary answered ${res.status}`);
    let json: unknown;
    try {
      json = await res.json();
    } catch {
      throw new Error('the dictionary did not answer with json');
    }
    if (path) {
      const entries = entriesAt(json, path);
      if (entries.length) return { result: { found: form, lang, entries }, tried };
      continue;
    }
    const section = wiktionarySection(json, lang);
    if (section) return { result: { found: form, lang: section.lang, entries: section.entries }, tried };
  }
  return { result: null, tried };
}

// ── the plugin ────────────────────────────────────────────────────

const LANG_NAMES: Record<string, string> = { ar: 'arabic', en: 'english', fa: 'persian', ur: 'urdu', tr: 'turkish', de: 'german', fr: 'french', es: 'spanish', la: 'latin', el: 'greek', he: 'hebrew' };

function el<K extends keyof HTMLElementTagNameMap>(tag: K, cls?: string, text?: string): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text !== undefined) e.textContent = text;
  return e;
}

function hostOf(url: string): string {
  try {
    return new URL(url).host;
  } catch {
    return 'the dictionary';
  }
}

export function activate(ilmi: Ilmi): void {
  // `context` is on until the user turns it off; the toggle reads the file, so the default is written once
  void ilmi.store.load().then((data) => (data[KEYS.context] === undefined ? ilmi.store.save({ ...data, [KEYS.context]: true }) : undefined));

  ilmi.ui.settings((s) => {
    s.text(KEYS.url, 'dictionary url', { placeholder: DEFAULT_URL });
    s.text(KEYS.path, 'definitions at', { placeholder: 'wiktionary' });
    s.text(KEYS.language, 'language', { placeholder: 'by script' });
    s.text(KEYS.deck, 'deck', { placeholder: DEFAULT_DECK });
    s.toggle(KEYS.context, 'context on the back');
  });

  const setting = (key: string): string | undefined => {
    const v = ilmi.store.get<unknown>(key);
    return typeof v === 'string' && v.trim() ? v.trim() : undefined;
  };

  const lookUp = async (sel: Selection): Promise<void> => {
    const word = trimWord(sel.text);
    if (!word) return;
    const root = el('div', 'dict-pop');
    root.dir = 'auto';
    const head = el('div', 'dict-head');
    const wordEl = el('span', 'dict-word', word);
    wordEl.dir = 'auto';
    head.append(wordEl);
    const body = el('div', 'dict-body');
    body.append(el('p', 'dict-quiet', '…'));
    root.append(head, body);
    const pop = ilmi.ui.popover(sel.rect, root);

    let headword = word;
    let definition: string | null = null;
    const deckSetting = setting(KEYS.deck) ?? DEFAULT_DECK;
    const deckName = deckSetting.replace(/\.md$/, '').split('/').pop() ?? deckSetting;

    const add = async () => {
      if (definition === null) return;
      const context = ilmi.store.get<unknown>(KEYS.context) !== false ? sel.context : undefined;
      try {
        await ilmi.vault.addCard(deckSetting, cardText(headword, definition, context));
        ilmi.ui.notice(`added to ${deckName}`);
        pop.close();
      } catch (e) {
        ilmi.ui.notice(e instanceof Error ? e.message : String(e));
      }
    };
    pop.el.addEventListener('keydown', (e) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === 'a' && definition !== null) {
        e.preventDefault();
        e.stopPropagation();
        void add();
      }
    });

    const settings: Settings = {};
    const url = setting(KEYS.url);
    const path = setting(KEYS.path);
    const language = setting(KEYS.language);
    if (url !== undefined) settings.url = url;
    if (path !== undefined) settings.path = path;
    if (language !== undefined) settings.language = language;

    let found: Lookup;
    try {
      found = await lookup(word, (u) => ilmi.net.fetch(u), settings);
    } catch (e) {
      if (!pop.el.isConnected) return;
      body.replaceChildren(el('p', 'dict-quiet', e instanceof Error && /answered|json/.test(e.message) ? e.message : `could not reach ${hostOf(requestUrl(settings.url ?? '', word, 'en'))}`));
      return;
    }
    if (!pop.el.isConnected) return;
    body.replaceChildren();
    if (!found.result) {
      body.append(el('p', 'dict-quiet', `nothing found for ${word}`));
      if (found.tried.length > 1) body.append(el('p', 'dict-tried', `tried ${found.tried.join(' · ')}`));
      return;
    }
    const { result } = found;
    headword = vocalized(word, result.found);
    wordEl.textContent = headword;
    if (bare(word) !== result.found) head.append(el('span', 'dict-from', word));
    const langName = result.lang === 'other' ? '' : LANG_NAMES[result.lang] ?? result.lang;
    if (langName) head.append(el('span', 'dict-lang', langName));
    for (const entry of result.entries) {
      const box = el('div', 'dict-entry');
      const label = [entry.pos, result.lang === 'other' ? entry.language.toLowerCase() : ''].filter(Boolean).join(' · ');
      if (label) box.append(el('h3', undefined, label));
      const list = el('ol');
      for (const d of entry.definitions) {
        const li = el('li', d.formOf ? 'dict-formof' : undefined, d.text);
        if (d.example) li.append(el('div', 'dict-ex', d.example));
        list.append(li);
      }
      box.append(list);
      body.append(box);
    }
    definition = firstDefinition(result.entries);
    if (definition !== null) {
      const acts = el('div', 'dict-acts');
      const button = el('button', undefined, 'add to deck');
      button.type = 'button';
      button.append(el('kbd', undefined, 'a'));
      button.addEventListener('click', () => void add());
      acts.append(button);
      body.append(acts);
    }
  };

  ilmi.selection.addAction({
    id: 'look-up',
    name: 'look up',
    key: 'd',
    // a word or a short phrase, not a passage
    when: (sel) => trimWord(sel.text).split(' ').length <= 3,
    run: lookUp,
  });
}
