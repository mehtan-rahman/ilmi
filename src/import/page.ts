// A web page as the clipper would write it. Defuddle (the Obsidian Web
// Clipper's engine) finds the article in the page and its metadata: title,
// author, published, site, description. The walker below turns the
// article's DOM into Markdown the format reads back as the same shapes, with
// what a page brings that a paste does not: links, emphasis, inline code,
// fenced code with its language, GFM tables, footnotes under `## notes`,
// math as `$…$`, images as `![alt](src)`. When Defuddle finds nothing the
// old pass (Readability, else the whole body) feeds the same walker, so the
// result reads the same either way. Nothing the format reads as a card can
// come out of it by accident (`escapeProse`). Runs wherever there is a
// `DOMParser`: the webview, jsdom in tests.
//
// Defuddle 0.19 core bundle: `new Defuddle(doc, { url }).parse()` is
// synchronous and returns the content as HTML; its Markdown needs the full
// bundle and would still need the escapes, so the walker here is the one
// reduction for both paths.

import { Readability } from '@mozilla/readability';
import Defuddle from 'defuddle';
import { parseWhen } from '../format/attrs.js';
import { stats } from './text.js';

export interface ClipImage {
  /** Absolute `http(s)` address, as written in the Markdown. */
  src: string;
  alt: string;
}

export interface Clipped {
  title: string;
  /** The body as Markdown. */
  text: string;
  url: string;
  /** The site's name, else its domain. */
  site: string;
  author: string;
  /** A day or a UTC instant, else `''`. */
  published: string;
  description: string;
  words: number;
  /** The images the Markdown refers to, in order, each once. */
  images: ClipImage[];
  /** Which pass found the article. */
  via: 'defuddle' | 'fallback';
}

const SKIP = new Set([
  'script', 'style', 'noscript', 'template', 'iframe', 'svg', 'canvas', 'video', 'audio', 'object', 'embed',
  'head', 'title', 'meta', 'link', 'button', 'input', 'select', 'textarea', 'picture', 'source', 'nav', 'track', 'map',
]);
const BLOCK = new Set([
  'p', 'div', 'section', 'article', 'main', 'aside', 'header', 'footer', 'figure', 'figcaption',
  'address', 'details', 'summary', 'dl', 'dt', 'dd', 'form', 'fieldset', 'body', 'center', 'li', 'tr', 'html',
]);
const HEADING = /^h([1-6])$/;
const LIST = new Set(['ul', 'ol']);
const EM = new Set(['em', 'i', 'cite', 'dfn', 'var']);
const STRONG = new Set(['strong', 'b']);
const CODE = new Set(['code', 'kbd', 'samp', 'tt']);
const STRIKE = new Set(['del', 's', 'strike']);

/** Where footnotes are kept: a container by id or class, or a list of items whose ids say so. */
const NOTE_BOX = /(^|[\s_-])(footnotes?|references|endnotes)([\s_-]|$)/i;
const NOTE_ID = /^(fn|footnote|note|cite_note|ref)[^a-z]*/i;
const BACKREF = /(^|\s)(footnote-backref|reversefootnote|mw-cite-backlink|backlink)(\s|$)/i;
const RETURN_GLYPHS = /^[\s↩↵⏎↑^⤴︎←]+$/u;

const collapse = (s: string) => s.replace(/\s+/g, ' ').trim();

/** `href` made absolute against `base`, parentheses encoded so it sits inside `(…)`; null when it is not a web address. */
function webAddress(href: string | null, base: string | undefined): string | null {
  if (!href) return null;
  try {
    const u = new URL(href.trim(), base);
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return null;
    return u.href.replace(/\(/g, '%28').replace(/\)/g, '%29');
  } catch {
    return null;
  }
}

interface Walk {
  base: string | undefined;
  images: ClipImage[];
  seen: Set<string>;
  /** Footnote ids in the order first met, by reference or by definition. */
  numbers: Map<string, number>;
  /** The notes' text, by id, once the list that holds them is met. */
  notes: Map<string, string>;
}

const noteNumber = (w: Walk, id: string): number => {
  const have = w.numbers.get(id);
  if (have !== undefined) return have;
  const n = w.numbers.size + 1;
  w.numbers.set(id, n);
  return n;
};

