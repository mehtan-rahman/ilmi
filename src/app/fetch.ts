// The intake's two ways off the machine's own clipboard: a page fetched by
// address, and a file dropped on the window. Both go through Tauri (the
// webview cannot fetch across origins, and the fs scope covers only the
// vault) and come back as text the intake can show.

import { invoke } from '@tauri-apps/api/core';
import { fetch } from '@tauri-apps/plugin-http';
import { HTML_EXT, TEXT_EXT, cleanText, readable, titleFromFileName } from '../import/index.js';

export interface Fetched {
  /** The page's own title, or `''` for plain text. */
  title: string;
  text: string;
}

const looksLikeHtml = (s: string) => /^\s*(<!doctype\s+html|<html|<head|<body)/i.test(s);

/** The readable text at `url`: an article's for a page, the body itself for plain text. */
export async function fetchReadable(url: string): Promise<Fetched> {
  const res = await fetch(url, {
    headers: { accept: 'text/html, text/plain;q=0.9, text/markdown;q=0.9, */*;q=0.5' },
    connectTimeout: 20000,
  });
  if (!res.ok) throw new Error(`${res.status}`);
  const type = res.headers.get('content-type') ?? '';
  const body = await res.text();
  if (/html/i.test(type) || (!/text\/(plain|markdown)/i.test(type) && looksLikeHtml(body))) {
    const r = readable(body, res.url || url);
    if (!r) throw new Error('nothing readable');
    return r;
  }
  const text = cleanText(body);
  if (!text) throw new Error('nothing readable');
  return { title: '', text };
}

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
