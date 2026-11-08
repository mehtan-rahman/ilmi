// The app's icons: one hand-drawn set on a 16px grid, a 1.4px stroke with
// round caps and joins, drawn in the ink around them (currentColor). They
// stand in for the Unicode marks the chrome used to set in Plex Mono.
//
// `Glyph` takes the mark a kind has always had (`GLYPH`, `ENTRY_GLYPH`,
// `EL_GLYPH`, a menu's character) and draws its icon, keeping the mark
// itself in the text, hidden (`.gch`), so whatever reads a row's text reads
// what it always did. A mark with no icon is left as the character.

import type { ReactNode } from 'react';

export type IconName =
  | 'folder' | 'note' | 'book' | 'extract' | 'deck' | 'draft' | 'add' | 'query' | 'card' | 'search'
  | 'chevron' | 'split' | 'panel' | 'panel-left' | 'close' | 'more' | 'vault' | 'arrow' | 'back'
  | 'tabs' | 'tree' | 'fold' | 'unfold' | 'menu' | 'trash' | 'copy' | 'download' | 'pages' | 'sort' | 'caret' | 'pause';

const P: Record<IconName, ReactNode> = {
  folder: <path d="M2 4.6c0-.6.4-1.1 1-1.1h3.1l1.6 1.6H13c.6 0 1 .4 1 1v6c0 .6-.4 1-1 1H3c-.6 0-1-.4-1-1z" />,
  note: <><path d="M4.2 2h5.3l3 3v8.4c0 .3-.3.6-.6.6H4.2c-.3 0-.7-.3-.7-.6V2.6c0-.3.4-.6.7-.6z" /><path d="M9.5 2v3h3M5.8 8.2h4.4M5.8 10.8h3" /></>,
  book: <path d="M8 4.3C6.8 3.4 5 3 2.5 3v9.6c2.5 0 4.3.4 5.5 1.3 1.2-.9 3-1.3 5.5-1.3V3C11 3 9.2 3.4 8 4.3zM8 4.3v9.5" />,
  extract: <path d="M3.5 3v10M6.5 4.5h6M6.5 8h6M6.5 11.5h3.5" />,
  deck: <><rect x="2.5" y="5.5" width="11" height="8" rx="1" /><path d="M4.5 3.5h7" /></>,
  draft: <path d="M10.4 2.9l2.7 2.7-7.3 7.3-3.3.6.6-3.3zM9.1 4.2l2.7 2.7" />,
  add: <path d="M8 3.5v9M3.5 8h9" />,
  query: <path d="M6 4.5h7M6 8h7M6 11.5h7M3 4.5h.6M3 8h.6M3 11.5h.6" />,
  card: <><rect x="2.5" y="4" width="11" height="8" rx="1" /><path d="M5 7.2h6M5 9.4h3.5" /></>,
  search: <><circle cx="7" cy="7" r="4.2" /><path d="M10.2 10.2l3.3 3.3" /></>,
  chevron: <path d="M6 4l4 4-4 4" />,
  caret: <path d="M4 6l4 4 4-4" />,
  split: <><rect x="2.5" y="3" width="11" height="10" rx="1" /><path d="M8 3v10" /></>,
  panel: <><rect x="2" y="3.5" width="12" height="9" rx="1" /><path d="M10 3.5v9" /><path className="ic-fill" d="M10 4h3.2c.3 0 .3.2.3.4v7.2c0 .3 0 .4-.3.4H10z" /></>,
  'panel-left': <><rect x="2" y="3.5" width="12" height="9" rx="1" /><path d="M6 3.5v9" /><path className="ic-fill" d="M6 4H2.8c-.3 0-.3.2-.3.4v7.2c0 .3 0 .4.3.4H6z" /></>,
  close: <path d="M4.5 4.5l7 7M11.5 4.5l-7 7" />,
  more: <><circle cx="3.8" cy="8" r=".6" /><circle cx="8" cy="8" r=".6" /><circle cx="12.2" cy="8" r=".6" /></>,
  vault: <path d="M2.5 3.5h11v3h-11zM3.5 6.5v6h9v-6M6.5 9h3" />,
  arrow: <path d="M3 8h10M9.5 4.5L13 8l-3.5 3.5" />,
  back: <path d="M13 8H3M6.5 4.5L3 8l3.5 3.5" />,
  tabs: <path d="M2.5 6h11v7h-11zM2.5 6V3.5h4.2L7.7 6" />,
  tree: <path d="M4 2.8v9.4M4 7h4.5M4 12.2h4.5M10.5 7h2.5M10.5 12.2h2.5" />,
  fold: <path d="M8 4L4 8l4 4M12.5 4l-4 4 4 4" />,
  unfold: <path d="M8 4l4 4-4 4M3.5 4l4 4-4 4" />,
  menu: <path d="M2.5 4.5h11M2.5 8h11M2.5 11.5h11" />,
  trash: <path d="M3 4.5h10M6.5 4.5V3h3v1.5M4.3 4.5l.6 8.5h6.2l.6-8.5M6.8 7v3.8M9.2 7v3.8" />,
  copy: <><rect x="5.5" y="5.5" width="8" height="8" rx="1" /><path d="M10.5 5.5V3.5c0-.6-.4-1-1-1h-6c-.6 0-1 .4-1 1v6c0 .6.4 1 1 1h2" /></>,
  download: <path d="M8 2.5v8M4.5 7L8 10.5 11.5 7M3 13.5h10" />,
  pages: <><rect x="3" y="2.5" width="10" height="11" rx="1" /><path d="M5.5 5.5h5M5.5 8h5M5.5 10.5h5" /></>,
  pause: <path d="M6 4v8M10 4v8" />,
  sort: <path d="M5 3v10M2.8 5.2L5 3l2.2 2.2M11 13V3M8.8 10.8L11 13l2.2-2.2" />,
};

/** One icon, sized by `--ic` (14px unless the place sets it). */
export function Icon({ name, className }: { name: IconName; className?: string }) {
  return (
    <svg className={className ? `ic ic-${name} ${className}` : `ic ic-${name}`} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
      {P[name]}
    </svg>
  );
}

/** The icon each of the old marks stands for. */
const OF: Record<string, IconName> = {
  '/': 'folder', '¶': 'note', '“': 'book', '§': 'extract', '=': 'deck', '~': 'draft', '＋': 'add', '+': 'add', '≡': 'query',
  '◆': 'card', '⌕': 'search', '›': 'chevron', '⌂': 'vault', '✎': 'draft', '→': 'arrow', '◂': 'back', '⊞': 'tabs', '⋮': 'tree',
  '⌫': 'trash', '⧉': 'copy', '↧': 'download', '▤': 'pages', '↕': 'sort', '‖': 'pause', '⊟': 'split', '×': 'close', '«': 'fold', '»': 'unfold',
  '▸': 'chevron', '▾': 'caret',
};

/** A kind's mark drawn as its icon, the mark kept (hidden) in the text. */
export function Glyph({ g }: { g: string }) {
  const name = OF[g];
  if (!name) return <>{g}</>;
  return <><Icon name={name} /><span className="gch">{g}</span></>;
}

/** A `+ word` button's words: the add icon, then the word; the `+ ` kept (hidden) in the text. */
export function Plus({ text }: { text: string }) {
  const word = text.replace(/^\+ ?/, '');
  return <><Icon name="add" /><span className="gch">{text.slice(0, text.length - word.length)}</span><span className="lbl">{word}</span></>;
}