/** The fragment of a link into the page itself (`#id`, or the page's own address with `#id`), decoded; null for any other link. */
function fragmentOf(href: string | null, base: string | undefined): string | null {
  if (!href) return null;
  const at = href.indexOf('#');
  if (at < 0) return null;
  const before = href.slice(0, at);
  if (before !== '' && (!base || before !== base.split('#')[0])) return null;
  try {
    return decodeURIComponent(href.slice(at + 1));
  } catch {
    return href.slice(at + 1);
  }
}

/** An anchor that refers to a footnote: a link into the page at an id that reads as one, inside a `sup` or marked as a reference. */
function footnoteRef(a: Element, base: string | undefined): string | null {
  const id = fragmentOf(a.getAttribute('href'), base);
  if (id === null) return null;
  if (!NOTE_ID.test(id) || /^(fnref|ref|cite_ref)/i.test(id) && !/^cite_note/i.test(id)) return null;
  const marked = /(^|\s)(footnote-ref|footnote|reference|fnref)(\s|$)/i.test(a.className) || a.getAttribute('role') === 'doc-noteref';
  return marked || a.closest('sup') ? id : null;
}

/** An anchor that leads back from a footnote to its reference. */
function isBackref(a: Element, base: string | undefined): boolean {
  if (BACKREF.test(a.className) || a.getAttribute('role') === 'doc-backlink' || (a.getAttribute('epub:type') ?? '').split(/\s+/).includes('backlink')) return true;
  const text = a.textContent ?? '';
  return fragmentOf(a.getAttribute('href'), base) !== null && text.trim().length > 0 && RETURN_GLYPHS.test(text);
}

/** The element is a list of footnotes: a container named for them, or a list whose items carry footnote ids. */
function isNoteBox(el: Element, tag: string): boolean {
  if (NOTE_BOX.test(el.id) || NOTE_BOX.test(el.className) || el.getAttribute('role') === 'doc-endnotes') return true;
  if (tag !== 'ol' && tag !== 'ul') return false;
  const items = Array.from(el.children).filter((c) => c.tagName.toLowerCase() === 'li');
  return items.length > 0 && items.every((li) => NOTE_ID.test(li.id) && !/^(fnref|cite_ref)/i.test(li.id));
}

