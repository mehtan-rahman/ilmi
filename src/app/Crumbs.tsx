// Where a page sits, as links: each folder (or the document whose children
// it is among) above it, a click opening that row's lens, as the tree would.
// The reader's top row and the PDF lens draw it in place of the old text
// crumb (`crumbOf`).

import type { MouseEvent } from 'react';
import { dirOf } from '../vault/index.js';
import { titleOf } from './names.js';
import { useApp, type DocInfo } from './store.js';
import { openNode } from './vault.js';

/** The rows above `path`, outermost first: a folder by its path, a document's children directory by the document. */
export function crumbTrail(path: string, docs: Record<string, DocInfo>): { path: string; label: string }[] {
  const dir = dirOf(path);
  if (!dir) return [];
  const out: { path: string; label: string }[] = [];
  let at = '';
  for (const seg of dir.split('/')) {
    at = at ? `${at}/${seg}` : seg;
    const row = docs[`${at}.md`] ? `${at}.md` : at;
    out.push({ path: row, label: titleOf(row, docs, null) });
  }
  return out;
}

export function Crumbs({ path }: { path: string }) {
  const docs = useApp((s) => s.docs);
  const trail = crumbTrail(path, docs);
  const go = (p: string) => (e: MouseEvent) => { e.preventDefault(); openNode(p, { cmdClick: e.metaKey || e.ctrlKey, shiftClick: e.shiftKey }); };
  return (
    <span className="crumb crumbs">
      {trail.map((c) => (
        <a key={c.path} className="cr" href="#" data-path={c.path} onClick={go(c.path)}><bdi>{c.label}</bdi></a>
      ))}
    </span>
  );
}
