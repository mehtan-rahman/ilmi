// A web page's readable text, as the intake lands it: Readability picks the
// article out of the page, and the walker below turns that article's DOM
// into the plain blocks FORMAT.md reads (headings as `#` lines, lists and
// quotes and code as the raw blocks they would be in a hand-written file).
// Runs wherever there is a `DOMParser`: the webview, jsdom in tests.

import { Readability } from '@mozilla/readability';

export interface Readable {
  title: string;
  text: string;
}

const SKIP = new Set([
  'script', 'style', 'noscript', 'template', 'iframe', 'svg', 'canvas', 'video', 'audio', 'object', 'embed',
  'head', 'title', 'meta', 'link', 'button', 'input', 'select', 'textarea', 'img', 'picture', 'source', 'nav',
]);
const BLOCK = new Set([
  'p', 'div', 'section', 'article', 'main', 'aside', 'header', 'footer', 'figure', 'figcaption',
  'address', 'details', 'summary', 'dl', 'dt', 'dd', 'form', 'fieldset', 'body', 'center',
]);
const HEADING = /^h([1-6])$/;
const LIST = new Set(['ul', 'ol']);

const collapse = (s: string) => s.replace(/\s+/g, ' ').trim();

/** Inline text of `el`, nested lists and skipped elements left out. */
function inlineText(el: Element): string {
  let out = '';
  const visit = (n: Node) => {
    if (n.nodeType === 3) { out += n.textContent ?? ''; return; }
    if (n.nodeType !== 1) return;
    const tag = (n as Element).tagName.toLowerCase();
    if (SKIP.has(tag) || LIST.has(tag)) return;
    if (tag === 'br') { out += ' '; return; }
    for (const c of Array.from(n.childNodes)) visit(c);
  };
  for (const c of Array.from(el.childNodes)) visit(c);
  return collapse(out);
}

/** One list as lines, nested lists indented under their item. */
function listLines(list: Element, depth: number): string[] {
  const ordered = list.tagName.toLowerCase() === 'ol';
  const lines: string[] = [];
  let n = 0;
  for (const li of Array.from(list.children)) {
    if (li.tagName.toLowerCase() !== 'li') continue;
    n++;
    const text = inlineText(li);
    if (text) lines.push(`${'  '.repeat(depth)}${ordered ? `${n}.` : '-'} ${text}`);
    for (const sub of Array.from(li.children)) {
      if (LIST.has(sub.tagName.toLowerCase())) lines.push(...listLines(sub, depth + 1));
    }
  }
  return lines;
}

/** The blocks of `root`, blank-line separated, in document order. */
export function textOf(root: Element): string {
  const blocks: string[] = [];
  let buf = '';
  const flush = () => {
    const t = buf.split('\n').map(collapse).join('\n').replace(/\n{3,}/g, '\n\n').trim();
    if (t) blocks.push(t);
    buf = '';
  };
  const visit = (n: Node) => {
    if (n.nodeType === 3) { buf += (n.textContent ?? '').replace(/\s+/g, ' '); return; }
    if (n.nodeType !== 1) return;
    const el = n as Element;
    const tag = el.tagName.toLowerCase();
    if (SKIP.has(tag)) return;
    if (tag === 'br') { buf += '\n'; return; }
    const h = HEADING.exec(tag);
    if (h) {
      flush();
      const text = inlineText(el);
      if (text) blocks.push(`${'#'.repeat(Number(h[1]))} ${text}`);
      return;
    }
    if (tag === 'pre') {
      flush();
      const code = (el.textContent ?? '').replace(/^\n+/, '').replace(/\s+$/, '');
      if (code) blocks.push(`\`\`\`\n${code}\n\`\`\``);
      return;
    }
    if (LIST.has(tag)) {
      flush();
      const lines = listLines(el, 0);
      if (lines.length) blocks.push(lines.join('\n'));
      return;
    }
    if (tag === 'blockquote') {
      flush();
      const inner = textOf(el);
      if (inner) blocks.push(inner.split('\n').map((l) => (l ? `> ${l}` : '>')).join('\n'));
      return;
    }
    if (tag === 'table') {
      flush();
      const rows = Array.from(el.querySelectorAll('tr')).map((tr) =>
        `| ${Array.from(tr.children).map((c) => inlineText(c)).join(' | ')} |`);
      if (rows.length) blocks.push(rows.join('\n'));
      return;
    }
    if (tag === 'hr') { flush(); return; }
    if (BLOCK.has(tag) || tag === 'li' || tag === 'tr') {
      flush();
      for (const c of Array.from(el.childNodes)) visit(c);
      flush();
      return;
    }
    for (const c of Array.from(el.childNodes)) visit(c);
  };
  for (const c of Array.from(root.childNodes)) visit(c);
  flush();
  return blocks.join('\n\n');
}

/**
 * The article in `html`: its title and its text. Readability finds the
 * article; when it finds none the whole body is used. `null` when there is
 * no text at all.
 */
export function readable(html: string, url?: string): Readable | null {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  if (url && !doc.querySelector('base')) {
    const base = doc.createElement('base');
    base.setAttribute('href', url);
    doc.head.appendChild(base);
  }
  const pageTitle = collapse(doc.title ?? '');
  let article: ReturnType<Readability['parse']> = null;
  try {
    article = new Readability(doc.cloneNode(true) as Document).parse();
  } catch {
    article = null;
  }
  let text = '';
  let title = pageTitle;
  if (article?.content) {
    const inner = new DOMParser().parseFromString(article.content, 'text/html');
    text = textOf(inner.body);
    if (article.title) title = collapse(article.title);
  }
  if (!text) text = textOf(doc.body);
  return text ? { title, text } : null;
}