/** Inline code: fenced in one more backtick than the longest run inside, padded when it starts or ends with one. */
function codeSpan(text: string): string {
  const t = text.replace(/\s*\n\s*/g, ' ').trim();
  if (!t) return '';
  const runs = t.match(/`+/g) ?? [];
  const fence = '`'.repeat(Math.max(0, ...runs.map((r) => r.length)) + 1);
  const pad = t.startsWith('`') || t.endsWith('`') ? ' ' : '';
  return `${fence}${pad}${t}${pad}${fence}`;
}

/** Marks around `inner`, with its outer whitespace kept outside them. */
function marked(inner: string, mark: string): string {
  const core = inner.trim();
  if (!core) return inner;
  const lead = inner.slice(0, inner.length - inner.trimStart().length);
  const tail = inner.slice(inner.trimEnd().length);
  return `${lead}${mark}${core}${mark}${tail}`;
}

/** A MathML element's TeX, from `data-latex` or an annotation, else its text; `$…$` or `$$…$$` by its display. */
function mathOf(el: Element): string {
  const tex = collapse(el.getAttribute('data-latex') ?? el.querySelector('annotation[encoding*="tex" i]')?.textContent ?? '');
  const text = tex || collapse(el.textContent ?? '');
  if (!text) return '';
  return el.getAttribute('display') === 'block' ? `$$${text}$$` : `$${text}$`;
}

function imageOf(el: Element, w: Walk): string {
  const src = webAddress(el.getAttribute('src') ?? el.getAttribute('data-src'), w.base);
  if (!src) return '';
  const alt = collapse(el.getAttribute('alt') ?? '').replace(/[[\]]/g, '');
  if (!w.seen.has(src)) {
    w.seen.add(src);
    w.images.push({ src, alt });
  }
  return `![${alt}](${src})`;
}

/** The Markdown of one inline node; a nested list is left out, a block child runs together with the rest. */
function inlineNode(n: Node, w: Walk): string {
  if (n.nodeType === 3) return (n.textContent ?? '').replace(/\s+/g, ' ');
  if (n.nodeType !== 1) return '';
  const e = n as Element;
  const tag = e.tagName.toLowerCase();
  if (SKIP.has(tag) || LIST.has(tag)) return '';
  if (tag === 'br') return '\n';
  if (tag === 'img') return imageOf(e, w);
  if (tag === 'math') return mathOf(e);
  if (CODE.has(tag)) return codeSpan(e.textContent ?? '');
  if (tag === 'a') {
    if (isBackref(e, w.base)) return '';
    const note = footnoteRef(e, w.base);
    if (note !== null) return `[^${noteNumber(w, note)}]`;
    const inner = inlineOf(e, w);
    // a link into the page itself is its text: the clipping cannot follow it
    const href = fragmentOf(e.getAttribute('href'), w.base) === null ? webAddress(e.getAttribute('href'), w.base) : null;
    const text = inner.trim();
    return href && text ? `${inner.slice(0, inner.length - inner.trimStart().length)}[${text}](${href})${inner.slice(inner.trimEnd().length)}` : inner;
  }
  if (tag === 'sup') {
    const ref = Array.from(e.querySelectorAll('a')).map((a) => footnoteRef(a, w.base)).find((id) => id !== null);
    if (ref !== undefined && ref !== null) return `[^${noteNumber(w, ref)}]`;
  }
  const inner = inlineOf(e, w);
  if (EM.has(tag)) return marked(inner, '*');
  if (STRONG.has(tag)) return marked(inner, '**');
  if (STRIKE.has(tag)) return marked(inner, '~~');
  if (tag === 'q') return marked(inner, '"');
  return inner;
}

/** The Markdown of `el`'s inline content. */
function inlineOf(el: Node, w: Walk): string {
  let out = '';
  for (const c of Array.from(el.childNodes)) out += inlineNode(c, w);
  return out;
}

/** One list as lines, nested lists indented under their item. */
function listLines(list: Element, depth: number, w: Walk): string[] {
  const ordered = list.tagName.toLowerCase() === 'ol';
  const start = Number(list.getAttribute('start')) || 1;
  const lines: string[] = [];
  let n = start - 1;
  for (const li of Array.from(list.children)) {
    if (li.tagName.toLowerCase() !== 'li') continue;
    n++;
    const text = collapse(inlineOf(li, w));
    if (text) lines.push(`${'  '.repeat(depth)}${ordered ? `${n}.` : '-'} ${text}`);
    for (const sub of Array.from(li.children)) {
      if (LIST.has(sub.tagName.toLowerCase())) lines.push(...listLines(sub, depth + 1, w));
    }
  }
  return lines;
}

/** A table as GFM: the first row is the header, the rest the body, every row padded to the widest. */
function tableLines(table: Element, w: Walk): string[] {
  const rows = Array.from(table.querySelectorAll('tr'))
    .filter((tr) => tr.closest('table') === table)
    .map((tr) => Array.from(tr.children).filter((c) => /^t[hd]$/i.test(c.tagName)).map((c) => collapse(inlineOf(c, w)).replace(/\|/g, '\\|')))
    .filter((cells) => cells.some(Boolean));
  if (!rows.length) return [];
  const width = Math.max(...rows.map((r) => r.length));
  const line = (cells: string[]) => `| ${Array.from({ length: width }, (_, i) => cells[i] ?? '').join(' | ')} |`;
  const [head, ...body] = rows;
  return [line(head!), `| ${Array.from({ length: width }, () => '---').join(' | ')} |`, ...body.map(line)];
}

/** Fenced code from a `pre`: the language from its `code`'s class or `data-lang`, the fence longer than any run inside. */
function fenced(pre: Element): string {
  const code = pre.querySelector('code') ?? pre;
  const lang = (/(?:^|\s)(?:language|lang)-([\w+#.-]+)/.exec(`${code.className} ${pre.className}`)?.[1] ?? code.getAttribute('data-lang') ?? pre.getAttribute('data-lang') ?? '').trim();
  const text = (pre.textContent ?? '').replace(/^\n+/, '').replace(/\s+$/, '');
  if (!text) return '';
  const runs = text.match(/`{3,}/g) ?? [];
  const fence = '`'.repeat(Math.max(3, ...runs.map((r) => r.length + 1)));
  return `${fence}${lang}\n${text}\n${fence}`;
}

/** Take the notes out of a footnote list: each item's text, its back-references dropped, by its id. */
function takeNotes(box: Element, w: Walk): void {
  for (const li of Array.from(box.querySelectorAll('li'))) {
    const id = li.id;
    if (!id) continue;
    const copy = li.cloneNode(true) as Element;
    for (const a of Array.from(copy.querySelectorAll('a'))) if (isBackref(a, w.base)) a.remove();
    for (const b of Array.from(copy.querySelectorAll('[class*="backlink" i]'))) b.remove();
    const text = collapse(inlineOf(copy, w)).replace(/^\^\s*/, '');
    if (text) w.notes.set(id, text);
  }
}

/**
 * Prose that the format cannot read as a card or an annotation: a `{{` is
 * written `{ {`, a ` :: ` or ` ::: ` loses the whitespace around it, a line
 * that is only `?` or `??` is escaped, a trailing ` ^id` and a `<!--` too.
 * Math written `\(…\)` or `\[…\]` becomes `$…$` or `$$…$$`.
 */
export function escapeProse(text: string): string {
  return text
    .replace(/\\\(([\s\S]+?)\\\)/g, (_, tex: string) => `$${tex.trim()}$`)
    .replace(/\\\[([\s\S]+?)\\\]/g, (_, tex: string) => `$$${tex.trim()}$$`)
    .replace(/\{\{/g, '{ {')
    .replace(/(^|\s+)(:{2,})(\s+|$)/g, '$2')
    .split('\n').map((l) => (/^\?\??$/.test(l) ? `\\${l}` : l)).join('\n')
    .replace(/(\s)\^([A-Za-z0-9_-]+)$/, '$1\\^$2')
    .replace(/<!--/g, '<!- -');
}

/** The blocks of `root` as Markdown, blank-line separated, in document order; footnotes collected into `w.notes`. */
function blocksOf(root: Element, w: Walk): string[] {
  const blocks: string[] = [];
  let buf = '';
  const flush = () => {
    const t = buf.split('\n').map(collapse).join('\n').replace(/\n{3,}/g, '\n\n').trim();
    if (t) for (const para of t.split('\n\n')) blocks.push(escapeProse(para));
    buf = '';
  };
  const visit = (n: Node) => {
    if (n.nodeType === 3) { buf += (n.textContent ?? '').replace(/\s+/g, ' '); return; }
    if (n.nodeType !== 1) return;
    const el = n as Element;
    const tag = el.tagName.toLowerCase();
    if (SKIP.has(tag)) return;
    if (tag === 'br') { buf += '\n'; return; }
    if (isNoteBox(el, tag)) { flush(); takeNotes(el, w); return; }
    const h = HEADING.exec(tag);
    if (h) {
      flush();
      const text = collapse(inlineOf(el, w));
      if (text) blocks.push(`${'#'.repeat(Number(h[1]))} ${text}`);
      return;
    }
    if (tag === 'pre') {
      flush();
      const code = fenced(el);
      if (code) blocks.push(code);
      return;
    }
    if (LIST.has(tag)) {
      flush();
      const lines = listLines(el, 0, w);
      if (lines.length) blocks.push(lines.join('\n'));
      return;
    }
    if (tag === 'blockquote') {
      flush();
      const inner = blocksOf(el, w).join('\n\n');
      if (inner) blocks.push(inner.split('\n').map((l) => (l ? `> ${l}` : '>')).join('\n'));
      return;
    }
    if (tag === 'table') {
      flush();
      const lines = tableLines(el, w);
      if (lines.length) blocks.push(lines.join('\n'));
      return;
    }
    if (tag === 'math' && el.getAttribute('display') === 'block') {
      flush();
      const m = mathOf(el);
      if (m) blocks.push(m);
      return;
    }
    if (tag === 'hr') { flush(); return; }
    if (BLOCK.has(tag)) {
      flush();
      for (const c of Array.from(el.childNodes)) visit(c);
      flush();
      return;
    }
    buf += inlineNode(el, w);
  };
  for (const c of Array.from(root.childNodes)) visit(c);
  flush();
  return blocks;
}

export interface Reduced {
  text: string;
  images: ClipImage[];
}

/**
 * The content of `root` as Markdown: the blocks in order, then, when the
 * page had footnotes, `## notes` and one `[^n]: text` paragraph per note in
 * the order they were met. Relative addresses are resolved against `base`.
 */
export function markdownOf(root: Element, base?: string): Reduced {
  const w: Walk = { base, images: [], seen: new Set(), numbers: new Map(), notes: new Map() };
  const blocks = blocksOf(root, w);
  const notes: string[] = [];
  for (const [id, text] of w.notes) if (w.numbers.has(id)) notes.push(`[^${w.numbers.get(id)}]: ${text}`);
  notes.sort((a, b) => Number(/\d+/.exec(a)?.[0]) - Number(/\d+/.exec(b)?.[0]));
  if (notes.length) blocks.push('## notes', ...notes);
  return { text: blocks.join('\n\n'), images: w.images };
}

/** A published date as the format writes it: a day when the page gave only a day, else a UTC instant; `''` when it is not a date. */
export function normalizeWhen(s: string | undefined | null): string {
  const v = collapse(s ?? '');
  if (!v) return '';
  const known = parseWhen(v);
  if (known) return known;
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return '';
  if (!/\d{1,2}:\d{2}/.test(v)) {
    // a day alone parses as UTC midnight when written as `YYYY-MM-DD`, as local midnight otherwise
    const utc = /^\d{4}-\d{2}-\d{2}/.test(v);
    const y = utc ? d.getUTCFullYear() : d.getFullYear();
    const m = (utc ? d.getUTCMonth() : d.getMonth()) + 1;
    const day = utc ? d.getUTCDate() : d.getDate();
    return `${y}-${String(m).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  }
  return d.toISOString().replace(/\.\d{3}Z$/, 'Z');
}

/**
 * The page in `html` at `url` as the clipper would write it: Defuddle's
 * article and metadata, the article reduced to Markdown by `markdownOf`;
 * when Defuddle finds nothing, Readability's article, else the whole body,
 * through the same walker. `null` when there is no text at all.
 */
export function clipPage(html: string, url: string): Clipped | null {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  if (url && !doc.querySelector('base')) {
    const base = doc.createElement('base');
    base.setAttribute('href', url);
    doc.head.appendChild(base);
  }
  let found: ReturnType<Defuddle['parse']> | null = null;
  try {
    found = new Defuddle(doc.cloneNode(true) as Document, { url, useAsync: false }).parse();
  } catch {
    found = null;
  }
  let reduced: Reduced = { text: '', images: [] };
  let via: Clipped['via'] = 'defuddle';
  if (found?.content) {
    const inner = new DOMParser().parseFromString(found.content, 'text/html');
    reduced = markdownOf(inner.body, url);
  }
  let title = collapse(found?.title ?? '') || collapse(doc.title ?? '');
  if (!stats(reduced.text).words) {
    via = 'fallback';
    let article: ReturnType<Readability['parse']> = null;
    try {
      article = new Readability(doc.cloneNode(true) as Document).parse();
    } catch {
      article = null;
    }
    if (article?.content) {
      const inner = new DOMParser().parseFromString(article.content, 'text/html');
      reduced = markdownOf(inner.body, url);
      if (!title && article.title) title = collapse(article.title);
    }
    if (!stats(reduced.text).words) reduced = markdownOf(doc.body, url);
    if (!stats(reduced.text).words) return null;
  }
  return {
    title,
    text: reduced.text,
    url,
    site: collapse(found?.site ?? '') || collapse(found?.domain ?? '') || hostOf(url),
    author: collapse(found?.author ?? ''),
    published: normalizeWhen(found?.published),
    description: collapse(found?.description ?? ''),
    words: stats(reduced.text).words,
    images: reduced.images,
    via,
  };
}

function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return '';
  }
}
