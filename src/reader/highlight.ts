// Code coloured by its language: highlight.js's core with the handful of
// languages a student of physics and Arabic writes in, bundled (no CDN, no
// workers). The highlighter's HTML is read back into ranges over the code's
// own text, so the editor draws them as decorations and the text stays the
// text: nothing here changes a byte of the file.

import hljs from 'highlight.js/lib/core';
import type { Command } from 'prosemirror-state';
import bash from 'highlight.js/lib/languages/bash';
import c from 'highlight.js/lib/languages/c';
import cpp from 'highlight.js/lib/languages/cpp';
import javascript from 'highlight.js/lib/languages/javascript';
import json from 'highlight.js/lib/languages/json';
import julia from 'highlight.js/lib/languages/julia';
import latex from 'highlight.js/lib/languages/latex';
import matlab from 'highlight.js/lib/languages/matlab';
import python from 'highlight.js/lib/languages/python';
import rust from 'highlight.js/lib/languages/rust';
import typescript from 'highlight.js/lib/languages/typescript';

/** The bundled languages, in the picker's order: the name the picker writes on the fence, and the highlighter's grammar. */
export const CODE_LANGS: { id: string; label: string }[] = [
  { id: 'python', label: 'python' },
  { id: 'julia', label: 'julia' },
  { id: 'matlab', label: 'matlab' },
  { id: 'c', label: 'c' },
  { id: 'cpp', label: 'c++' },
  { id: 'rust', label: 'rust' },
  { id: 'javascript', label: 'javascript' },
  { id: 'typescript', label: 'typescript' },
  { id: 'bash', label: 'bash' },
  { id: 'latex', label: 'latex' },
  { id: 'json', label: 'json' },
];

hljs.registerLanguage('python', python);
hljs.registerLanguage('julia', julia);
hljs.registerLanguage('matlab', matlab);
hljs.registerLanguage('c', c);
hljs.registerLanguage('cpp', cpp);
hljs.registerLanguage('rust', rust);
hljs.registerLanguage('javascript', javascript);
hljs.registerLanguage('typescript', typescript);
hljs.registerLanguage('bash', bash);
hljs.registerLanguage('latex', latex);
hljs.registerLanguage('json', json);
// the short names people put on a fence that the grammars do not list themselves
hljs.registerAliases(['jl'], { languageName: 'julia' });
hljs.registerAliases(['octave'], { languageName: 'matlab' });
hljs.registerAliases(['c++'], { languageName: 'cpp' });

/** The grammar a fence's language word names (`py`, `Python`, `c++`), or null when none is bundled. */
export function codeLang(word: string): string | null {
  const w = word.trim().toLowerCase();
  if (!w) return null;
  const lang = hljs.getLanguage(w);
  if (!lang) return null;
  // the registered name, through any alias
  return CODE_LANGS.find((l) => hljs.getLanguage(l.id) === lang)?.id ?? null;
}

/** One coloured run of a code block's text: its offsets into the text, and the highlighter's class (`hljs-keyword`, `hljs-title function_`). */
export interface CodeToken {
  from: number;
  to: number;
  cls: string;
}

const ENTITY: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', '#x27': "'", '#39': "'" };

/**
 * The highlighter's HTML as runs over the decoded text: each run of text
 * carries the innermost span's class it sits in (a run outside any span
 * carries none and is left out). Offsets count the code's characters.
 */
export function tokensOfHtml(html: string): CodeToken[] {
  const out: CodeToken[] = [];
  const stack: string[] = [];
  let at = 0;
  let i = 0;
  const emit = (len: number) => {
    if (!len) return;
    const cls = stack[stack.length - 1];
    if (cls) {
      const last = out[out.length - 1];
      if (last && last.cls === cls && last.to === at) last.to = at + len;
      else out.push({ from: at, to: at + len, cls });
    }
    at += len;
  };
  while (i < html.length) {
    const ch = html[i]!;
    if (ch === '<') {
      const end = html.indexOf('>', i);
      const tag = html.slice(i + 1, end);
      if (tag.startsWith('/')) stack.pop();
      else stack.push(/class="([^"]*)"/.exec(tag)?.[1] ?? stack[stack.length - 1] ?? '');
      i = end + 1;
      continue;
    }
    if (ch === '&') {
      const end = html.indexOf(';', i);
      const name = html.slice(i + 1, end);
      if (end > i && ENTITY[name] !== undefined) { emit(1); i = end + 1; continue; }
    }
    // a run of plain characters up to the next tag or entity
    let j = i + 1;
    while (j < html.length && html[j] !== '<' && html[j] !== '&') j++;
    emit(j - i);
    i = j;
  }
  return out;
}

const cache = new Map<string, CodeToken[]>();
const CACHE_MAX = 400;

/** The coloured runs of `code` in the language a fence names; none when the language is not bundled. Cached by language and text. */
export function codeTokens(code: string, word: string): CodeToken[] {
  const lang = codeLang(word);
  if (!lang || !code) return [];
  const key = `${lang}\u0000${code}`;
  const hit = cache.get(key);
  if (hit) return hit;
  let tokens: CodeToken[];
  try {
    tokens = tokensOfHtml(hljs.highlight(code, { language: lang, ignoreIllegals: true }).value);
  } catch {
    tokens = [];
  }
  if (cache.size >= CACHE_MAX) cache.delete(cache.keys().next().value!);
  cache.set(key, tokens);
  return tokens;
}

/** `code` as escaped HTML with the highlighter's spans, for a drawing that is not edited (a fence inside a list item, a quote). */
export function codeHTML(code: string, word: string): string | null {
  const lang = codeLang(word);
  if (!lang) return null;
  try {
    return hljs.highlight(code, { language: lang, ignoreIllegals: true }).value;
  } catch {
    return null;
  }
}

const FENCE_LINE = /^( {0,3})(`{3,}|~{3,})[ \t]*(\S*)(.*)$/;

/** A fence line with its language word replaced by `word` (`''` takes it off), the rest of the info string kept. */
export function withLang(fence: string, word: string): string {
  const m = FENCE_LINE.exec(fence);
  if (!m) return fence;
  const rest = m[4]!.trim();
  return `${m[1]}${m[2]}${word}${rest ? `${word ? ' ' : ''}${rest}` : ''}`;
}

/** The code block at `pos` given the language `word` on its fence; the file writes the fence as changed. */
export function setCodeLang(pos: number, word: string): Command {
  return (state, dispatch) => {
    const node = state.doc.nodeAt(pos);
    if (!node || node.type.spec.code !== true || typeof node.attrs.fence !== 'string') return false;
    const fence = withLang(node.attrs.fence, word);
    if (fence === node.attrs.fence) return true;
    dispatch?.(state.tr.setNodeMarkup(pos, undefined, { ...node.attrs, fence }));
    return true;
  };
}
