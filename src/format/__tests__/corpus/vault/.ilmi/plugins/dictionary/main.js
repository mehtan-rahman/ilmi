"use strict";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// plugins/dictionary/main.ts
var main_exports = {};
__export(main_exports, {
  CLITICS: () => CLITICS,
  DEFAULT_DECK: () => DEFAULT_DECK,
  DEFAULT_URL: () => DEFAULT_URL,
  KEYS: () => KEYS,
  activate: () => activate,
  bare: () => bare,
  candidates: () => candidates,
  cardText: () => cardText,
  entriesAt: () => entriesAt,
  firstDefinition: () => firstDefinition,
  htmlToText: () => htmlToText,
  isArabic: () => isArabic,
  languageFor: () => languageFor,
  lookup: () => lookup,
  requestUrl: () => requestUrl,
  stringsAt: () => stringsAt,
  trimWord: () => trimWord,
  vocalized: () => vocalized,
  wiktionarySection: () => wiktionarySection
});
module.exports = __toCommonJS(main_exports);
var DEFAULT_URL = "https://en.wiktionary.org/api/rest_v1/page/definition/{word}";
var DEFAULT_DECK = "vocab";
var KEYS = { url: "url", path: "path", language: "language", deck: "deck", context: "context" };
var TASHKEEL = /[ً-ٰٕـ]/g;
var ENDING = /[ً-ْ]+$/;
var SHADDA = "\u0651";
var MARK = /[ً-ٰٕ]/;
var ARABIC = /[؀-ۿ]/;
var EDGE = /^[\s\p{P}\p{S}]+|[\s\p{P}\p{S}]+$/gu;
var CLITICS = ["\u0648", "\u0641", "\u0628", "\u0643", "\u0644", "\u0627\u0644", "\u0644\u0644", "\u0633"];
var CONJUNCTIONS = ["\u0648", "\u0641"];
function trimWord(text) {
  return text.replace(/\s+/g, " ").replace(EDGE, "").trim();
}
function bare(word) {
  return word.replace(TASHKEEL, "");
}
function isArabic(word) {
  return ARABIC.test(word);
}
function stripped(word, clitic) {
  if (!word.startsWith(clitic)) return null;
  const rest = word.slice(clitic.length);
  return rest.length >= 2 ? rest : null;
}
function candidates(selection) {
  const word = bare(trimWord(selection));
  if (!word) return [];
  const out = [word];
  const add = (w) => {
    if (w && !out.includes(w)) out.push(w);
  };
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
function vocalized(selection, found) {
  const word = trimWord(selection).replace(/ـ/g, "");
  if (!isArabic(word) || bare(word) === word) return found;
  let i = 0;
  while (i < word.length && bare(word.slice(i)) !== found) i++;
  if (i >= word.length) return found;
  let head = word.slice(i);
  while (head && MARK.test(head[0])) head = head.slice(1);
  if (i > 0) {
    const run = /^(.)([ً-ٰٕ]*)/u.exec(head);
    if (run && run[2].includes(SHADDA)) head = run[1] + run[2].replace(SHADDA, "") + head.slice(run[0].length);
  }
  head = head.replace(ENDING, "");
  return bare(head) === found ? head : found;
}
function languageFor(word, setting) {
  const s = (setting ?? "").trim().toLowerCase();
  if (s) return s;
  return isArabic(word) ? "ar" : "en";
}
function requestUrl(template, word, lang) {
  const t = template.trim() || DEFAULT_URL;
  return t.replace(/\{word\}/g, encodeURIComponent(word.replace(/ /g, "_"))).replace(/\{lang\}/g, encodeURIComponent(lang));
}
var ENTITIES = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", "#39": "'" };
function htmlToText(html) {
  let text;
  if (typeof DOMParser !== "undefined") {
    text = new DOMParser().parseFromString(html, "text/html").body.textContent ?? "";
  } else {
    text = html.replace(/<[^>]*>/g, "").replace(/&(#\d+|#x[0-9a-f]+|[a-z]+);/gi, (m, e) => {
      if (e[0] === "#") return String.fromCodePoint(parseInt(e[1]?.toLowerCase() === "x" ? e.slice(2) : e.slice(1), e[1]?.toLowerCase() === "x" ? 16 : 10));
      return ENTITIES[e.toLowerCase()] ?? m;
    });
  }
  return text.replace(/ /g, " ").replace(/\s+/g, " ").trim();
}
var isRecord = (v) => !!v && typeof v === "object" && !Array.isArray(v);
function definitionOf(raw) {
  if (!isRecord(raw) || typeof raw.definition !== "string") return null;
  const text = htmlToText(raw.definition);
  if (!text) return null;
  const def = { text, formOf: /form-of-definition/.test(raw.definition) };
  const examples = Array.isArray(raw.parsedExamples) ? raw.parsedExamples : Array.isArray(raw.examples) ? raw.examples : [];
  const first = examples[0];
  const ex = isRecord(first) && typeof first.example === "string" ? htmlToText(first.example) : typeof first === "string" ? htmlToText(first) : "";
  if (ex) def.example = ex;
  return def;
}
function entriesOf(raw) {
  if (!Array.isArray(raw)) return [];
  const out = [];
  for (const e of raw) {
    if (!isRecord(e)) continue;
    const definitions = (Array.isArray(e.definitions) ? e.definitions : []).map(definitionOf).filter((d) => d !== null);
    if (!definitions.length) continue;
    out.push({ pos: typeof e.partOfSpeech === "string" ? e.partOfSpeech.toLowerCase() : "", language: typeof e.language === "string" ? e.language : "", definitions });
  }
  return out;
}
function wiktionarySection(json, lang) {
  if (!isRecord(json)) return null;
  const want = entriesOf(json[lang]);
  if (want.length) return { lang, entries: want };
  for (const [key, raw] of Object.entries(json)) {
    const entries = entriesOf(raw);
    if (entries.length) return { lang: key, entries };
  }
  return null;
}
function stringsAt(json, path) {
  let nodes = [json];
  for (const seg of path.split(".").map((s) => s.trim()).filter(Boolean)) {
    const each = seg.endsWith("[]");
    const name = each ? seg.slice(0, -2) : seg;
    const next = [];
    for (const n of nodes) {
      const v = name ? isRecord(n) ? n[name] : void 0 : n;
      if (each) {
        if (Array.isArray(v)) next.push(...v);
      } else if (v !== void 0) next.push(v);
    }
    nodes = next;
  }
  return nodes.filter((n) => typeof n === "string").map(htmlToText).filter(Boolean);
}
function entriesAt(json, path) {
  const texts = stringsAt(json, path);
  return texts.length ? [{ pos: "", language: "", definitions: texts.map((text) => ({ text, formOf: false })) }] : [];
}
function firstDefinition(entries) {
  const all = entries.flatMap((e) => e.definitions);
  return (all.find((d) => !d.formOf) ?? all[0])?.text ?? null;
}
function plain(text) {
  return text.replace(/\s+/g, " ").replace(/ :::? /g, " : ").replace(/\{\{/g, "{ {").replace(/\}\}/g, "} }").trim();
}
function cardText(headword, definition, context) {
  const back = plain(definition);
  const ctx = context ? plain(context) : "";
  const first = `${plain(headword)} :: ${back}`;
  return ctx && ctx !== back ? `${first}
${ctx}` : first;
}
async function lookup(selection, fetch, settings = {}) {
  const forms = candidates(selection);
  const tried = [];
  const path = (settings.path ?? "").trim();
  for (const form of forms) {
    tried.push(form);
    const lang = languageFor(form, settings.language);
    const res = await fetch(requestUrl(settings.url ?? "", form, lang));
    if (res.status === 404) continue;
    if (!res.ok) throw new Error(`the dictionary answered ${res.status}`);
    let json;
    try {
      json = await res.json();
    } catch {
      throw new Error("the dictionary did not answer with json");
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
var LANG_NAMES = { ar: "arabic", en: "english", fa: "persian", ur: "urdu", tr: "turkish", de: "german", fr: "french", es: "spanish", la: "latin", el: "greek", he: "hebrew" };
function el(tag, cls, text) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text !== void 0) e.textContent = text;
  return e;
}
function hostOf(url) {
  try {
    return new URL(url).host;
  } catch {
    return "the dictionary";
  }
}
function activate(ilmi) {
  void ilmi.store.load().then((data) => data[KEYS.context] === void 0 ? ilmi.store.save({ ...data, [KEYS.context]: true }) : void 0);
  ilmi.ui.settings((s) => {
    s.text(KEYS.url, "dictionary url", { placeholder: DEFAULT_URL });
    s.text(KEYS.path, "definitions at", { placeholder: "wiktionary" });
    s.text(KEYS.language, "language", { placeholder: "by script" });
    s.text(KEYS.deck, "deck", { placeholder: DEFAULT_DECK });
    s.toggle(KEYS.context, "context on the back");
  });
  const setting = (key) => {
    const v = ilmi.store.get(key);
    return typeof v === "string" && v.trim() ? v.trim() : void 0;
  };
  const lookUp = async (sel) => {
    const word = trimWord(sel.text);
    if (!word) return;
    const root = el("div", "dict-pop");
    root.dir = "auto";
    const head = el("div", "dict-head");
    const wordEl = el("span", "dict-word", word);
    wordEl.dir = "auto";
    head.append(wordEl);
    const body = el("div", "dict-body");
    body.append(el("p", "dict-quiet", "\u2026"));
    root.append(head, body);
    const pop = ilmi.ui.popover(sel.rect, root);
    let headword = word;
    let definition = null;
    const deckSetting = setting(KEYS.deck) ?? DEFAULT_DECK;
    const deckName = deckSetting.replace(/\.md$/, "").split("/").pop() ?? deckSetting;
    const add = async () => {
      if (definition === null) return;
      const context = ilmi.store.get(KEYS.context) !== false ? sel.context : void 0;
      try {
        await ilmi.vault.addCard(deckSetting, cardText(headword, definition, context));
        ilmi.ui.notice(`added to ${deckName}`);
        pop.close();
      } catch (e) {
        ilmi.ui.notice(e instanceof Error ? e.message : String(e));
      }
    };
    pop.el.addEventListener("keydown", (e) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === "a" && definition !== null) {
        e.preventDefault();
        e.stopPropagation();
        void add();
      }
    });
    const settings = {};
    const url = setting(KEYS.url);
    const path = setting(KEYS.path);
    const language = setting(KEYS.language);
    if (url !== void 0) settings.url = url;
    if (path !== void 0) settings.path = path;
    if (language !== void 0) settings.language = language;
    let found;
    try {
      found = await lookup(word, (u) => ilmi.net.fetch(u), settings);
    } catch (e) {
      if (!pop.el.isConnected) return;
      body.replaceChildren(el("p", "dict-quiet", e instanceof Error && /answered|json/.test(e.message) ? e.message : `could not reach ${hostOf(requestUrl(settings.url ?? "", word, "en"))}`));
      return;
    }
    if (!pop.el.isConnected) return;
    body.replaceChildren();
    if (!found.result) {
      body.append(el("p", "dict-quiet", `nothing found for ${word}`));
      if (found.tried.length > 1) body.append(el("p", "dict-tried", `tried ${found.tried.join(" \xB7 ")}`));
      return;
    }
    const { result } = found;
    headword = vocalized(word, result.found);
    wordEl.textContent = headword;
    if (bare(word) !== result.found) head.append(el("span", "dict-from", word));
    const langName = result.lang === "other" ? "" : LANG_NAMES[result.lang] ?? result.lang;
    if (langName) head.append(el("span", "dict-lang", langName));
    for (const entry of result.entries) {
      const box = el("div", "dict-entry");
      const label = [entry.pos, result.lang === "other" ? entry.language.toLowerCase() : ""].filter(Boolean).join(" \xB7 ");
      if (label) box.append(el("h3", void 0, label));
      const list = el("ol");
      for (const d of entry.definitions) {
        const li = el("li", d.formOf ? "dict-formof" : void 0, d.text);
        if (d.example) li.append(el("div", "dict-ex", d.example));
        list.append(li);
      }
      box.append(list);
      body.append(box);
    }
    definition = firstDefinition(result.entries);
    if (definition !== null) {
      const acts = el("div", "dict-acts");
      const button = el("button", void 0, "add to deck");
      button.type = "button";
      button.append(el("kbd", void 0, "a"));
      button.addEventListener("click", () => void add());
      acts.append(button);
      body.append(acts);
    }
  };
  ilmi.selection.addAction({
    id: "look-up",
    name: "look up",
    key: "d",
    // a word or a short phrase, not a passage
    when: (sel) => trimWord(sel.text).split(" ").length <= 3,
    run: lookUp
  });
}
