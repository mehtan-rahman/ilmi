// HTML from the clipboard as the Markdown it stands for: the clipper's
// walker (`markdownOf`, page.ts), which keeps what a paste wants kept
// (headings, lists, emphasis, links, inline and fenced code, tables, math,
// images by address) and escapes what the format would read as a card. The
// EPUB reducer (`reduceChapter`) was the plan's first thought; it writes a
// link as its text and drops images, which a page pasted from the web
// should keep. Before the walk, the markup a word processor puts on the
// clipboard is made plain: Google Docs wraps everything in a `<b>` that is
// not bold and says bold and italic in `style`; Word adds `o:p` and
// conditional comments.

import { markdownOf } from './page.js';

const BOLD = /font-weight\s*:\s*(bold|[6-9]00)/i;
const ITALIC = /font-style\s*:\s*italic/i;
const STRIKE = /text-decoration[^;]*line-through/i;

/** The clipboard's `text/html` as Markdown; `''` when it holds no text. */
export function htmlMarkdown(html: string): string {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const body = doc.body;
  // Google Docs: `<b style="font-weight:normal" id="docs-internal-guid-…">` around the whole fragment
  for (const b of Array.from(body.querySelectorAll('b[id^="docs-internal-guid"]'))) b.replaceWith(...Array.from(b.childNodes));
  for (const el of Array.from(body.querySelectorAll('o\\:p, xml, style, meta'))) el.remove();
  // emphasis said in style, innermost first so nested spans nest their marks
  for (const span of Array.from(body.querySelectorAll<HTMLElement>('span[style]')).reverse()) {
    const style = span.getAttribute('style') ?? '';
    let node: Element = span;
    const wrap = (tag: string) => {
      const w = doc.createElement(tag);
      w.append(...Array.from(node.childNodes));
      node.append(w);
      node = w;
    };
    if (BOLD.test(style) && !span.closest('h1, h2, h3, h4, h5, h6, b, strong')) wrap('strong');
    if (ITALIC.test(style) && !span.closest('em, i')) wrap('em');
    if (STRIKE.test(style)) wrap('del');
  }
  return markdownOf(body).text.trim();
}
