// The intake's two ways off the machine's own clipboard: a page fetched by
// address, and a file dropped on the window. Both go through Tauri (the
// webview cannot fetch across origins, and the fs scope covers only the
// vault) and come back as text the intake can show.

import { invoke } from '@tauri-apps/api/core';
import { fetch } from '@tauri-apps/plugin-http';
import { HTML_EXT, TEXT_EXT, cleanText, clipPage, readable, titleFromFileName, type AnkiPackage, type Clipped, type Epub } from '../import/index.js';
import type { ImageGet } from '../vault/index.js';
import { pdfText } from './pdfjs.js';

export const PDF_EXT = /\.pdf$/i;
export const APKG_EXT = /\.apkg$/i;
export const EPUB_EXT = /\.epub$/i;

/** A dropped or picked book in EPUB, read on the Rust side: its metadata and the spine's XHTML in reading order. */
export async function readEpub(path: string): Promise<Epub> {
  if (!EPUB_EXT.test(path)) throw new Error('not a book');
  return invoke<Epub>('read_epub', { path });
}

/** A dropped or picked Anki package, read on the Rust side (the webview cannot open SQLite): its decks, notetypes, notes, and cards as plain data. */
export async function readAnkiPackage(path: string): Promise<AnkiPackage> {
  if (!APKG_EXT.test(path)) throw new Error('not an anki package');
  return invoke<AnkiPackage>('read_anki_package', { path });
}

export interface FetchedPdf extends Fetched {
  bytes: Uint8Array;
  pages: number;
  /** A book's chapters from its outline (milestone 46): it lands as a notebook, a chapter per tab. */
  chapters?: { title: string; first: number; last: number; text: string }[];
}

/** A dropped or picked PDF: its bytes, and its text and page count through pdf.js; the title from its metadata, else its name. */
export async function readDroppedPdf(path: string): Promise<FetchedPdf> {
  const name = path.slice(path.lastIndexOf('/') + 1);
  if (!PDF_EXT.test(name)) throw new Error('not a pdf');
  const bytes = new Uint8Array(await invoke<ArrayBuffer>('read_dropped_bytes', { path }));
  const r = await pdfText(bytes);
  return { title: r.title || titleFromFileName(name.replace(PDF_EXT, '')), text: r.text, bytes, pages: r.pages, chapters: r.chapters };
}

/** What a page said about itself, beside its text: the clipper's fields, the images in the text, and which pass found the article. */
export type PageInfo = Omit<Clipped, 'title' | 'text'>;

export interface Fetched {
  /** The page's own title, or `''` for plain text. */
  title: string;
  text: string;
  /** Present when the address answered with a page. */
  page?: PageInfo;
}

const looksLikeHtml = (s: string) => /^\s*(<!doctype\s+html|<html|<head|<body)/i.test(s);

/** The readable text at `url`: a page as the clipper would write it (`clipPage`), the body itself for plain text. */
export async function fetchReadable(url: string): Promise<Fetched> {
  const res = await fetch(url, {
    headers: { accept: 'text/html, text/plain;q=0.9, text/markdown;q=0.9, */*;q=0.5' },
    connectTimeout: 20000,
  });
  if (!res.ok) throw new Error(`${res.status}`);
  const type = res.headers.get('content-type') ?? '';
  const body = await res.text();
  if (/html/i.test(type) || (!/text\/(plain|markdown)/i.test(type) && looksLikeHtml(body))) {
    const r = clipPage(body, res.url || url);
    if (!r) throw new Error('nothing readable');
    const { title, text, ...page } = r;
    return { title, text, page };
  }
  const text = cleanText(body);
  if (!text) throw new Error('nothing readable');
  return { title: '', text };
}

/** One image for `Vault.attachImages`: its bytes and content type through the http plugin; null when the address does not answer. */
export const fetchImage: ImageGet = async (url) => {
  const res = await fetch(url, { headers: { accept: 'image/*, */*;q=0.5' }, connectTimeout: 20000 });
  if (!res.ok) return null;
  return { bytes: new Uint8Array(await res.arrayBuffer()), type: res.headers.get('content-type') ?? '' };
};

/** A dropped file: `.txt` / `.md` as they are, `.html` as its readable text. Others are refused. */
export async function readDropped(path: string): Promise<Fetched> {
  const name = path.slice(path.lastIndexOf('/') + 1);
  if (!TEXT_EXT.test(name) && !HTML_EXT.test(name)) throw new Error('not a text file');
  const body = await invoke<string>('read_dropped', { path });
  if (HTML_EXT.test(name)) {
    const r = readable(body);
    if (!r) throw new Error('nothing readable');
    return { title: r.title || titleFromFileName(name), text: r.text };
  }
  const text = cleanText(body);
  if (!text) throw new Error('nothing readable');
  return { title: titleFromFileName(name), text };
}
