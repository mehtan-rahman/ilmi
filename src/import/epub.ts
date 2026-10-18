// A book in EPUB: the plain data `read_epub` returns on the Rust side
// (`src-tauri/src/epub.rs`) mapped to one source per spine item, in reading
// order, for a folder named after the book. Pure; `importBookNode` lands the
// files. A chapter's XHTML goes through the intake's own walker (`textOf`),
// the direct path and not the readability pass meant for web pages, so
// nothing in a chapter is judged boilerplate. What the format lacks is
// dropped and counted: images (a `[figure: alt]` mark where one stood when
// it had alt text), footnote back-references, and the pages too short to be
// chapters (cover, title page, copyright).

import { fileName } from '../vault/paths.js';
import { textOf } from './readable.js';
import { stats } from './text.js';

// ── what the Rust side returns ───────────────────────────────────

export interface Epub {
  /** `<dc:title>`, or `''`. */
  title: string;
  creators: string[];
  language: string;
  /** The spine in reading order, XHTML items only. */
  items: EpubItem[];
  /** Manifest hrefs of the images; not extracted. */
  images: string[];
}

export interface EpubItem {
  href: string;
  html: string;
  /** The toc title pointing at the item, or at an anchor inside it. */
  title: string | null;
  /** The navigation document itself, when the spine lists it. */
  nav: boolean;
}

// ── what the mapping makes ───────────────────────────────────────

export interface Chapter {
  /** The position among the chapters that land, from 1. */
  n: number;
  /** The file name without `.md`: the position, then the title. */
  name: string;
  title: string;
  /** The body as Markdown. */
  text: string;
  words: number;
}

export interface BookDropped {
  /** Images, whether or not a figure mark stands where one was. */
  images: number;
  /** Images that left a `[figure: alt]` mark. */
  figures: number;
  /** Spine items with fewer than `MIN_WORDS` words after reduction. */
  short: number;
}

export interface MappedBook {
  /** `<dc:title>`, or `''` when the package has none. */
  title: string;
  creators: string[];
  chapters: Chapter[];
  words: number;
  /** At 220 words a minute. */
  minutes: number;
  dropped: BookDropped;
}

/** A spine item with fewer words than this is a cover or a title page, not a chapter. */
export const MIN_WORDS = 30;

export const noBookDropped = (): BookDropped => ({ images: 0, figures: 0, short: 0 });

// ── one chapter ──────────────────────────────────────────────────

const collapse = (s: string) => s.replace(/\s+/g, ' ').trim();

/** Only the glyphs a back-reference tends to be: an arrow back, a caret. */
const RETURN_GLYPHS = /^[\s↩↵⏎↑^⤴︎]+$/u;

/** An anchor that leads back from a footnote to its reference. */
function isBacklink(a: Element): boolean {
  const type = a.getAttribute('epub:type') ?? '';
  if (type.split(/\s+/).includes('backlink') || a.getAttribute('role') === 'doc-backlink') return true;
  const href = a.getAttribute('href') ?? '';
  const text = a.textContent ?? '';
  return href.startsWith('#') && text.trim().length > 0 && RETURN_GLYPHS.test(text);
}

/** `s` as a key for telling a heading from a title: case, punctuation, and spacing set aside. */
const key = (s: string) => s.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '');

export interface Reduced {
  /** The body as Markdown, every heading kept. */
  text: string;
  /** The first heading's text, or `null`. */
  heading: string | null;
  words: number;
}

/**
 * A chapter's XHTML as Markdown through the intake's walker, after the
 * markup is tidied for a book: back-references out; an image out, a
 * `[figure: alt]` paragraph where it stood when it had alt text; emphasis as
 * `*…*` and `**…**`; links are already their text. Counts into `dropped`.
 */
export function reduceChapter(html: string, dropped: BookDropped): Reduced {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const body = doc.body;
  const first = body.querySelector('h1, h2, h3, h4, h5, h6');
  const heading = first ? collapse(first.textContent ?? '') || null : null;
  for (const a of Array.from(body.querySelectorAll('a'))) {
    if (isBacklink(a)) a.remove();
  }
  for (const img of Array.from(body.querySelectorAll('img, svg'))) {
    dropped.images++;
    const alt = img.tagName.toLowerCase() === 'svg'
      ? collapse(img.querySelector('title')?.textContent ?? '')
      : collapse(img.getAttribute('alt') ?? '');
    if (alt) {
      dropped.figures++;
      const p = doc.createElement('p');
      p.textContent = `[figure: ${alt}]`;
      img.replaceWith(p);
    } else img.remove();
  }
  // innermost first, so `<em><strong>…</strong></em>` nests its marks
  for (const el of Array.from(body.querySelectorAll('em, i, strong, b')).reverse()) {
    const raw = el.textContent ?? '';
    const inner = raw.trim();
    if (!inner) { el.replaceWith(doc.createTextNode(raw)); continue; }
    const mark = /^(em|i)$/i.test(el.tagName) ? '*' : '**';
    const lead = raw.slice(0, raw.length - raw.trimStart().length);
    const tail = raw.slice(raw.trimEnd().length);
    el.replaceWith(doc.createTextNode(`${lead}${mark}${inner}${mark}${tail}`));
  }
  const text = textOf(body);
  return { text, heading, words: stats(text).words };
}

/** `text` without its first heading block when that heading reads as `title`. */
export function withoutTitleHeading(text: string, title: string): string {
  const blocks = text.split('\n\n');
  const at = blocks.findIndex((b) => /^#{1,6} /.test(b));
  if (at < 0 || at > 2) return text;
  const h = blocks[at]!.replace(/^#{1,6} /, '').replace(/\s+#+$/, '');
  if (key(h) !== key(title)) return text;
  blocks.splice(at, 1);
  return blocks.join('\n\n');
}

// ── the book ─────────────────────────────────────────────────────

/** `n` padded to the width the count needs, two digits at least. */
export const position = (n: number, count: number): string => String(n).padStart(Math.max(2, String(count).length), '0');

/**
 * Every spine item that is a chapter, as a source in reading order: the
 * navigation document and the short pages skipped; the title from the toc,
 * else the first heading, else `chapter NN`; that heading dropped from the
 * body when it is the title.
 */
export function mapBook(book: Epub): MappedBook {
  const dropped = noBookDropped();
  const kept: { item: EpubItem; r: Reduced }[] = [];
  for (const item of book.items) {
    if (item.nav) continue;
    const r = reduceChapter(item.html, dropped);
    if (r.words < MIN_WORDS) { dropped.short++; continue; }
    kept.push({ item, r });
  }
  const chapters = kept.map(({ item, r }, i) => {
    const n = i + 1;
    const nn = position(n, kept.length);
    const title = collapse(item.title ?? '') || r.heading || `chapter ${nn}`;
    const text = withoutTitleHeading(r.text, title);
    return { n, name: fileName(`${nn} ${title}`), title, text, words: stats(text).words };
  });
  const words = chapters.reduce((sum, c) => sum + c.words, 0);
  return { title: collapse(book.title), creators: book.creators.map(collapse).filter(Boolean), chapters, words, minutes: Math.round(words / 220), dropped };
}

/** Reading time as the intake says it: minutes under an hour, else hours to a half. */
export function readingLabel(minutes: number): string {
  if (minutes < 60) return `~${Math.max(1, minutes)} min`;
  const h = Math.round(minutes / 30) / 2;
  return `~${h} h`;
}
