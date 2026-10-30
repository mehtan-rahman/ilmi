// Where a page sits, as links: each folder (or the document whose children
// it is among) above it, a click opening that row's lens, as the tree would.
// The reader's top row and the PDF lens draw it in place of the old text
// crumb (`crumbOf`).

import type { MouseEvent } from 'react';
import { dirOf } from '../vault/index.js';
import { titleOf } from './names.js';
import { plainMath } from './chromeText.js';
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

/** How many of the nearest levels the top row keeps; the rest are one `…`, the whole trail in the tooltip. */
export const CRUMBS_KEPT = 2;

/** The levels shown, nearest kept: `{ cut, shown }`, `cut` true when outer levels were left out. */
export function keptCrumbs<T>(trail: readonly T[], keep = CRUMBS_KEPT): { cut: boolean; shown: T[] } {
  return trail.length > keep ? { cut: true, shown: trail.slice(-keep) } : { cut: false, shown: [...trail] };
}

/**
 * The crumb on one line: the nearest parents as links, the outer ones one
 * `…` (a click opening the first of them), each level cut by its width if
 * it must be, the full trail in the tooltip.
 */
export function Crumbs({ path }: { path: string }) {
  const docs = useApp((s) => s.docs);
  const trail = crumbTrail(path, docs);
  const go = (p: string) => (e: MouseEvent) => { e.preventDefault(); openNode(p, { cmdClick: e.metaKey || e.ctrlKey, shiftClick: e.shiftKey }); };
  const { cut, shown } = keptCrumbs(trail);
  const outer = trail[trail.length - shown.length - 1];
  return (
    <span className="crumb crumbs" title={plainMath(trail.map((c) => c.label).join(' / '))}>
      {cut && outer && <a className="cr cr-cut" href="#" data-path={outer.path} onClick={go(outer.path)}>…</a>}
      {shown.map((c) => (
        <a key={c.path} className="cr" href="#" data-path={c.path} onClick={go(c.path)}><bdi>{plainMath(c.label)}</bdi></a>
      ))}
    </span>
  );
}
