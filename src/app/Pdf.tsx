// A document with pages opens as a book (milestone 48): its PDF's pages,
// rendered by pdf.js with the text layer on. Since milestone 70 a PDF is a
// thing of its own: a book open is its pages across the whole pane, a page
// drawn to the pane's width up to `PAGE_MAX` and centred past it, the
// inspector closed as it opens (`layout.ts`), nothing beside them. The
// notes on the pages are a note attached to the PDF (`book.ts`): a document
// with pages is its own notes, as 48 had it; a PDF with no `.md` of its
// name shows the first note that names it in its `pdf` field, or none yet.
// The note opens in the pane beside the pages when asked (`notes` among the
// words over the pages, ⌘\) as the ordinary tab it is, and closes again;
// what goes to a place in it (a box made a section, a section's name beside
// its box, ⏎ after a section is made) opens it beside the pages if it is
// not. Nothing slides over the pages. A PDF with no note yet asks for one
// the first time something is kept from it, or at `notes`: a note that is
// there, or a new one in a folder of the person's choosing.
//
// The pages carry what the notes say about them. A gold bar in the margin
// runs from the first page to the read point (`pos` and `y` on the `read`
// line). Boxes drawn on the pages (drag; drag again for another, on any
// page; a text selection boxes its lines; under a finger the drag comes
// after a short hold, since milestone 57) become a section of the notes
// with `e`: a `##` heading named from the page, in book order, with its
// `<!-- read … boxes=… -->` line, back on its cadence until dismissed
// (FORMAT.md §6.5). `m` makes the section and puts the caret in it to card,
// or on a page that names no sections (a passage book, Arabic) clips the
// box into the notes under `## p. N` (§6.6). Every section's boxes are drawn
// on its pages, tagged with its name (a § in the gutter when there is no
// room), dashed once dismissed; the caret's section lights its boxes and
// the pages scroll to them. Nothing is written into the PDF, ever; every
// change goes to the Markdown, through the open note's writer.
//
// A page may be written on (milestones 67, 69). On an iPad the Pencil writes
// where it lands, its first touch a stroke, on a canvas lying over the page
// and scrolling with it (`ink.ts`); the pages are a surface, each one near
// the screen a sheet. A finger still scrolls and boxes after its hold, and
// the mouse boxes. What is written is strokes in the store, found by the
// PDF's hash and the page's number, and every device lays the picture made
// of them over the page (`PageInk`), the Mac too; while a canvas lies over a
// page its picture stands aside, the same strokes twice otherwise.
//
// The pages may be drawn larger than they fit: ⌘= ⌘− step a book's zoom
// (`ZOOMS`, fit the floor), ⌘0 is fit again, a pinch on a trackpad steps
// once. The zoom multiplies the one scale everything on the pages is laid
// out by, so boxes, writing, highlights and the read bar follow; pages wider
// than the pane scroll sideways in the scroller that scrolls them down. Kept
// by the book's id for as long as the app runs, as its place is.
//
// Getting around (milestone 76, after sioyek's reader). Every jump (a
// search's first hit, `g` to a page, the contents, a link, a reference, a
// section gone to with `[ ]` when it lies more than a screen away) leaves the
// place it was made from on the book's trail (`book.ts`, `pdf/around.ts`): ⌫
// goes back to it, ⇧⌫ forward again. The PDF's own links are followed by a
// press that does not move (a press that moves is the box's or the
// selection's, as ever): an inside one is a jump, a web one opens in the
// system's browser. `t` lists the contents in the palette. A press with ⌥,
// or a right-click's `peek`, on a link or on a word that names something
// (`(3.12)`, `Fig. 4`, `Section 3.2`, `[17]`; `pdf/refs.ts`) shows where it
// points in the peek a selection's ⏎ shows. `f` letters every link and
// reference in view; the letters typed follow one, with ⇧ they peek. `n` and
// `N` step a search's hits. A selection's right-click looks it up on the web.
//
// What you leave on the page (milestone 77, after sioyek's again). Kept by
// the PDF's hash, as what is written on it is (`book.ts`, `vault/marks.ts`),
// so a chapter cut from a book and the book show the same. `b` names the
// place in view: a bookmark, a small mark in the left gutter. ⇧M and a
// letter marks the place, `'` and the letter goes to it (a capital is the
// collection's: it opens its book). `h` highlights a selection, or clears
// the highlight the selection or the last press lies in; 1–4 while its
// notice shows choose its ink (a band, a rule, a dashed rule, a dotted one:
// told apart with no colour). ⇧P at a place, then ⇧P at another, ties the
// first to the second: a portal, a small mark in the page's right margin
// that peeks at where it shows; with the book in the pane beside as well
// (`portals beside` in the palette) that pane goes to each portal's
// destination as its source is read past. `v`, or a press in a page's left
// margin, holds a line under a rule: ↓ ↑ (j k) move it a line, the page
// following; `r` sets the read point to it.

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { boxesEnd, formatClip, meta, sectionDismissed, setField, type Box, type Doc } from '../format/index.js';
import {
  actionPage, bandNear, bookmarksOf, boxAround, contentsHere, contentsWithin, countIn, downPage, findAll, findText, flatOutline, flipRect, headingAbove, highlightAt, highlightHolding, highlightOf,
  highlightsOf, hintLabels, hintStep, isCollectionMark, letterId, lineBands, lineQuads, linesOf, linkAt, lookupUrl, newMarkId, pageLinks, placeOf, portalAbove, portalsOf,
  pushPlace, quadBoxes, refOf, referenceTokens, resolveDest, sectionName, seekTarget, stepBack, stepForward, stepLine, textBoxes, tokenAt,
  type ContentsEntry, type ContentsPdf, type Found, type LineBand, type PageItem, type PageLink, type Place, type RefToken,
} from '../pdf/index.js';
import { pickPos, type Band } from '../reader/index.js';
import { addPassage, passagesOf, pointOn, sectionState, type Passage } from '../schedule/index.js';
import { INKS, addToPage, childDirOf, isPdfPath, type InkStroke, type Mark, type Portal, type Quad, type StoreFs } from '../vault/index.js';
import { CueActions } from '../plugins/CueActions.js';
import { onPluginAction, publishSelection, toPluginSelection, type PluginSelection } from '../plugins/index.js';
import { noteOf, notesTabOf, titleOf } from './names.js';
import { besideAt } from './panes.js';
import {
  addLens, ensureNote, findCollectionMark, followTo, followed, goToMark, lensChanged, openContents, openNotes, openWeb, portalPending, setCollectionMark, setMark, setPortalPending, setTrail,
  takePlace, toggleNotes, trailOf, useFollowed, useFollower, followingAt, useMarks, usePlaceWanted, usePortalPending, useTrail, type BookContents, type BookLens,
} from './book.js';
import { popMenu, popMenuOpen, type PopItem } from './popMenu.js';
import { TextLayer, pageBits, type PDFDocumentProxy } from './pdfjs.js';
import { acquirePdf, itemsOf } from './bookPdf.js';
import { addSurface, afterScene, covered, fillSheet, hasCanvas, inContent, pagePaper, portOf, restSheet, sceneSoon, type PenEvent, type SheetSpec, type Surface } from './ink.js';
import { Crumbs } from './Crumbs.js';
import { StudyButton } from './StudyButton.js';
import { ExamTag } from './ExamTag.js';
import { TabsToggle } from './TabsToggle.js';
import { useApp, type DocInfo } from './store.js';
import { useDoc } from './useDoc.js';
import { currentVault, enrolReading, logReading, unlogReading } from './vault.js';
import { writeDoc } from './sections.js';
import { notify } from './land.js';
import { appNow } from './clock.js';
import { press } from './platform.js';
import { HOLD_MS, SLOP, onGlass, pagePress } from './touch.js';
import { plainMath } from './chromeText.js';
import './pdf.css';

/** Space between pages, px. */
const GAP = 18;
/** How far outside the view a page starts rendering, px. */
const AHEAD = 900;
/** Pages the lens looks at to decide whether the PDF has a text layer. */
const PROBE = 3;
/** Room beside a page for the sections' names; less than this and they are a § in the gutter. */
const TAG_ROOM = 210;
/** The widest a page is drawn, the width a page is still read at: past it the page is centred in the pane. */
const PAGE_MAX = 960;
/** How far down the view the place kept across a change of scale is, px: under the words over the pages. */
const PLACE_AT = 60;
/** The zooms a book's pages step through: 1 is the pages fitted to the pane, the least there is. */
export const ZOOMS = [1, 1.25, 1.5, 2, 2.5, 3];
/** The most pixels a page's canvas is drawn with: past it the page is drawn coarser, not larger (a canvas over WebKit's limit draws nothing). */
const CANVAS_MAX = 16_000_000;
/** Zoomed, a page this far outside the view gives its canvas back, px. */
const FAR = AHEAD * 3;
/** A pinch's wheel events closer together than this are one gesture, ms. */
const PINCH_GAP = 260;
/** How far back from a passage the lens reads pages for a heading to name it. */
const NAME_BACK = 30;

/** Room left over what a jump goes to, px: a heading gone to lies a line under the words over the pages. */
const JUMP_ROOM = 16;
/** How far a mouse's press may move and still be a press, px (a finger's is `SLOP`). */
const PRESS_SLOP = 3;

/** How much of a page's width, from its left edge, is the margin a press holds a line by. */
const RULER_MARGIN = 0.06;
/** How far under the place in view a heading may lie and still name a bookmark made there, as a fraction of the page. */
const NAME_UNDER = 0.03;
/** What each ink of a highlight is, as its menu says it. */
const INK_NAMES = ['band', 'rule', 'dashed rule', 'dotted rule'];
/** The ink a new highlight is made in: the one last chosen. */
let lastInk = 1;

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;

const inField = (t: EventTarget | null) => {
  const el = t as HTMLElement | null;
  const tag = el?.tagName?.toLowerCase();
  return tag === 'input' || tag === 'textarea' || !!el?.isContentEditable;
};

/** The selection on a page: its text, the page, where it sits on screen, and the text-layer line it starts in; its lines as boxes. */
interface Sel {
  text: string;
  page: number;
  rect: DOMRect;
  line: string;
  boxes: Box[];
  /** Its lines, a quad each: what a highlight keeps. */
  quads: Quad[];
}

interface Size { w: number; h: number }

/** Smart jump's answer: the page a reference points to, shown in a peek without leaving the page. */
interface Peek {
  page: number;
  /** The target line's baseline and type size, in PDF units. */
  y: number;
  height: number;
  text: string;
  /** What the peek hangs under, on the screen. */
  rect: { left: number; bottom: number };
  /** Where a press in the peek goes: the page and how far down it. */
  at: { page: number; y: number };
}

/** What `f` letters: a link, or a word that names something, on a page (fractions of it). */
interface HintTarget {
  label: string;
  page: number;
  x: number;
  y: number;
  w: number;
  h: number;
  link?: PageLink;
  text?: string;
}
interface Hints { targets: HintTarget[]; typed: string }

/** How much of the target page the peek shows, css px at the page's scale. */
/** A hit nearer than this to the view's top or bottom is brought a third of the way down, css px. */
const HIT_EDGE = 90;
const PEEK_H = 150;
const PEEK_W = 480;

interface Find {
  q: string;
  /** Pages with a hit, in order, and how many on each. */
  pages: { page: number; n: number }[];
  /** The hit shown, counted through the book: 0 is the first on the first of `pages`. */
  at: number;
  /** Moves with every step, so a step that lands on the hit already shown still brings it into view. */
  go?: number;
  /** Whether `q` has been looked for: not yet, while it is, or done. */
  did?: 'searching' | 'done';
}

/** Where each book was left, by its id: the page and the place on it at the top of the view, and the scroll itself. A tab shown again comes back to it. */
/** How many hits a search found, over all its pages. */
const hitCount = (pages: Find['pages']): number => pages.reduce((n, p) => n + p.n, 0);
/** The page the `at`th hit is on, and which of that page's hits it is. */
function hitAt(pages: Find['pages'], at: number): { page: number; k: number } | null {
  let k = at;
  for (const p of pages) {
    if (k < p.n) return { page: p.page, k };
    k -= p.n;
  }
  return null;
}

const places = new Map<string, { top: number; at: { page: number; y: number } | null; x: number | null }>();
/** Each book's zoom, by its id, where it is not 1: kept as its place is, until the app closes. */
const zooms = new Map<string, number>();
/** The zoom one step in (`dir` 1) or out (-1) from `z`; 0 is fit. */
export function zoomStep(z: number, dir: number): number {
  if (dir === 0) return 1;
  const at = ZOOMS.reduce((best, v, i) => (Math.abs(v - z) < Math.abs(ZOOMS[best]! - z) ? i : best), 0);
  return ZOOMS[Math.max(0, Math.min(ZOOMS.length - 1, at + Math.sign(dir)))]!;
}

interface Rect { left: number; top: number; width: number; height: number }

// ── highlights: the CSS Custom Highlight API, one registry for every lens ──

type HighlightKind = 'ilmi-extract' | 'ilmi-hit' | 'ilmi-at';
const ranges = new Map<string, Range[]>();

/** Replace what `owner` contributes to `kind` and redraw the merged highlight. A webview without the API draws nothing. */
function setHighlight(owner: string, kind: HighlightKind, list: Range[]): void {
  ranges.set(`${owner}:${kind}`, list);
  if (typeof Highlight === 'undefined' || !CSS.highlights) return;
  const all: Range[] = [];
  for (const [k, v] of ranges) if (k.endsWith(`:${kind}`)) all.push(...v);
  if (all.length) CSS.highlights.set(kind, new Highlight(...all));
  else CSS.highlights.delete(kind);
}

/** The text nodes of a rendered text layer, in order. */
function textNodes(layer: Element): Text[] {
  const out: Text[] = [];
  const walker = document.createTreeWalker(layer, NodeFilter.SHOW_TEXT);
  for (let n = walker.nextNode(); n; n = walker.nextNode()) out.push(n as Text);
  return out;
}

function rangeOf(nodes: Text[], f: Found): Range {
  const r = document.createRange();
  r.setStart(nodes[f.start.node]!, f.start.offset);
  r.setEnd(nodes[f.end.node]!, f.end.offset);
  return r;
}

/** On a book's pages: the point at the bottom of the view, which done for today records (`Session.tsx`). */
export function pointInView(from: HTMLElement): { page: number; y: number } | undefined {
  const el = from.querySelector<HTMLElement>('.pdf-view');
  const page = Number(el?.dataset.atPage);
  const y = Number(el?.dataset.atY);
  return page >= 1 && Number.isFinite(y) ? { page, y } : undefined;
}

// ── the book: its pages, the note beside them when asked ──

interface PdfProps {
  id: string;
  /** In the active pane: keys that need no selection reach this lens. */
  active?: boolean;
  /** Inside a reading session: `[` `]` belong to the session. */
  session?: boolean;
  /** A session reading on in the book: the pages land at the read point. */
  readOn?: boolean;
  /** Told the book's last page once the file is read (the session's ⏎ reads `dismiss` past it). */
  onLast?: ((page: number) => void) | undefined;
}

/** Whether the note on the pages at `id` is open in the pane beside (a selector over the store). */
const notesBeside = (id: string) => (s: { docs: Record<string, DocInfo>; panes: Parameters<typeof besideAt>[0] }): boolean => {
  const tab = notesTabOf(id, s.docs);
  return tab !== null && besideAt(s.panes, tab) !== null;
};

export function Pdf({ id, active = true, session = false, readOn = false, onLast }: PdfProps) {
  const open = useApp(notesBeside(id));
  // a book open is its pages (milestone 70): the inspector closed until its toggle asks for it over this book
  useLayoutEffect(() => { useApp.setState({ bookInsp: false }); }, [id]);
  // ⌘\ opens the note beside the pages and closes it, ahead of the app's split (it checks `defaultPrevented`)
  useEffect(() => {
    if (!active) return;
    const onKey = (e: KeyboardEvent) => {
      if (!(e.metaKey || e.ctrlKey) || e.shiftKey || e.altKey || e.key !== '\\') return;
      e.preventDefault();
      toggleNotes(id);
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [active, id]);
  return (
    <div className="book" data-notes={open ? '1' : '0'} data-path={id}>
      <div className="book-pages"><Pages id={id} active={active} session={session} readOn={readOn} onLast={onLast} notesOpen={open} /></div>
    </div>
  );
}

/** The open collection's store, when it is one: where a page's strokes are. */
const inkStore = (): StoreFs | null => {
  const vault = currentVault();
  return vault && 'pageInk' in vault.fs ? (vault.fs as StoreFs) : null;
};

/** What is written on a page, laid over it: a picture of the whole page made from its strokes, on nothing. `rev` moves when the strokes change. */
function PageInk({ hash, page, w, h, rev, rect, live, onShown }: { hash: string; page: number; w: number; h: number; rev: number; rect: Rect; live: boolean; onShown(page: number): void }) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    const fs = inkStore();
    if (!fs) return;
    let live = true;
    let made: string | null = null;
    fs.pageInkFile(hash, page, 'picture', w, h).then((bytes) => {
      if (!live || !bytes.length) return;
      made = URL.createObjectURL(new Blob([bytes as BlobPart], { type: 'image/png' }));
      setUrl(made);
    }, console.error);
    return () => { live = false; if (made) URL.revokeObjectURL(made); };
  }, [hash, page, w, h, rev]);
  return url ? <img className="page-ink" data-page={page} data-rev={rev} data-live={live ? '1' : undefined} src={url} alt="" draggable={false} onLoad={() => onShown(page)} style={{ left: rect.left, top: rect.top, width: rect.width, height: rect.height }} /> : null;
}

/** A passage's boxes on the pages, its heading's name, its cards, its state. */
interface Drawn {
  passage: Passage;
  cards: number;
  dismissed: boolean;
}

function Pages({ id, active, session, readOn, onLast, notesOpen }: Omit<Required<PdfProps>, 'onLast'> & { onLast: PdfProps['onLast']; notesOpen: boolean }) {
  const lastRef = useRef(onLast);
  lastRef.current = onLast;
  const docs = useApp((s) => s.docs);
  const root = useApp((s) => s.vault);
  const caret = useApp((s) => s.caretHeading);
  const focus = useApp((s) => s.bookFocus);
  const mobile = useApp((s) => s.mobile);
  const phone = useApp((s) => s.phone);
  const info: DocInfo | undefined = docs[id];
  /** The note on these pages: the document itself when it has pages, the note attached to a PDF on its own, or none yet (`book.ts`). */
  const note = noteOf(id, docs);
  const loaded = useDoc(note);
  const [status, setStatus] = useState<'loading' | 'ok' | 'gone' | 'unreadable'>('loading');
  const [pdf, setPdf] = useState<PDFDocumentProxy | null>(null);
  const [sizes, setSizes] = useState<Size[]>([]);
  const [textless, setTextless] = useState(false);
  /** The room the pages have: the pane's width inside its padding, and that padding (`left` the padding before them). */
  const [room, setRoom] = useState({ w: 0, pad: 0, left: 0 });
  /** Moves when this book's zoom does (`zooms`). */
  const [, setZoomRev] = useState(0);
  const zoom = zooms.get(id) ?? 1;
  const zoomRef = useRef(zoom);
  zoomRef.current = zoom;
  /** One step in or out, or (0) back to fit. */
  const zoomBy = useCallback((dir: number) => {
    const next = zoomStep(zooms.get(id) ?? 1, dir);
    if (next === (zooms.get(id) ?? 1)) return;
    if (next === 1) zooms.delete(id); else zooms.set(id, next);
    setZoomRev((n) => n + 1);
  }, [id]);
  const [tick, setTick] = useState(0);
  const [sel, setSel] = useState<Sel | null>(null);
  const [current, setCurrent] = useState(1);
  /** The pages before the document's own (FORMAT.md §3 `pages`): a chapter of a book is its pages of the book's PDF, numbered as the book numbers them. */
  const [base, setBase] = useState(0);
  const [point, setPoint] = useState<{ pos: number; y: number } | null>(null);
  const [find, setFind] = useState<Find | null>(null);
  const [goto, setGoto] = useState(false);
  const [extracts, setExtracts] = useState<{ path: string; page: number; text: string }[]>([]);
  const [peek, setPeek] = useState<Peek | null>(null);
  /** A reference's target is being looked for: said where the search says `searching`. */
  const [looking, setLooking] = useState(false);
  const jumpSeq = useRef(0);
  /** Each drawn page's links (`pdf/links.ts`), read as the page is drawn. */
  const links = useRef(new Map<number, PageLink[]>());
  /** Each page's references (`pdf/refs.ts`), read when one is asked for. */
  const tokens = useRef(new Map<number, Promise<RefToken[]>>());
  /** The PDF's outline, read when the contents are first asked for. */
  const outline = useRef<Promise<ContentsEntry[]> | null>(null);
  /** `f`: the letters on what can be followed in view, and those typed so far. */
  const [hints, setHints] = useState<Hints | null>(null);
  /** `b`: the bookmark being named, at the place it was asked for. */
  const [naming, setNaming] = useState<{ page: number; y: number; name: string } | null>(null);
  /** ⇧M or `'` pressed: the letter that follows sets a mark or goes to one. */
  const [chord, setChord] = useState<'set' | 'go' | null>(null);
  /** The line held under the rule. */
  const [ruler, setRuler] = useState<{ page: number; line: number; band: LineBand } | null>(null);
  /** The highlight just made, and the notice that says so: 1–4 choose its ink while that notice shows. */
  const [lastHl, setLastHl] = useState<{ id: string; seq: number } | null>(null);
  /** A portal begun (⇧P), here or in another book. */
  const portalFrom = usePortalPending();
  /** The portal whose destination this pane was last moved to, when it follows. */
  const [showing, setShowing] = useState<string | null>(null);
  /** Where the last press that did not move fell: `h` there clears the highlight under it. */
  const lastPoint = useRef<{ page: number; x: number; y: number } | null>(null);
  const nameRef = useRef<HTMLInputElement>(null);
  /** The places this book's jumps left. */
  const trail = useTrail(id);
  /** Where the press now down began: a press that does not move follows a link. */
  const pressAt = useRef<{ x: number; y: number; t: number; type: string } | null>(null);
  /** The hit shown is to be brought into view once its page's text is there. */
  const wantHit = useRef(false);
  /** Boxes drawn and not yet made into anything, in the order drawn. */
  const [pending, setPending] = useState<Box[]>([]);
  const [ghost, setGhost] = useState<Rect | null>(null);
  /** The section just made: ⏎ puts the caret in it. */
  const [recent, setRecent] = useState<{ index: number; text: string } | null>(null);
  /** The section whose boxes are lit: the caret's in the notes, else the one last gone to here. */
  const [lit, setLit] = useState<string | null>(null);
  const [flash, setFlash] = useState<{ text: string; seq: number } | null>(null);
  const peekCanvas = useRef<HTMLCanvasElement>(null);
  const lines = useRef(new Map<number, ReturnType<typeof linesOf>>());
  const wrapRef = useRef<HTMLDivElement>(null);
  const outerRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<HTMLDivElement>(null);
  const pagesRef = useRef<HTMLDivElement>(null);
  const findRef = useRef<HTMLInputElement>(null);
  const gotoRef = useRef<HTMLInputElement>(null);
  const pageEls = useRef(new Map<number, HTMLDivElement>());
  const rendered = useRef(new Map<number, number>());
  const rendering = useRef(new Set<number>());
  const texts = useRef(new Map<number, string>());
  const dragRef = useRef(false);
  const st = useRef({ sel, pending, recent, find, goto, peek, looking, hints, naming, chord, ruler, lastHl });
  st.current = { sel, pending, recent, find, goto, peek, looking, hints, naming, chord, ruler, lastHl };
  const canEnrol = info?.type === 'source' || info?.type === 'extract' || info?.type === 'note';
  const reading = !!info?.read && info.type !== 'note';
  const rel = info?.pdf;

  // ── what is written on the pages: found by the file's hash and the page ──
  /** The PDF's SHA-256, once its row is known. */
  const hash = useMemo(() => {
    const vault = currentVault();
    return rel && vault && status !== 'gone' && status !== 'unreadable' ? inkStore()?.blobAt(vault.abs(rel)) ?? null : null;
  }, [rel, status]);
  /** What is left on the pages: the PDF's marks, read once and held (`book.ts`). */
  const marks = useMarks(hash);
  const marksRef = useRef(marks);
  marksRef.current = marks;
  const bookmarks = useMemo(() => bookmarksOf(marks), [marks]);
  const highlights = useMemo(() => highlightsOf(marks), [marks]);
  const portals = useMemo(() => portalsOf(marks), [marks]);
  /** The pages written on, each with a count that moves when its strokes do. */
  const [inked, setInked] = useState<Record<number, number>>({});
  useEffect(() => {
    const fs = inkStore();
    setInked({});
    if (!fs || !hash) return;
    let live = true;
    const look = (bump?: number) => fs.inkedPages(hash).then((pages) => {
      if (!live) return;
      setInked((was) => Object.fromEntries(pages.map((n) => [n, (was[n] ?? 0) + (n === bump || was[n] === undefined ? 1 : 0)])));
    }, console.error);
    void look();
    const off = fs.onPageInk((h, n) => { if (h === hash) void look(n); });
    return () => { live = false; off(); };
  }, [hash]);
  /** The pages a canvas lies over just now: their pictures stand aside. */
  const [liveInk, setLiveInk] = useState<ReadonlySet<number>>(new Set());
  const inkedRef = useRef(inked);
  inkedRef.current = inked;
  /** Waiting for a page's picture to be on the screen. */
  const shownWaits = useRef(new Map<number, () => void>());
  const pictureShown = useCallback((n: number) => { shownWaits.current.get(n)?.(); shownWaits.current.delete(n); }, []);

  // ── written on where the Pencil lands: the pages near the screen are sheets, each lying where its page lies ──
  useEffect(() => {
    const fs = inkStore();
    const sc = wrapRef.current?.closest<HTMLElement>('.book-pages, .pane-body');
    if (!hash || !fs || !sc || !hasCanvas() || status !== 'ok') return;
    const hostId = `pages:${id}`;
    const sheetOf = (n: number) => `p.${hash}.${n}`;
    const pageOfSheet = (sheet: string): number | null => (sheet.startsWith(`p.${hash}.`) ? Number(sheet.slice(hash.length + 3)) : null);
    /** What each sheet was last filled at: the count a page's strokes move by. */
    const filled = new Map<number, number>();
    const fill = (n: number) => {
      const rev = inkedRef.current[n];
      if (rev === undefined || filled.get(n) === rev) return;
      filled.set(n, rev);
      afterScene(() => void fillSheet(sheetOf(n), pagePaper(fs, hash, n), () => fs.pageInkFile(hash, n, 'drawing')).catch((e: unknown) => { filled.delete(n); console.error(e); }));
    };
    const surface: Surface = {
      host() {
        if (!sc.isConnected || !sc.getClientRects().length) return null;
        const { view, port, top, height } = portOf(sc, viewRef.current?.querySelector('.meta'));
        if (port.w <= 0 || port.h <= 0 || covered(sc, port)) return { id: hostId, view, port: { ...port, h: 0 }, top, height, open: null, sheets: [] };
        const sheets: SheetSpec[] = [];
        for (const [n, el] of pageEls.current) {
          const r = inContent(sc, el);
          if (r.y + r.h < top - AHEAD || r.y > top + view.h + AHEAD) continue;
          sheets.push({ id: sheetOf(n), frame: r, hit: r, zoom: scaleRef.current });
          fill(n);
        }
        return { id: hostId, view, port, top, height, open: null, sheets };
      },
      made(sheet) {
        const n = pageOfSheet(sheet);
        if (n === null) return;
        filled.delete(n);
        fill(n);
      },
      paper(sheet) {
        const n = pageOfSheet(sheet);
        return n === null ? null : pagePaper(fs, hash, n);
      },
      began(e: PenEvent) {
        const n = pageOfSheet(e.sheet);
        if (n === null) return;
        // the Pencil writes: whatever a finger was about here is let go, and the keys are the pages'
        (document.activeElement as HTMLElement | null)?.blur?.();
        setLiveInk((s) => new Set(s).add(n));
      },
      async kept(sheet: string, strokes: InkStroke[]) {
        const n = pageOfSheet(sheet);
        if (n === null) return;
        // not waited for: the next keep does not stand behind a picture
        void (async () => {
          if (strokes.length) await new Promise<void>((done) => { shownWaits.current.set(n, done); setTimeout(done, 3000); });
          setLiveInk((s) => { const next = new Set(s); next.delete(n); return next; });
          await new Promise((r) => setTimeout(r, 34));
          await restSheet(sheet);
        })();
      },
    };
    const off = addSurface(surface);
    const onScroll = () => sceneSoon();
    sc.addEventListener('scroll', onScroll, { passive: true });
    return () => { sc.removeEventListener('scroll', onScroll); off(); };
  }, [hash, status, id]);
  // ── the file, shared with the notes' crops ──
  const range = info?.pages;
  useEffect(() => {
    if (!rel) return;
    let live = true;
    const held = acquirePdf(rel);
    rendered.current.clear();
    texts.current.clear();
    lines.current.clear();
    links.current.clear();
    tokens.current.clear();
    outline.current = null;
    (async () => {
      const doc = await held.promise;
      if (!live) return;
      const out: Size[] = [];
      let hasText = false;
      // only the document's own pages when it names a range; a range past the file's end is cut to it
      const lo = Math.max(1, Math.min(range?.first ?? 1, doc.numPages));
      const hi = Math.max(lo, Math.min(range?.last ?? doc.numPages, doc.numPages));
      for (let n = lo; n <= hi; n++) {
        const page = await doc.getPage(n);
        const v = page.getViewport({ scale: 1 });
        out.push({ w: v.width, h: v.height });
        if (n < lo + PROBE && !hasText) hasText = (await pageBits(page)).some((b) => b.str.trim() !== '');
      }
      if (!live) return;
      lastRef.current?.(hi);
      setBase(lo - 1);
      setPdf(doc);
      setSizes(out);
      setTextless(!hasText);
      setStatus('ok');
    })().catch(async (e: unknown) => {
      console.error(id, e);
      // a file that is there and will not open is not one that has gone
      const vault = currentVault();
      const there = vault ? await vault.fs.stat(vault.abs(rel)).then((s) => s !== null, () => false) : true;
      if (live) setStatus(there ? 'unreadable' : 'gone');
    });
    return () => {
      live = false;
      held.release();
      setPdf(null);
      setSizes([]);
      setStatus('loading');
    };
  }, [id, rel, range?.first, range?.last]);

  // the pane's width sets the scale (milestone 70): a page is drawn across it, up to the width a page is still
  // read at, and centred past that; the read bar and the gutter's § hang in the pane's padding
  useLayoutEffect(() => {
    const el = outerRef.current;
    if (!el) return;
    const measure = () => {
      const cs = getComputedStyle(el);
      const pad = parseFloat(cs.paddingRight) || 0;
      const left = parseFloat(cs.paddingLeft) || 0;
      const w = el.clientWidth - left - pad;
      setRoom((r) => (r.w === w && r.pad === pad && r.left === left ? r : { w, pad, left }));
    };
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    measure();
    return () => ro.disconnect();
  }, [status]);

  const colW = room.w;
  const maxW = sizes.reduce((m, s) => Math.max(m, s.w), 0) || 612;
  /** The width a page is fitted to; the zoom is of this, so it is of the pane as it is (a note beside narrows it). */
  const fitW = Math.max(120, Math.min(PAGE_MAX, colW));
  const pageW = fitW * zoom;
  /** Zoomed past the pane: the pages scroll sideways, the words over them stay. */
  const wide = colW > 0 && pageW > colW;
  /** The sections' names sit beside the page only where a centred page leaves them the room. */
  const roomy = (colW - pageW) / 2 + room.pad >= TAG_ROOM;
  const scale = colW > 0 ? pageW / maxW : 1;
  /** Each page's top, px from the top of the column, and the column's height. */
  const tops = useMemo(() => {
    const out: number[] = [0];
    let y = 0;
    sizes.forEach((s, i) => { out[i + 1] = y; y += s.h * scale + (i < sizes.length - 1 ? GAP : 0); });
    return { at: out, total: y };
  }, [sizes, scale]);

  const first = base + 1;
  const last = base + sizes.length;
  /** A page's place in the column, px; null for a page not shown. */
  const pageRect = useCallback((n: number): Rect | null => {
    const s = sizes[n - base - 1];
    if (!s) return null;
    return { left: 0, top: tops.at[n - base] ?? 0, width: s.w * scale, height: s.h * scale };
  }, [sizes, base, tops, scale]);
  const boxRect = useCallback((b: Box): Rect | null => {
    const p = pageRect(b.page);
    return p && { left: p.left + b.x * p.width, top: p.top + b.y * p.height, width: b.w * p.width, height: b.h * p.height };
  }, [pageRect]);

  // a new scale, or strokes come by a merge: the canvases are told
  useEffect(() => { sceneSoon(); }, [scale, sizes, inked, room]);

  // ── rendering, as pages come near ──
  const scaleRef = useRef(scale);
  scaleRef.current = scale;
  /** The scale the pages have at fit. */
  const fit = scale / zoom;
  const renderRef = useRef<(n: number) => Promise<void>>(async () => {});
  const renderPage = useCallback(async (n: number) => {
    const el = pageEls.current.get(n);
    if (!el || !pdf || rendered.current.get(n) === scale || rendering.current.has(n)) return;
    rendering.current.add(n);
    try {
      const page = await pdf.getPage(n);
      const viewport = page.getViewport({ scale });
      // zoomed far in, a page is drawn with fewer pixels to the point than the screen has, never with more than a canvas holds
      const dpr = Math.min(window.devicePixelRatio || 1, Math.max(0.5, Math.sqrt(CANVAS_MAX / Math.max(1, viewport.width * viewport.height))));
      const canvas = document.createElement('canvas');
      canvas.width = Math.floor(viewport.width * dpr);
      canvas.height = Math.floor(viewport.height * dpr);
      canvas.style.width = `${viewport.width}px`;
      canvas.style.height = `${viewport.height}px`;
      // the print intent draws without animation frames, which WebKit holds back in a covered window
      await page.render(dpr === 1 ? { canvas, viewport, intent: 'print' } : { canvas, viewport, intent: 'print', transform: [dpr, 0, 0, dpr, 0, 0] }).promise;
      const layer = document.createElement('div');
      layer.className = 'textLayer';
      el.style.setProperty('--total-scale-factor', String(scale));
      const tl = new TextLayer({ textContentSource: page.streamTextContent(), container: layer, viewport });
      el.replaceChildren(canvas, layer);
      await tl.render();
      // the page's own links, read once, as it is drawn (never for the whole book)
      if (!links.current.has(n)) {
        try {
          const v1 = page.getViewport({ scale: 1 });
          // pdf.js turns a point of the page into one of the view (it knows a turned page); a rectangle is its two corners
          const toView = typeof v1.convertToViewportPoint === 'function'
            ? (r: number[]) => [...v1.convertToViewportPoint(r[0]!, r[1]!), ...v1.convertToViewportPoint(r[2]!, r[3]!)] as number[]
            : flipRect([0, 0, v1.width, v1.height]);
          links.current.set(n, pageLinks(await page.getAnnotations(), toView, v1.width, v1.height));
        } catch {
          links.current.set(n, []);
        }
      }
      const end = document.createElement('div');
      end.className = 'endOfContent';
      layer.append(end);
      rendered.current.set(n, scale);
      setTick((t) => t + 1);
    } catch (e) {
      console.error(id, `page ${n}`, e);
    } finally {
      rendering.current.delete(n);
    }
    // the column changed width while this page was being drawn (an iPad turned): it is drawn again at the scale there is now
    if (scaleRef.current !== scale && rendered.current.get(n) === scale) {
      rendered.current.delete(n);
      el.replaceChildren();
      void renderRef.current(n);
    }
  }, [pdf, scale, id]);
  renderRef.current = renderPage;

  const scroller = () => wrapRef.current?.closest<HTMLElement>('.book-pages, .pane-body') ?? null;
  /** After a scroll: the pane beside is told the portal read past (set below, once the marks are known). */
  const afterScroll = useRef<() => void>(() => {});
  const place = useRef<{ page: number; y: number } | null>(null);
  /** What of the pages' width is at the middle of the view, 0 to 1 across them: kept across a change of scale. */
  const placeX = useRef<number | null>(null);
  /** The pages' column moved so `x` of its width is at the middle of the view (as far as the scroll goes). */
  const centreOn = (sc: HTMLElement, x: number) => {
    const pr = pagesRef.current?.getBoundingClientRect();
    const sr = sc.getBoundingClientRect();
    if (pr && pr.width > 0) sc.scrollLeft += pr.left + x * pr.width - (sr.left + sr.width / 2);
  };
  /** The pages have landed where they open (the place left, the read point, a section gone to): from here a scroll is the reader's, and remembered. */
  const landed = useRef(false);

  useEffect(() => {
    if (!pdf || !sizes.length) return;
    // a new scale: every page draws again as it comes near
    for (const [n, s] of rendered.current) if (s !== scale) { rendered.current.delete(n); pageEls.current.get(n)?.replaceChildren(); }
    const io = new IntersectionObserver((entries) => {
      for (const e of entries) if (e.isIntersecting) void renderPage(Number((e.target as HTMLElement).dataset.page));
    }, { root: scroller(), rootMargin: `${AHEAD}px 0px` });
    for (const el of pageEls.current.values()) io.observe(el);
    return () => io.disconnect();
  }, [pdf, sizes, scale, renderPage]);

  // the page in view (for the keys that step pages), and the point at the bottom of the view (done for today)
  useEffect(() => {
    const sc = scroller();
    if (!sc || !pagesRef.current) return;
    const onScroll = () => {
      const r = sc.getBoundingClientRect();
      const top = r.top + 70;
      const bottom = r.bottom - 8;
      let n = base + 1;
      let at: { page: number; y: number } | null = null;
      for (const [k, el] of pageEls.current) {
        const pr = el.getBoundingClientRect();
        // a page not laid out (its tab hidden) is not the one in view
        if (pr.height > 0 && pr.top <= top) n = Math.max(n, k);
        if (pr.top <= bottom && (!at || k > at.page)) at = { page: k, y: Math.min(1, Math.max(0, (bottom - pr.top) / pr.height)) };
      }
      setCurrent(n);
      // the place at the top of the view, for when the pages are drawn at another scale
      const from = r.top + PLACE_AT;
      place.current = null;
      for (const [k, el] of pageEls.current) {
        const pr = el.getBoundingClientRect();
        if (pr.top <= from && pr.bottom > from) place.current = { page: k, y: (from - pr.top) / pr.height };
      }
      const cr = pagesRef.current?.getBoundingClientRect();
      placeX.current = cr && cr.width > 0 ? (r.left + r.width / 2 - cr.left) / cr.width : null;
      if (landed.current) places.set(id, { top: sc.scrollTop, at: place.current, x: placeX.current });
      // the pages near the view drawn here too: a covered window may hold the observer's callbacks back
      for (const [k, el] of pageEls.current) {
        const pr = el.getBoundingClientRect();
        if (pr.bottom >= r.top - AHEAD && pr.top <= r.bottom + AHEAD) void renderPage(k);
        // zoomed, a page is many times the canvas it is at fit: one far from the view gives it back, and draws again as it comes near
        else if (zoomRef.current > 1 && pr.height > 0 && (pr.bottom < r.top - FAR || pr.top > r.bottom + FAR) && rendered.current.has(k) && !rendering.current.has(k)) {
          rendered.current.delete(k);
          el.replaceChildren();
        }
      }
      const v = viewRef.current;
      if (v && at) { v.dataset.atPage = String(at.page); v.dataset.atY = at.y.toFixed(3); }
      // the place under the top of the view, as the trail keeps it
      if (v && place.current) { v.dataset.topPage = String(place.current.page); v.dataset.topY = place.current.y.toFixed(4); }
      // above the first page (the title over it): the place is that page's top
      else if (v) { v.dataset.topPage = String(base + 1); v.dataset.topY = '0.0000'; }
      afterScroll.current();
    };
    onScroll();
    sc.addEventListener('scroll', onScroll, { passive: true });
    return () => sc.removeEventListener('scroll', onScroll);
  }, [status, sizes, base, scale, renderPage, id]);

  // a new scale (a zoom, the note opened beside, an iPad turned) leaves the same text at the top of the view, not the
  // same pixels, and what was at the middle of the view across the pages at the middle
  useLayoutEffect(() => {
    const sc = scroller();
    if (!sc) return;
    const at = place.current;
    const el = at ? pageEls.current.get(at.page) : undefined;
    if (at && el) {
      const pr = el.getBoundingClientRect();
      sc.scrollTop += pr.top + at.y * pr.height - (sc.getBoundingClientRect().top + PLACE_AT);
    }
    if (placeX.current !== null) centreOn(sc, placeX.current);
  }, [scale]);

  // a pinch on a trackpad (WebKit sends it as a wheel with ctrl held) steps the zoom once a gesture
  useEffect(() => {
    const sc = scroller();
    if (!sc) return;
    let last = -Infinity;
    const onWheel = (e: WheelEvent) => {
      if (!e.ctrlKey) return;
      e.preventDefault();
      const fresh = e.timeStamp - last > PINCH_GAP;
      // a gesture's first event that says which way is the step; the rest of it only keeps the gesture alive
      if (!fresh || e.deltaY !== 0) last = e.timeStamp;
      if (fresh && e.deltaY !== 0) zoomBy(e.deltaY < 0 ? 1 : -1);
    };
    sc.addEventListener('wheel', onWheel, { passive: false });
    return () => sc.removeEventListener('wheel', onWheel);
  }, [status, zoomBy]);

  const scrollTo = (n: number) => {
    const el = pageEls.current.get(Math.max(first, Math.min(last, n)));
    const sc = scroller();
    const x = sc?.scrollLeft;
    el?.scrollIntoView({ block: 'start' });
    // a page wider than the view is not moved sideways for it
    if (sc && x !== undefined && sc.scrollLeft !== x) sc.scrollLeft = x;
  };

  // ── back and forth: the places the jumps left (milestone 76) ──
  /** The place in view: the page under the top of the view and how far down it, and across the pages when they are zoomed. */
  const here = (): Place => {
    let at = place.current;
    const sc = scroller();
    if (!at && sc) {
      // no page under the top of the view (the title over the first page, the room between two): the place is the next page's, a little above it
      const from = sc.getBoundingClientRect().top + PLACE_AT;
      for (const [k, el] of [...pageEls.current].sort((a, b) => a[0] - b[0])) {
        const pr = el.getBoundingClientRect();
        if (pr.height > 0 && pr.bottom > from) { at = { page: k, y: (from - pr.top) / pr.height }; break; }
      }
    }
    return { page: at?.page ?? current, y: at?.y ?? 0, x: zoomRef.current > 1 ? placeX.current : null };
  };
  /** The pages moved so a place is under the top of the view, `room` px left over it. */
  const goPlace = (p: { page: number; y: number; x?: number | null }, room = 0) => {
    const sc = scroller();
    const n = Math.max(first, Math.min(last, p.page));
    const el = pageEls.current.get(n);
    if (!sc || !el) return;
    const pr = el.getBoundingClientRect();
    landed.current = true;
    sc.scrollTop += pr.top + p.y * pr.height - (sc.getBoundingClientRect().top + PLACE_AT + room);
    if (p.x !== null && p.x !== undefined) centreOn(sc, p.x);
    // where the view is now, before its scroll says so: a ⌫ straight after goes from here
    place.current = { page: n, y: pr.height > 0 ? p.y - room / pr.height : p.y };
    if (p.x !== null && p.x !== undefined) placeX.current = p.x;
  };
  /** A jump is about to be made from here: here is where ⌫ comes back to. */
  const leave = () => setTrail(id, pushPlace(trailOf(id), here()));
  /** A jump: here goes on the trail, the pages go to the place. */
  const jump = (to: { page: number; y: number }) => { leave(); goPlace(to, JUMP_ROOM); };
  /** A jump to a place that may lie outside these pages (a chapter cut from a book): said, not made. */
  const goTo = (to: { page: number; y: number }) => {
    if (to.page < first || to.page > last) { notify(`p. ${to.page} is not among these pages`); return; }
    jump(to);
  };
  const goBack = (): boolean => {
    const r = stepBack(trailOf(id), here());
    if (!r) return false;
    setTrail(id, r.trail);
    goPlace(r.to);
    return true;
  };
  const goForward = (): boolean => {
    const r = stepForward(trailOf(id), here());
    if (!r) return false;
    setTrail(id, r.trail);
    goPlace(r.to);
    return true;
  };

  // ── what the notes say about the pages: the passages, in book order ──
  const doc: Doc | undefined = loaded?.doc;
  const drawn = useMemo((): Drawn[] => (doc ? passagesOf(doc.blocks).map((p) => ({ passage: p, cards: sectionState(doc.blocks, p.index).cards, dismissed: sectionDismissed(p.heading.read!) })) : []), [doc]);
  const drawnRef = useRef(drawn);
  drawnRef.current = drawn;

  /** Scroll the pages to a passage's first box, unless it is in view; `always` scrolls regardless. */
  const scrollToPassage = useCallback((text: string, always = false) => {
    const d = drawnRef.current.find((x) => x.passage.heading.text === text);
    const sc = scroller();
    const b = d?.passage.boxes[0];
    const el = b ? pageEls.current.get(b.page) : undefined;
    if (!sc || !b || !el) return;
    const sr = sc.getBoundingClientRect();
    const pr = el.getBoundingClientRect();
    const top = pr.top + b.y * pr.height;
    landed.current = true;
    if (!always && top >= sr.top + 30 && top <= sr.bottom - 120) return;
    sc.scrollTo({ top: Math.max(0, sc.scrollTop + top - sr.top - 60) });
  }, []);

  // the caret's section in the note lights its boxes, and the pages scroll to them; only a caret someone put there:
  // a note just opened beside the pages has one at its top, and the reader's place is not to move for it (milestone 70)
  useEffect(() => {
    if (note === null || caret?.path !== note || !document.activeElement?.closest('.draft-doc')) return;
    const text = drawnRef.current.some((d) => d.passage.heading.text === caret.text) ? caret.text : null;
    setLit(text);
    if (text) scrollToPassage(text);
  }, [caret?.path, caret?.text, caret?.nth, note, status, sizes.length, scrollToPassage]);
  // what goes to a section of the note goes to its boxes too, once the pages are there: a session's come after the note has landed
  const going = useRef<string | null>(null);
  const reveal = useApp((s) => s.reveal);
  useEffect(() => {
    if (note !== null && reveal?.path === note && reveal.heading !== undefined) going.current = reveal.heading;
    const text = going.current;
    if (text === null || status !== 'ok' || !sizes.length || !drawn.some((d) => d.passage.heading.text === text)) return;
    going.current = null;
    setLit(text);
    scrollToPassage(text);
  }, [reveal, note, status, sizes.length, drawn, scrollToPassage]);
  // the pages land once where they open. Reading on in a session: at the read point, the bar's end a third of the
  // way down the view. A tab shown again (the pane draws only the tab in front): where it was left, the same text
  // at the top of the view. A book opened for the first time: at its read point, when it has one.
  const landedAt = useRef<string | null>(null);
  useEffect(() => { landed.current = false; }, [id]);
  useEffect(() => {
    if (status !== 'ok' || !sizes.length || landedAt.current === id) return;
    const sc = scroller();
    if (!sc) return;
    landedAt.current = id;
    const was = readOn || landed.current ? undefined : places.get(id);
    // a section gone to as the pages opened is where they are
    const went = landed.current && !readOn;
    landed.current = true;
    if (went) return;
    if (was) {
      const pr = was.at ? pageEls.current.get(was.at.page)?.getBoundingClientRect() : undefined;
      // a page laid out: the same text under the words over the pages, whatever the scale is now; else the scroll as it was
      if (was.at && pr && pr.height > 0) sc.scrollTop += pr.top + was.at.y * pr.height - (sc.getBoundingClientRect().top + PLACE_AT);
      else sc.scrollTop = was.top;
      // zoomed past the pane: across the pages where it was left too
      if (was.x !== null) centreOn(sc, was.x);
      return;
    }
    const rp = info?.read?.pos !== undefined ? { pos: info.read.pos, y: info.read.y ?? 1 } : null;
    const r = rp && rp.pos >= first && rp.pos <= last ? pageRect(rp.pos) : null;
    if (!rp || !r) return;
    sc.scrollTop = Math.max(0, r.top + rp.y * r.height - sc.clientHeight / 3);
  }, [readOn, status, sizes.length, id, first, last, info?.read?.pos, info?.read?.y, pageRect]);
  // show in book: scrolled to and flashed
  useEffect(() => {
    if (!focus || focus.path !== id) return;
    setLit(focus.text);
    setFlash({ text: focus.text, seq: focus.seq });
    scrollToPassage(focus.text, true);
    const t = setTimeout(() => setFlash((f) => (f?.seq === focus.seq ? null : f)), 2200);
    return () => clearTimeout(t);
  }, [focus, id, scrollToPassage]);
  /** Go to a passage's section in the note (opened beside the pages, if it is not): the caret at its heading. */
  const goToSection = (p: Passage) => {
    if (note === null) return;
    setLit(p.heading.text);
    useApp.setState({ reveal: { path: note, index: p.index, heading: p.heading.text } });
    void openNotes(id).catch(console.error);
  };

  // older work: extracts carved from a page (milestone 15) keep their highlights
  const childPaths = useMemo(() => {
    const dir = `${childDirOf(id)}/`;
    return Object.keys(docs).filter((p) => p.startsWith(dir) && docs[p]?.type === 'extract' && docs[p]?.read?.page !== undefined).sort();
  }, [docs, id]);
  const childKey = childPaths.map((p) => `${p}@${docs[p]?.read?.page}`).join('|');
  useEffect(() => {
    const vault = currentVault();
    if (!vault) return;
    let live = true;
    Promise.all(childPaths.map(async (path) => {
      const page = useApp.getState().docs[path]?.read?.page ?? 0;
      const text = (await vault.read(path)).doc.blocks.filter((b) => b.kind !== 'card').map((b) => b.text).join('\n\n');
      return { path, page, text };
    })).then((list) => { if (live) setExtracts(list); }, console.error);
    return () => { live = false; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [childKey]);

  // ── highlights: the extracts' text found again, and the search's hits ──
  useEffect(() => {
    const own: Range[] = [];
    const hits: Range[] = [];
    const cur = find?.q && find.pages.length ? hitAt(find.pages, find.at) : null;
    let now: Range | null = null;
    for (const [n] of rendered.current) {
      const layer = pageEls.current.get(n)?.querySelector('.textLayer');
      if (!layer) continue;
      const nodes = textNodes(layer);
      const strs = nodes.map((t) => t.data);
      for (const e of extracts) {
        if (e.page !== n) continue;
        const f = findText(strs, e.text);
        if (f) own.push(rangeOf(nodes, f));
      }
      if (!find?.q) continue;
      const found = findAll(strs, find.q, true);
      // the hit shown is lit apart from the rest; a text layer that reads fewer than the count shows its last
      const k = cur?.page === n ? Math.min(cur.k, found.length - 1) : -1;
      found.forEach((f, i) => { if (i === k) now = rangeOf(nodes, f); else hits.push(rangeOf(nodes, f)); });
    }
    setHighlight(id, 'ilmi-extract', own);
    setHighlight(id, 'ilmi-hit', hits);
    setHighlight(id, 'ilmi-at', now ? [now] : []);
    // the hit itself into view, a third of the way down, once its page's text is there; one in plain sight stays put
    const sc = scroller();
    const at = now as Range | null;
    if (!wantHit.current || !at || !sc) return;
    wantHit.current = false;
    if (typeof at.getBoundingClientRect !== 'function') return;
    const r = at.getBoundingClientRect();
    const sr = sc.getBoundingClientRect();
    landed.current = true;
    if (r.top >= sr.top + HIT_EDGE && r.bottom <= sr.bottom - HIT_EDGE) return;
    sc.scrollTo({ top: Math.max(0, sc.scrollTop + r.top - sr.top - sr.height / 3) });
  }, [tick, extracts, find?.q, find?.pages, find?.at, find?.go, id]);
  useEffect(() => () => { for (const k of ['ilmi-extract', 'ilmi-hit', 'ilmi-at'] as const) setHighlight(id, k, []); }, [id]);

  // ── the selection, read from the DOM: a text selection on a page boxes its lines ──
  useEffect(() => {
    const capture = () => {
      let next: Sel | null = null;
      const s = window.getSelection();
      const pages = pagesRef.current;
      if (s && pages && s.rangeCount > 0 && !s.isCollapsed) {
        const range = s.getRangeAt(0);
        const start = range.startContainer instanceof Element ? range.startContainer : range.startContainer.parentElement;
        const pageEl = start?.closest<HTMLElement>('.pdf-page');
        if (pageEl && pages.contains(pageEl)) {
          const text = s.toString().replace(/\s+/g, ' ').trim();
          if (text) {
            // each line's rectangle on the page it is on, one box per page around them
            const byPage = new Map<number, { x: number; y: number; w: number; h: number }[]>();
            for (const r of Array.from(range.getClientRects())) {
              if (r.width <= 0 || r.height <= 0) continue;
              for (const [n, el] of pageEls.current) {
                const pr = el.getBoundingClientRect();
                const cy = r.top + r.height / 2;
                if (cy < pr.top || cy > pr.bottom) continue;
                byPage.set(n, [...(byPage.get(n) ?? []), { x: (r.left - pr.left) / pr.width, y: (r.top - pr.top) / pr.height, w: r.width / pr.width, h: r.height / pr.height }]);
              }
            }
            const boxes = [...byPage].sort((a, b) => a[0] - b[0]).map(([n, rs]) => boxAround(n, rs)).filter((b): b is Box => b !== null);
            const quads = [...byPage].sort((a, b) => a[0] - b[0]).flatMap(([n, rs]) => lineQuads(n, rs));
            next = { text, page: Number(pageEl.dataset.page), rect: range.getBoundingClientRect(), line: range.startContainer.parentElement?.textContent ?? '', boxes, quads };
          }
        }
      }
      setSel((cur) => (cur === next || (cur && next && cur.text === next.text && cur.page === next.page && cur.rect.top === next.rect.top) ? cur : next));
    };
    document.addEventListener('selectionchange', capture);
    return () => document.removeEventListener('selectionchange', capture);
  }, []);

  // the selection as plugins see it: the text-layer line gives the context
  const plugSel = useMemo((): PluginSelection | null => (sel ? toPluginSelection({ path: id, text: sel.text, rect: sel.rect, block: null, blockText: sel.line, page: sel.page }) : null), [sel, id]);
  useEffect(() => {
    publishSelection(plugSel);
    return () => publishSelection(null);
  }, [plugSel]);
  useEffect(() => onPluginAction(() => setSel(null)), []);

  /** What `e` and `m` act on: the boxes drawn, then a text selection's. */
  const boxesNow = (): Box[] => [...st.current.pending, ...(st.current.sel?.boxes ?? [])];
  const clearBoxes = () => {
    setPending([]);
    setSel(null);
    window.getSelection()?.removeAllRanges();
  };

  /** The passage's name from its pages: the heading above it and the equations in it (`pdf/name.ts`). */
  const nameOf = async (boxes: Box[]): Promise<{ name: string; named: boolean }> => {
    if (!pdf || !rel) return { name: `p. ${boxes[0]!.page}`, named: false };
    const lo = Math.max(first, boxes[0]!.page - NAME_BACK);
    const hi = Math.max(...boxes.map((b) => b.page));
    const items = new Map<number, PageItem[]>();
    for (let n = lo; n <= hi; n++) items.set(n, await itemsOf(rel, pdf, n));
    return sectionName((n) => items.get(n), lo, boxes);
  };

  /**
   * `e`: the boxes become a section of the note, in book order (a PDF with
   * no note yet asks for one first), the read point moves past them, and
   * the note opens beside the pages with the section in it. `write`: the
   * caret goes in it.
   */
  const makeSection = async (write: boolean, known?: { name: string }, from?: Box[]) => {
    const boxes = from ?? boxesNow();
    if (!boxes.length) return;
    const to = await ensureNote(id);
    if (to === null) return;
    clearBoxes();
    const { name } = known ?? await nameOf(boxes);
    let made: { index: number; text: string; ivl: number } | null = null;
    const end = boxesEnd(boxes);
    /** The read point moves past the last box; on a document with pages in the same write as its section. */
    const point = (d: Doc) => {
      const r = meta(d).read;
      if (r && end && meta(d).type !== 'note') {
        const { pos: _p, y: _y, ...rest } = r;
        setField(d, 'read', { ...rest, ...pointOn(r, end.page, end.y) });
      }
    };
    await writeDoc(to, (d) => {
      made = addPassage(d, name, boxes, appNow());
      if (to === id) point(d);
    });
    if (to !== id) await writeDoc(id, point);
    const m = made as { index: number; text: string; ivl: number } | null;
    if (!m) return;
    const text = m.text;
    logReading(to, 'section', { sec: text });
    setLit(text);
    setRecent(write ? null : m);
    notify(`§ ${plainMath(text)} · back in ${m.ivl}d, until dismissed${write ? '' : ' · ⏎ to write in it'}`, null, async () => {
      unlogReading(to, text);
      await writeDoc(to, (d) => {
        const at = d.blocks.findIndex((b) => b.kind === 'heading' && b.text === text && b.read?.boxes !== undefined);
        if (at >= 0) d.blocks.splice(at, 1);
      });
    });
    // the note opens beside the pages with the section in it; `write` puts the caret in it
    useApp.setState({ reveal: write ? { path: to, index: m.index, heading: text, write: true } : { path: to, index: m.index, heading: text } });
    await openNotes(id);
  };

  /** `m`: on a page that names its sections, the section with the caret in it; otherwise each box clipped under its page in the note, the caret below. */
  const cardOrClip = async (from?: Box[]) => {
    const boxes = from ?? boxesNow();
    if (!boxes.length) return;
    const named = await nameOf(boxes);
    if (named.named) { await makeSection(true, named, from); return; }
    const to = await ensureNote(id);
    if (to === null) return;
    clearBoxes();
    let at = -1;
    await writeDoc(to, (d) => {
      for (const b of boxes) at = addToPage(d, b.page, { kind: 'raw', text: formatClip(b) });
    });
    if (at < 0) return;
    notify(`clipped · ${boxes.length === 1 ? `p. ${boxes[0]!.page}` : `${boxes.length} boxes`} · the card goes below it: word ::: meaning`);
    useApp.setState({ reveal: { path: to, index: at, write: true } });
    await openNotes(id);
  };

  const startReading = () => { if (canEnrol && !info?.read) enrolReading(id).catch(console.error); };

  // ── drawing a box: a drag on a page, by pointer events (milestone 57) ──
  // A mouse's drag draws at once; a finger's plain drag is the scroll, so a
  // finger draws after a short hold (`touch.ts`). A double click or ⌥-drag
  // selects text instead. A tap under a finger clears the boxes drawn, as
  // esc does. The Pencil boxes nothing where it can write (milestones 67, 69).
  const boxing = useRef<{ armed: boolean; abort(): void } | null>(null);
  /** A box is starting: the keys that follow (`e`, `m`) are the pages', not the notes' to type. */
  const settle = () => {
    (document.activeElement as HTMLElement | null)?.blur?.();
    window.getSelection()?.removeAllRanges();
    setRecent(null);
  };
  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    // where the press began, for the click after it: one that did not move follows a link (`onPress`)
    pressAt.current = e.button === 0 ? { x: e.clientX, y: e.clientY, t: e.timeStamp, type: e.pointerType } : null;
    boxing.current?.abort();
    if (e.button !== 0 || e.altKey || e.metaKey || e.ctrlKey) return;
    // a second finger down: two fingers are the system's, not a box
    if (e.pointerType === 'touch' && !e.isPrimary) return;
    const t = e.target as HTMLElement;
    if (t.closest('[data-hit]')) return;
    const pageEl = t.closest<HTMLElement>('.pdf-page');
    const col = pagesRef.current;
    if (!pageEl || !col) return;
    const glass = onGlass(e.pointerType);
    const id = e.pointerId;
    const page = Number(pageEl.dataset.page);
    const begins = pagePress(e.pointerType, hasCanvas() && hash !== null);
    // the Pencil writes, and that is the canvas's: nothing is boxed
    if (begins === 'write') return;
    const x0 = e.clientX;
    const y0 = e.clientY;
    let moved = false;
    const timer = begins === 'hold' ? setTimeout(() => {
      state.armed = true;
      settle();
      // the hold is up: a mark where the box will start
      const c = col.getBoundingClientRect();
      setGhost({ left: x0 - c.left, top: y0 - c.top, width: 0, height: 0 });
    }, HOLD_MS) : null;
    const end = () => {
      if (timer) clearTimeout(timer);
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', cancel);
      if (boxing.current === state) boxing.current = null;
      setGhost(null);
    };
    const state = { armed: false, abort: end };
    const move = (ev: PointerEvent) => {
      if (ev.pointerId !== id) return;
      if (!state.armed) {
        // a finger that moves before its hold is up is scrolling
        if (Math.hypot(ev.clientX - x0, ev.clientY - y0) > SLOP) end();
        return;
      }
      moved = true;
      const c = col.getBoundingClientRect();
      setGhost({ left: Math.min(x0, ev.clientX) - c.left, top: Math.min(y0, ev.clientY) - c.top, width: Math.abs(ev.clientX - x0), height: Math.abs(ev.clientY - y0) });
    };
    const up = (ev: PointerEvent) => {
      if (ev.pointerId !== id) return;
      const was = state.armed;
      end();
      const small = Math.abs(ev.clientX - x0) < 8 || Math.abs(ev.clientY - y0) < 6;
      if (!was || small) {
        // a tap: the boxes drawn and not yet made into anything are let go
        if (glass && !moved && Math.hypot(ev.clientX - x0, ev.clientY - y0) <= SLOP && st.current.pending.length) setPending([]);
        return;
      }
      const pr = pageEl.getBoundingClientRect();
      const clamp = (n: number) => Math.min(1, Math.max(0, n));
      const x = clamp((Math.min(x0, ev.clientX) - pr.left) / pr.width);
      const y = clamp((Math.min(y0, ev.clientY) - pr.top) / pr.height);
      const r = clamp((Math.max(x0, ev.clientX) - pr.left) / pr.width);
      const b = clamp((Math.max(y0, ev.clientY) - pr.top) / pr.height);
      if (r - x <= 0.005 || b - y <= 0.003) return;
      setPending((p) => [...p, { page, x, y, w: r - x, h: b - y }]);
    };
    const cancel = (ev: PointerEvent) => { if (ev.pointerId === id) end(); };
    boxing.current = state;
    if (!timer) {
      state.armed = true;
      // a mouse's press settles at its mouse event, once it is known not to be a double click
      if (e.pointerType !== 'mouse') settle();
    }
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', cancel);
  };
  // the press's own default, a selection begun, is the mouse event's to stop; a double click is left to select its word
  const onMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    const b = boxing.current;
    if (!b) return;
    if (e.detail > 1) { b.abort(); return; }
    e.preventDefault();
    settle();
  };
  // a box being drawn under a finger holds the page still: the scroll is the touch's default
  useEffect(() => {
    const col = pagesRef.current;
    if (!col) return;
    const hold = (e: TouchEvent) => { if (boxing.current?.armed && e.cancelable) e.preventDefault(); };
    col.addEventListener('touchmove', hold, { passive: false });
    return () => col.removeEventListener('touchmove', hold);
  }, [status]);
  useEffect(() => () => boxing.current?.abort(), []);

  // ── search and go to page ──
  const runFind = async (q: string, step = 0) => {
    const cur = st.current.find;
    if (cur && cur.q === q && cur.pages.length) {
      const total = hitCount(cur.pages);
      const at = (cur.at + step + total) % total;
      setFind({ ...cur, at, go: (cur.go ?? 0) + 1 });
      goHit(cur.pages, at);
      return;
    }
    if (!pdf || !q.trim()) { setFind(q ? { q, pages: [], at: 0 } : null); return; }
    setFind((f) => (f && f.q === q ? { ...f, did: 'searching' } : f));
    const pages: Find['pages'] = [];
    for (let n = first; n <= last; n++) {
      let text = texts.current.get(n);
      if (text === undefined) {
        text = (await pageBits(await pdf.getPage(n))).map((b) => b.str).join(' ');
        texts.current.set(n, text);
      }
      const k = countIn(text, q);
      if (k) pages.push({ page: n, n: k });
    }
    // the first hit on the page in view or after it, else the book's first
    const from = pages.findIndex((p) => p.page >= current);
    const at = from < 0 ? 0 : hitCount(pages.slice(0, from));
    // what was typed, or the bar closed, while the pages were read stands: this answer is to an older question
    if (st.current.find?.q !== q) return;
    setFind({ q, pages, at, did: 'done', go: 0 });
    // a search's first hit is a jump, with the way back; the steps through its hits are not
    if (pages.length) leave();
    goHit(pages, at);
  };
  /** Bring a hit into view: its page if that is not drawn yet (the highlights' effect goes on to the hit once it is). */
  const goHit = (pages: Find['pages'], at: number) => {
    const hit = hitAt(pages, at);
    if (!hit) return;
    wantHit.current = true;
    if (rendered.current.get(hit.page) !== scale) scrollTo(hit.page);
  };

  // ── smart jump: ⏎ on a selected reference peeks at its target ──
  const pageLines = async (n: number) => {
    let l = lines.current.get(n);
    if (!l && pdf) {
      l = linesOf(await pageBits(await pdf.getPage(n)));
      lines.current.set(n, l);
    }
    return l ?? [];
  };
  /** A page's height in PDF units: one of the book's own from its size, another of the file's (a chapter's link out of it) from the file. */
  const heightOf = async (n: number): Promise<number> => sizes[n - base - 1]?.h ?? (pdf ? (await pdf.getPage(n)).getViewport({ scale: 1 }).height : 0);
  /** Where the reference `text`, read on `page`, points: its line, and the place a jump to it goes. Null when it names nothing found, or a later question took its place. */
  const seekRef = async (text: string, page: number): Promise<{ page: number; y: number; height: number; text: string; at: { page: number; y: number } } | null> => {
    const ref = refOf(text);
    if (!ref || !pdf) return null;
    // outward from the page the reference is on, no further than its target; a later ⏎ or esc leaves this one unanswered
    const mine = ++jumpSeq.current;
    setLooking(true);
    try {
      const hit = await seekTarget(pdf.numPages, async (n) => (await pageLines(n)).map((l) => l.text), ref, page, () => jumpSeq.current === mine);
      if (jumpSeq.current !== mine || !hit) return null;
      const line = (await pageLines(hit.page))[hit.line];
      const height = await heightOf(hit.page);
      if (!line || jumpSeq.current !== mine) return null;
      return { page: hit.page, y: line.y, height: line.height, text: line.text, at: { page: hit.page, y: downPage(line.y + line.height, height) } };
    } finally {
      if (jumpSeq.current === mine) setLooking(false);
    }
  };
  /** The peek at what a reference points to, hung under `rect`. `say`: one that points nowhere is said (a press, a hint); a selection's ⏎ is quiet. */
  const peekRef = async (text: string, page: number, rect: Peek['rect'], say = false) => {
    const mine = jumpSeq.current + 1;
    const hit = await seekRef(text, page);
    if (jumpSeq.current !== mine) return;
    if (!hit) { setPeek(null); if (say) notify(`nothing found for ${text}`); return; }
    setPeek({ page: hit.page, y: hit.y, height: hit.height, text: hit.text, rect, at: hit.at });
  };
  /** Straight to what a reference points to: a jump. */
  const followRef = async (text: string, page: number) => {
    const mine = jumpSeq.current + 1;
    const hit = await seekRef(text, page);
    if (jumpSeq.current !== mine) return;
    if (!hit) { notify(`nothing found for ${text}`); return; }
    goTo(hit.at);
  };
  const doJump = async () => {
    const s = st.current.sel;
    if (s) await peekRef(s.text, s.page, s.rect);
  };
  /** A press in the peek, or ⏎ while it shows: the pages go where it looks, with the way back. */
  const followPeek = () => {
    const p = st.current.peek;
    if (!p) return;
    setPeek(null);
    goTo(p.at);
  };

  // ── the PDF's own links, and a reference under a point (milestone 76) ──
  /** The page under a point of the screen, and where on it (fractions from its top left). */
  const pagePoint = (clientX: number, clientY: number, target?: EventTarget | null): { page: number; x: number; y: number } | null => {
    const under = (target as HTMLElement | null)?.closest?.<HTMLElement>('.pdf-page');
    const list: [number, HTMLElement][] = under ? [[Number(under.dataset.page), under]] : [...pageEls.current];
    for (const [n, el] of list) {
      const pr = el.getBoundingClientRect();
      if (pr.width <= 0 || pr.height <= 0 || clientX < pr.left || clientX > pr.right || clientY < pr.top || clientY > pr.bottom) continue;
      return { page: n, x: (clientX - pr.left) / pr.width, y: (clientY - pr.top) / pr.height };
    }
    return null;
  };
  /** Where a box on a page (fractions of it) is on the screen: what a peek hangs under. */
  const onScreen = (page: number, b: { x: number; y: number; w: number; h: number }): Peek['rect'] => {
    const pr = pageEls.current.get(page)?.getBoundingClientRect();
    return pr ? { left: pr.left + b.x * pr.width, bottom: pr.top + (b.y + b.h) * pr.height } : { left: 0, bottom: 0 };
  };
  /** A page's references, read once, when first asked for. */
  const tokensOf = (n: number): Promise<RefToken[]> => {
    let t = tokens.current.get(n);
    if (!t && pdf) {
      t = (async () => {
        const pg = await pdf.getPage(n);
        const v = pg.getViewport({ scale: 1 });
        return referenceTokens(textBoxes((await pg.getTextContent()).items, v.width, v.height));
      })().catch((): RefToken[] => []);
      tokens.current.set(n, t);
    }
    return t ?? Promise.resolve([]);
  };
  /** Where an inside link goes: the page and how far down it; null for one that names no page. */
  const linkPlace = async (l: PageLink, from: number): Promise<{ page: number; y: number } | null> => {
    if (!pdf) return null;
    if (l.action !== undefined) {
      const p = actionPage(l.action, from, first, last);
      return p === null ? null : { page: p, y: 0 };
    }
    const d = await resolveDest(pdf as unknown as ContentsPdf, l.dest);
    return d && { page: d.page, y: d.top === null ? 0 : downPage(d.top, await heightOf(d.page)) };
  };
  /** A link followed: a web one in the system's browser, an inside one a jump with the way back. */
  const followLink = async (l: PageLink, from: number) => {
    if (l.url !== undefined) { openWeb(l.url); return; }
    const to = await linkPlace(l, from);
    if (!to) { notify('this link goes nowhere in this pdf'); return; }
    goTo(to);
  };
  /** A link's destination in the peek, without going; a web one's address is said. */
  const peekLink = async (l: PageLink, from: number) => {
    if (l.url !== undefined) { notify(l.url); return; }
    const to = await linkPlace(l, from);
    if (!to) { notify('this link goes nowhere in this pdf'); return; }
    const height = await heightOf(to.page);
    // the line the destination names at the peek's top: ten units of it, as a line of text is
    setPeek({ page: to.page, y: (1 - to.y) * height - 10, height: 10, text: '', rect: onScreen(from, l), at: to });
  };
  /** A press on a page that did not move (the click after it): a link is followed, with ⌥ peeked at; ⌥ on a word that names something peeks at what it names. */
  const onPress = (e: React.MouseEvent<HTMLDivElement>) => {
    const p = pressAt.current;
    pressAt.current = null;
    if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.detail > 1 || (e.target as HTMLElement).closest('[data-hit]')) return;
    if (p) {
      // a press that moved is the box's, the selection's or the scroll's; a finger's hold is the box's
      if (Math.hypot(e.clientX - p.x, e.clientY - p.y) > (onGlass(p.type) ? SLOP : PRESS_SLOP)) return;
      if (p.type === 'touch' && e.timeStamp - p.t >= HOLD_MS) return;
    }
    const hit = pagePoint(e.clientX, e.clientY, e.target);
    if (!hit) return;
    lastPoint.current = hit;
    const link = linkAt(links.current.get(hit.page) ?? [], hit.x, hit.y);
    if (link) {
      e.preventDefault();
      void (e.altKey ? peekLink(link, hit.page) : followLink(link, hit.page)).catch(console.error);
      return;
    }
    // a press in the page's left margin holds the line beside it under the rule (a keyboard's: not under a finger)
    if (!e.altKey && hit.x < RULER_MARGIN && !mobile && !st.current.sel) { void startRuler(hit).catch(console.error); return; }
    if (!e.altKey) return;
    void tokensOf(hit.page).then((list) => {
      const tok = tokenAt(list, hit.x, hit.y);
      if (tok) return peekRef(tok.text, hit.page, onScreen(hit.page, tok), true);
    }).catch(console.error);
  };
  /** The pointer over a link is a pointing hand (the styles read `data-over`). */
  const onHover = (e: React.PointerEvent<HTMLDivElement>) => {
    const col = pagesRef.current;
    if (!col || e.pointerType !== 'mouse') return;
    // a book with no links (most pages of most books) is not measured for it
    const hit = e.buttons === 0 && links.current.size > 0 ? pagePoint(e.clientX, e.clientY, e.target) : null;
    const over = !!hit && linkAt(links.current.get(hit.page) ?? [], hit.x, hit.y) !== null;
    if (over) col.dataset.over = 'link';
    else if (col.dataset.over) delete col.dataset.over;
  };
  /** A right-click on a page: `peek` first on a link or a reference; a selection's rows, and looking it up. */
  const onMenu = (e: React.MouseEvent<HTMLDivElement>) => {
    if ((e.target as HTMLElement).closest('[data-hit]')) return;
    const hit = pagePoint(e.clientX, e.clientY, e.target);
    if (!hit) return;
    // the page's own menu, or none: the web view's has nothing for a page
    e.preventDefault();
    const at = { left: e.clientX, top: e.clientY, bottom: e.clientY };
    const link = linkAt(links.current.get(hit.page) ?? [], hit.x, hit.y);
    const live = window.getSelection();
    const picked = st.current.sel?.text ?? (live && !live.isCollapsed && pagesRef.current?.contains(live.anchorNode) ? live.toString().replace(/\s+/g, ' ').trim() : '');
    const selRows: PopItem[] = picked ? [
      ...(st.current.sel ? [
        { label: 'section', act: 'section', run: () => void makeSection(false).catch(console.error) },
        { label: 'card', act: 'card', run: () => void cardOrClip().catch(console.error) },
        { label: '-' },
      ] : []),
      { label: 'search the web', act: 'web', run: () => openWeb(lookupUrl('web', picked)) },
      { label: 'search scholar', act: 'scholar', run: () => openWeb(lookupUrl('scholar', picked)) },
    ] : [];
    // a highlight under the pointer offers what a selection offers, its inks, and its end
    const hlId = highlightAt(marksRef.current, hit.page, hit.x, hit.y);
    const hl = hlId !== null ? marksRef.current[hlId] : undefined;
    const hlRows: PopItem[] = hlId !== null && hl?.kind === 'highlight' ? [
      { label: 'section', act: 'hl-section', run: () => void makeSection(false, undefined, quadBoxes(hl.quads)).catch(console.error) },
      { label: 'card', act: 'hl-card', run: () => void cardOrClip(quadBoxes(hl.quads)).catch(console.error) },
      { label: 'clear', act: 'hl-clear', run: () => clearHighlight(hlId) },
      { label: '-' },
      ...INK_NAMES.map((name, i): PopItem => ({ label: `${i + 1} · ${name}${hl.ink === i + 1 ? ' ✓' : ''}`, act: `ink-${i + 1}`, run: () => inkHighlight(hlId, i + 1) })),
    ] : [];
    const show = (first: PopItem[]) => {
      // over a highlight its own section and card stand for the selection's
      const rest = hlRows.length ? selRows.filter((r) => r.act === 'web' || r.act === 'scholar') : selRows;
      const rows = [...first, ...(first.length && hlRows.length ? [{ label: '-' }] : []), ...hlRows, ...((first.length || hlRows.length) && rest.length ? [{ label: '-' }] : []), ...rest];
      if (rows.length) popMenu(at, rows, 'book-menu');
    };
    if (link) {
      show([
        { label: 'peek', act: 'peek', run: () => void peekLink(link, hit.page).catch(console.error) },
        { label: link.url !== undefined ? 'open in the browser' : 'go there', act: 'follow', run: () => void followLink(link, hit.page).catch(console.error) },
      ]);
      return;
    }
    void tokensOf(hit.page).then((list) => {
      const tok = tokenAt(list, hit.x, hit.y);
      show(tok ? [
        { label: 'peek', act: 'peek', run: () => void peekRef(tok.text, hit.page, onScreen(hit.page, tok), true).catch(console.error) },
        { label: 'go there', act: 'follow', run: () => void followRef(tok.text, hit.page).catch(console.error) },
      ] : []);
    }).catch(console.error);
  };

  // ── link hints: `f` letters what can be followed in view ──
  const showHints = async () => {
    const sc = scroller();
    if (!sc || !pdf) return;
    const sr = sc.getBoundingClientRect();
    const found: Omit<HintTarget, 'label'>[] = [];
    for (const [n, el] of [...pageEls.current].sort((a, b) => a[0] - b[0])) {
      const pr = el.getBoundingClientRect();
      if (pr.height <= 0 || pr.bottom < sr.top || pr.top > sr.bottom) continue;
      // in view: its middle between the words over the pages and the view's bottom
      const seen = (b: { y: number; h: number }) => { const mid = pr.top + (b.y + b.h / 2) * pr.height; return mid >= sr.top + PLACE_AT - 20 && mid <= sr.bottom; };
      const on = (links.current.get(n) ?? []).filter(seen);
      // a reference the PDF made a link of is the link's
      const refs = (await tokensOf(n)).filter((t) => seen(t) && linkAt(on, t.x + t.w / 2, t.y + t.h / 2) === null);
      const onPage = [...on.map((l) => ({ page: n, x: l.x, y: l.y, w: l.w, h: l.h, link: l })), ...refs.map((t) => ({ page: n, x: t.x, y: t.y, w: t.w, h: t.h, text: t.text }))];
      // in reading order: down the page a line at a time, then across
      onPage.sort((a, b) => (Math.abs(a.y + a.h / 2 - (b.y + b.h / 2)) > Math.max(a.h, b.h) / 2 ? a.y - b.y : a.x - b.x));
      found.push(...onPage);
    }
    if (!found.length) { notify('nothing to follow in view'); return; }
    const labels = hintLabels(found.length);
    setHints({ targets: found.map((t, i) => ({ ...t, label: labels[i]! })), typed: '' });
  };
  /** A hint's letters typed: followed, or with ⇧ peeked at. */
  const followHint = (t: HintTarget, peekIt: boolean) => {
    if (t.link) void (peekIt ? peekLink(t.link, t.page) : followLink(t.link, t.page)).catch(console.error);
    else if (t.text !== undefined) void (peekIt ? peekRef(t.text, t.page, onScreen(t.page, t), true) : followRef(t.text, t.page)).catch(console.error);
  };
  // the letters are let go with the pane
  useEffect(() => { if (!active) setHints(null); }, [active]);

  // ── the contents: the palette asks this lens for them, and sends a place back (`book.ts`) ──
  const lensNow = useRef<{ contents(): Promise<BookContents>; go(p: { page: number; y: number }): void; show(p: { page: number; y: number }, portal: string): void }>({ contents: async () => ({ entries: [], here: -1, from: 'none' }), go: () => {}, show: () => {} });
  lensNow.current = {
    async contents() {
      const at = here();
      if (pdf) {
        outline.current ??= flatOutline(pdf as unknown as ContentsPdf, heightOf).catch((): ContentsEntry[] => []);
        // a chapter cut from a book lists what lies in its own pages
        const entries = contentsWithin(await outline.current, first, last);
        if (entries.length) return { entries, here: contentsHere(entries, at.page, at.y), from: 'outline' };
      }
      // no outline: the sections boxed on the pages, in the book's order
      const entries = drawnRef.current.flatMap((d): ContentsEntry[] => { const b = d.passage.boxes[0]; return b ? [{ title: plainMath(d.passage.heading.text), depth: 0, page: b.page, y: b.y }] : []; });
      return { entries, here: contentsHere(entries, at.page, at.y), from: entries.length ? 'sections' : 'none' };
    },
    go: (e) => goTo(e),
    // beside the page being read: moved to a portal's destination, no jump made of it
    show: (p, portal) => {
      // pages not there yet: shown once they are (below)
      if (status !== 'ok' || p.page < first || p.page > last || !pageEls.current.has(p.page)) return;
      goPlace(p, JUMP_ROOM);
      setShowing(portal);
    },
  };
  const activeRef = useRef(active);
  activeRef.current = active;
  const lens = useMemo((): BookLens => ({ active: () => activeRef.current, contents: () => lensNow.current.contents(), go: (p) => lensNow.current.go(p), show: (p, portal) => lensNow.current.show(p, portal) }), []);
  useEffect(() => addLens(id, lens), [id, lens]);
  /** This pane is the one beside that follows the portals of the page being read. */
  const follower = useFollower(id, lens);
  useEffect(() => { if (!follower) setShowing(null); }, [follower]);
  // this pane began to follow, or its pages have come: what the page being read last passed is shown
  useEffect(() => {
    const f = follower && status === 'ok' && sizes.length ? followingAt(id) : null;
    if (f) lensNow.current.show(f.to, f.portal);
  }, [follower, status, sizes.length, id]);
  /** A pane beside follows this book's portals. */
  const led = useFollowed(id);
  // a place this book was opened at (a bookmark of another book's list, a capital mark): gone to once the pages are there
  const wanted = usePlaceWanted(id);
  useEffect(() => {
    if (!wanted || !active || status !== 'ok' || !sizes.length) return;
    const p = takePlace(id);
    if (p) goTo(p);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wanted, active, status, sizes.length, id]);

  // ── what you leave on the page (milestone 77) ──
  const stamp = () => appNow().getTime();
  /** The marks are kept by the PDF's hash: a PDF with none (a collection that is no store) keeps none. */
  const marked = (): string | null => {
    if (hash === null) notify('marks are kept by the pdf\'s hash, which this collection does not have');
    return hash;
  };
  /** An entry taken away, said, with the notice's undo. */
  const dropMark = (key: string, said: string) => {
    const was = marksRef.current[key];
    if (!hash || !was) return;
    void setMark(hash, key, null).catch(console.error);
    notify(said, null, () => setMark(hash, key, was));
  };

  // bookmarks: `b` names the place in view
  /** The nearest numbered heading above a place, read back a page at a time; else its page. */
  const placeName = async (at: { page: number; y: number }): Promise<string> => {
    if (pdf && rel) {
      for (let n = at.page; n >= Math.max(first, at.page - NAME_BACK); n--) {
        const items = await itemsOf(rel, pdf, n);
        const head = headingAbove(() => items, n, n, n === at.page ? at.y + NAME_UNDER : Infinity);
        if (head !== null) return head;
      }
    }
    return `p. ${at.page}`;
  };
  const startBookmark = async () => {
    if (marked() === null) return;
    const at = here();
    const name = await placeName(at);
    setNaming({ page: at.page, y: at.y, name });
  };
  const keepBookmark = () => {
    const n = st.current.naming;
    setNaming(null);
    if (!n || !hash) return;
    const key = newMarkId('b');
    const name = n.name.replace(/\s+/g, ' ').trim() || `p. ${n.page}`;
    void setMark(hash, key, { kind: 'bookmark', ...placeOf(n.page, n.y), name, at: stamp() }).catch(console.error);
    notify(`bookmark · ${name} · p. ${n.page}`, null, () => setMark(hash, key, null));
  };
  useEffect(() => { if (naming) { nameRef.current?.focus(); nameRef.current?.select(); } }, [naming !== null]);

  // marks: ⇧M and a letter sets one at the place in view, `'` and the letter goes to it
  const setLetter = async (letter: string) => {
    if (marked() === null || !hash) return;
    const at = here();
    const mark: Mark = { kind: 'mark', letter, ...placeOf(at.page, at.y), at: stamp() };
    if (isCollectionMark(letter)) await setCollectionMark(hash, letter, mark);
    else await setMark(hash, letterId(letter), mark);
    notify(`mark ${letter} · p. ${at.page}${isCollectionMark(letter) ? ' · the collection\'s' : ''}`);
  };
  const goLetter = async (letter: string) => {
    if (isCollectionMark(letter)) {
      const m = await findCollectionMark(letter);
      if (!m) { notify(`no mark ${letter} in the collection`); return; }
      goToMark(m.hash, m, id);
      return;
    }
    const m = marksRef.current[letterId(letter)];
    if (!m) { notify(`no mark ${letter} in this pdf`); return; }
    goTo(m);
  };

  // highlights: `h` on a selection; `h` in one clears it; 1–4 choose its ink
  const clearHighlight = (key: string) => {
    const was = marksRef.current[key];
    dropMark(key, `highlight cleared${was?.kind === 'highlight' && was.text ? ` · ${was.text.slice(0, 40)}` : ''}`);
    setLastHl(null);
  };
  const inkHighlight = (key: string, ink: number) => {
    const was = marksRef.current[key];
    if (!hash || was?.kind !== 'highlight' || ink < 1 || ink > INKS) return;
    lastInk = ink;
    if (was.ink !== ink) void setMark(hash, key, { ...was, ink }).catch(console.error);
  };
  const doHighlight = () => {
    if (marked() === null || !hash) return;
    const s = st.current.sel;
    if (!s?.quads.length) {
      const p = lastPoint.current;
      const under = p ? highlightAt(marksRef.current, p.page, p.x, p.y) : null;
      if (under !== null) clearHighlight(under);
      else notify('select the words to highlight, then h');
      return;
    }
    const inside = highlightHolding(marksRef.current, s.quads);
    if (inside !== null) { clearHighlight(inside); clearBoxes(); return; }
    const made = highlightOf(s.quads, s.text, lastInk, stamp());
    if (!made) return;
    const key = newMarkId('h');
    void setMark(hash, key, made).catch(console.error);
    clearBoxes();
    notify(`highlighted · 1–${INKS} choose its ink`, null, () => setMark(hash, key, null));
    setLastHl({ id: key, seq: useApp.getState().notice?.seq ?? 0 });
  };

  // portals: ⇧P at a place, then ⇧P where it should show
  const portalKey = async () => {
    if (marked() === null || !hash) return;
    const at = here();
    const from = portalPending();
    if (!from) { setPortalPending({ hash, ...placeOf(at.page, at.y) }); return; }
    setPortalPending(null);
    const key = newMarkId('p');
    const mark: Portal = { kind: 'portal', page: from.page, y: from.y, to: { ...placeOf(at.page, at.y), ...(from.hash !== hash ? { pdf: hash } : {}) }, at: stamp() };
    await setMark(from.hash, key, mark);
    notify(`portal · p. ${from.page} shows p. ${at.page}`, null, () => setMark(from.hash, key, null));
  };
  /** A press on a portal's mark: where it shows, in the peek (⏎ goes there); one into another book opens that book there. */
  const openPortal = async (p: Portal, el: HTMLElement) => {
    if (p.to.pdf !== undefined) { goToMark(p.to.pdf, p.to, id); return; }
    if (!pdf || p.to.page > pdf.numPages) { notify(`p. ${p.to.page} is not in this pdf`); return; }
    const r = el.getBoundingClientRect();
    const height = await heightOf(p.to.page);
    setPeek({ page: p.to.page, y: (1 - p.to.y) * height - 10, height: 10, text: '', rect: { left: r.left - PEEK_W, bottom: r.bottom }, at: p.to });
  };
  const portalMenu = (e: React.MouseEvent, key: string, p: Portal) => {
    e.preventDefault();
    e.stopPropagation();
    popMenu({ left: e.clientX, top: e.clientY, bottom: e.clientY }, [
      { label: 'go there', act: 'portal-go', run: () => (p.to.pdf !== undefined ? goToMark(p.to.pdf, p.to, id) : goTo(p.to)) },
      { label: 'remove', act: 'portal-remove', run: () => dropMark(key, `portal removed · p. ${p.page}`) },
    ], 'book-menu');
  };
  // the pane beside follows: as the page being read passes a portal's source, that pane shows its destination
  const sent = useRef<string | null>(null);
  afterScroll.current = () => {
    lastPoint.current = null;
    if (follower || !portals.length || !followed(id)) { sent.current = null; return; }
    const sc = scroller();
    if (!sc) return;
    // the place being read: a third of the way down the view, where the rule holds its line
    const sr = sc.getBoundingClientRect();
    const line = sr.top + sr.height / 3;
    let at: { page: number; y: number } | null = null;
    for (const [k, el] of pageEls.current) {
      const pr = el.getBoundingClientRect();
      if (pr.height > 0 && pr.top <= line && (!at || k > at.page)) at = { page: k, y: Math.min(1, (line - pr.top) / pr.height) };
    }
    const p = at ? portalAbove(portals.filter(([, m]) => m.to.pdf === undefined), at) : null;
    if (!p || sent.current === p[0]) return;
    sent.current = p[0];
    followTo(id, lens, p[0], p[1].to);
  };
  // a portal made, or the pane beside opened: what it shows is said again
  useEffect(() => { sent.current = null; afterScroll.current(); }, [portals, follower, active, led]);

  // the ruler: a line of the page held under a rule
  const bandsOf = async (n: number): Promise<LineBand[]> => lineBands(await pageLines(n), await heightOf(n));
  /** The rule under the line nearest a place; with none given, the place a third of the way down the view. */
  const startRuler = async (near?: { page: number; y: number }) => {
    let at = near ?? null;
    const sc = scroller();
    if (!at && sc) {
      const sr = sc.getBoundingClientRect();
      const line = sr.top + sr.height / 3;
      for (const [k, el] of [...pageEls.current].sort((a, b) => a[0] - b[0])) {
        const pr = el.getBoundingClientRect();
        // the page the line crosses, else the first below it
        if (pr.height > 0 && pr.bottom > line) { at = { page: k, y: Math.max(0, (line - pr.top) / pr.height) }; break; }
      }
    }
    if (!at) return;
    const bands = await bandsOf(at.page);
    let to: { page: number; line: number } | null = bands.length ? { page: at.page, line: bandNear(bands, at.y) } : await stepLine({ page: at.page, line: -1 }, 1, async (n) => (await bandsOf(n)).length, first, last);
    if (to && to.line < 0) to = null;
    const band = to ? (await bandsOf(to.page))[to.line] : undefined;
    if (!to || !band) { notify('no lines of text to hold here'); return; }
    setRuler({ ...to, band });
  };
  const ruling = useRef<Promise<void>>(Promise.resolve());
  /** The rule a line down (1) or up (-1), onto the next page past a page's end; the page scrolls so it stays a third of the way down the view. */
  const moveRuler = (dir: 1 | -1) => {
    ruling.current = ruling.current.then(async () => {
      const r = st.current.ruler;
      if (!r) return;
      const to = await stepLine(r, dir, async (n) => (await bandsOf(n)).length, first, last);
      const band = to ? (await bandsOf(to.page))[to.line] : undefined;
      if (!to || !band) return;
      const next = { ...to, band };
      st.current.ruler = next;
      setRuler(next);
      const sc = scroller();
      const pr = pageEls.current.get(to.page)?.getBoundingClientRect();
      if (!sc || !pr) return;
      const sr = sc.getBoundingClientRect();
      landed.current = true;
      sc.scrollTop += pr.top + band.top * pr.height - (sr.top + sr.height / 3);
    }).catch(console.error);
  };
  /** `r` while the rule shows, in a book being read: the read point is the rule's line. */
  const readToRuler = () => {
    const r = st.current.ruler;
    if (!r) return;
    const y = Math.round(r.band.bottom * 1000) / 1000;
    void writeDoc(id, (d) => {
      const read = meta(d).read;
      if (read) setField(d, 'read', { ...read, pos: r.page, y });
    }).catch(console.error);
    notify(`read to p. ${r.page}`);
  };
  // the rule, the letters' wait and the name's field go with the pane
  useEffect(() => { if (!active) { setChord(null); setRuler(null); } }, [active]);
  useEffect(() => { lensChanged(); }, [active]);
  useEffect(() => {
    const canvas = peekCanvas.current;
    if (!peek || !pdf || !canvas) return;
    let live = true;
    (async () => {
      const page = await pdf.getPage(peek.page);
      // the peek is drawn as the pages are at fit, whatever their zoom: it is a look at a line, the size it always is
      const scale = fit;
      const vp = page.getViewport({ scale });
      const dpr = window.devicePixelRatio || 1;
      const full = document.createElement('canvas');
      full.width = Math.floor(vp.width * dpr);
      full.height = Math.floor(vp.height * dpr);
      await page.render({ canvas: full, viewport: vp, intent: 'print', transform: [dpr, 0, 0, dpr, 0, 0] }).promise;
      if (!live) return;
      const top = Math.max(0, Math.min(vp.height - PEEK_H, vp.height - (peek.y + peek.height) * scale - 24));
      const w = Math.min(PEEK_W, vp.width);
      const h = PEEK_H * (w / vp.width);
      canvas.width = Math.floor(w * dpr);
      canvas.height = Math.floor(h * dpr);
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      canvas.getContext('2d')?.drawImage(full, 0, top * dpr, vp.width * dpr, PEEK_H * dpr, 0, 0, w * dpr, h * dpr);
    })().catch(console.error);
    return () => { live = false; };
  }, [peek, pdf, fit]);

  useEffect(() => { if (find) findRef.current?.focus(); }, [find !== null]);
  useEffect(() => { if (goto) gotoRef.current?.focus(); }, [goto]);

  // ── keys: in the capture phase, so the boxes' keys come before the session's and the notes' ──
  const keyRef = useRef<(e: KeyboardEvent) => void>(() => {});
  keyRef.current = (e: KeyboardEvent) => {
    // ⌘= (⌘+) ⌘− ⌘0 over a book's pages are the pages' zoom, taken ahead of the app's text size (it checks
    // `defaultPrevented`); with the caret in a field, or in another pane, they are the text size as anywhere
    if ((e.metaKey || e.ctrlKey) && !e.altKey && (e.key === '+' || (!e.shiftKey && (e.key === '=' || e.key === '-' || e.key === '0')))) {
      if (!active || e.defaultPrevented || inField(e.target) || status !== 'ok' || !sizes.length) return;
      e.preventDefault();
      zoomBy(e.key === '0' ? 0 : e.key === '-' ? -1 : 1);
      return;
    }
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    const s = st.current;
    const have = s.pending.length > 0 || (s.sel?.boxes.length ?? 0) > 0;
    const take = () => { e.preventDefault(); e.stopPropagation(); };
    if (e.key === 'Escape') {
      const tying = active && portalPending() !== null;
      if (s.pending.length || s.find || s.goto || s.peek || s.recent || s.looking || s.hints || s.naming || s.chord || s.ruler || tying) {
        setPending([]); setFind(null); setGoto(false); setPeek(null); setRecent(null); setHints(null);
        setNaming(null); setChord(null); setRuler(null);
        if (tying) setPortalPending(null);
        jumpSeq.current++; setLooking(false);
        take();
      }
      return;
    }
    // the hints' letters: the ones typed follow a target (with ⇧ on the last, peek at it); any other key lets the labels go
    if (s.hints && e.key !== 'Shift') {
      setHints(null);
      if (inField(e.target)) return;
      take();
      const ch = e.key.length === 1 ? e.key.toLowerCase() : '';
      const typed = s.hints.typed + ch;
      const step = /^[a-z]$/.test(ch) ? hintStep(s.hints.targets.map((t) => t.label), typed) : null;
      if (step && 'left' in step) setHints({ ...s.hints, typed });
      else if (step) followHint(s.hints.targets[step.hit]!, e.shiftKey);
      return;
    }
    // ⇧M or `'` waits for its letter: the letter sets the mark or goes to it; any other key lets it go, and does nothing else
    if (s.chord && e.key !== 'Shift') {
      setChord(null);
      if (inField(e.target)) return;
      take();
      if (/^[A-Za-z]$/.test(e.key)) void (s.chord === 'set' ? setLetter(e.key) : goLetter(e.key)).catch(console.error);
      return;
    }
    if (inField(e.target)) return;
    // the peek shows where a reference points: ⏎ goes there
    if (active && s.peek && e.key === 'Enter') { take(); followPeek(); return; }
    if (have && e.key === 'e') { take(); void makeSection(false).catch(console.error); return; }
    if (have && e.key === 'm') { take(); void cardOrClip().catch(console.error); return; }
    // a reference under the selection: its target in a peek
    if (s.sel && e.key === 'Enter' && refOf(s.sel.text)) { take(); void doJump().catch(console.error); return; }
    if (s.recent && e.key === 'Enter' && !have && note !== null) {
      take();
      const r = s.recent;
      setRecent(null);
      useApp.setState({ reveal: { path: note, index: r.index, heading: r.text, write: true } });
      void openNotes(id).catch(console.error);
      return;
    }
    if (s.recent && e.key !== 'Shift') setRecent(null);
    if (!active) return;
    // a menu or the palette over the pages has the keys
    const free = !useApp.getState().paletteOpen && popMenuOpen() === null && document.querySelector('.ctx-menu') === null;
    if (free && e.key === 'Backspace') { if (e.shiftKey ? goForward() : goBack()) take(); return; }
    if (free && !e.shiftKey && e.key === 't' && status === 'ok') { take(); openContents(id); return; }
    if (free && !e.shiftKey && e.key === 'f' && status === 'ok') { take(); void showHints().catch(console.error); return; }
    // `n` and `N` step the search's hits, as ⏎ and ⇧⏎ do in its field
    if (free && (e.key === 'n' || e.key === 'N') && s.find?.q && s.find.pages.length) { take(); void runFind(s.find.q, e.key === 'n' ? 1 : -1).catch(console.error); return; }
    // what is left on the page (milestone 77)
    if (free && status === 'ok') {
      // the highlight just made: 1–4 choose its ink while its notice shows
      if (s.lastHl && /^[1-4]$/.test(e.key) && useApp.getState().notice?.seq === s.lastHl.seq) { take(); inkHighlight(s.lastHl.id, Number(e.key)); return; }
      // the rule: a line down or up, the read point set to it, let go
      if (s.ruler && (e.key === 'ArrowDown' || e.key === 'j' || e.key === 'ArrowUp' || e.key === 'k')) { take(); moveRuler(e.key === 'ArrowDown' || e.key === 'j' ? 1 : -1); return; }
      if (s.ruler && e.key === 'r' && reading) { take(); readToRuler(); return; }
      if (e.key === 'v') { take(); if (s.ruler) setRuler(null); else void startRuler().catch(console.error); return; }
      if (e.key === 'b') { take(); void startBookmark().catch(console.error); return; }
      if (e.key === 'h') { take(); doHighlight(); return; }
      if (e.key === 'M') { take(); if (marked() !== null) setChord('set'); return; }
      if (e.key === "'") { take(); setChord('go'); return; }
      if (e.key === 'P') { take(); void portalKey().catch(console.error); return; }
    }
    if (e.key === 'r' && canEnrol && !info?.read) { take(); startReading(); }
    else if (e.key === '/') { take(); setFind((f) => f ?? { q: '', pages: [], at: 0 }); findRef.current?.focus(); }
    else if (e.key === 'g') { take(); setGoto(true); }
    else if (!session && (e.key === ']' || e.key === '[')) {
      // step between the sections, in book order; with none, between pages
      const list = drawnRef.current.map((d) => d.passage);
      if (!list.length) { take(); scrollTo(current + (e.key === ']' ? 1 : -1)); return; }
      const at = list.findIndex((p) => p.heading.text === lit);
      const next = list[at < 0 ? (e.key === ']' ? 0 : list.length - 1) : at + (e.key === ']' ? 1 : -1)];
      take();
      if (next) {
        // a section more than a screen away is a jump, with the way back; one in view or just out of it is a step
        const b = next.boxes[0];
        const pr = b ? pageEls.current.get(b.page)?.getBoundingClientRect() : undefined;
        const sr = scroller()?.getBoundingClientRect();
        if (b && pr && sr && sr.height > 0) {
          const top = pr.top + b.y * pr.height;
          if (top < sr.top - sr.height || top > sr.bottom + sr.height) leave();
        }
        goToSection(next);
      }
    }
  };
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => keyRef.current(e);
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, []);

  // ── the read bar: from the first page to the read point; the gutter sets it ──
  const readPoint = point ?? (info?.read?.pos !== undefined ? { pos: info.read.pos, y: info.read.y ?? 1 } : null);
  const barHeight = (() => {
    if (!readPoint || readPoint.pos < first) return 0;
    if (readPoint.pos > last) return tops.total;
    const r = pageRect(readPoint.pos);
    return r ? r.top + readPoint.y * r.height : 0;
  })();
  const setFromY = (clientY: number) => {
    const bands: Band[] = [];
    for (let n = first; n <= last; n++) {
      const r = pageEls.current.get(n)?.getBoundingClientRect();
      if (r) bands.push({ top: r.top, height: r.height });
    }
    const k = pickPos(bands, clientY);
    if (!k) { setPoint({ pos: first, y: 0 }); return; }
    const r = pageEls.current.get(base + k)?.getBoundingClientRect();
    const y = r ? Math.min(1, Math.max(0, (clientY - r.top) / r.height)) : 1;
    setPoint({ pos: base + k, y });
  };
  const gutterDown = (e: React.PointerEvent<HTMLDivElement>) => {
    dragRef.current = true;
    e.currentTarget.setPointerCapture(e.pointerId);
    setFromY(e.clientY);
  };
  const gutterMove = (e: React.PointerEvent<HTMLDivElement>) => { if (dragRef.current) setFromY(e.clientY); };
  const gutterUp = (e: React.PointerEvent<HTMLDivElement>) => {
    dragRef.current = false;
    try { e.currentTarget.releasePointerCapture(e.pointerId); } catch { /* already released */ }
    const p = point;
    if (!p) return;
    void writeDoc(id, (d) => {
      const r = meta(d).read;
      if (r) setField(d, 'read', { ...r, pos: p.pos, y: Math.round(p.y * 1000) / 1000 });
    }).finally(() => setPoint(null)).catch(console.error);
  };

  if (status === 'unreadable' && info) {
    return <div className="reader-wrap"><div className="reader"><div className="empty">could not open this pdf</div></div></div>;
  }
  if (status === 'gone' || status === 'unreadable' || (status === 'ok' && !info)) {
    return <div className="reader-wrap"><div className="reader"><div className="empty">no longer in the collection</div></div></div>;
  }

  // the top row as the reader's: one short token, what is due, else the cards; the rest in its tooltip
  const cards = info?.cards ?? 0;
  const due = info?.due ?? 0;
  const counts = cards ? `${plural(cards, 'card')}${due ? `, ${due} due` : ''}` : '';
  const span = !sizes.length ? '' : !base && !range ? plural(sizes.length, 'page') : first === last ? `p. ${first}` : `pp. ${first}–${last}`;
  const readTo = info?.read?.pos ? `read to p. ${info.read.pos}` : '';
  const rightTip = [status === 'ok' ? span : '', readTo, textless ? 'no text' : '', counts].filter(Boolean).join(', ');
  // the page in view of the last, and what is due beside it; the rest in the tooltip
  const where = status === 'ok' && sizes.length ? `p. ${current} / ${last}${zoom !== 1 ? ` · ${Math.round(zoom * 100)}%` : ''}` : '';
  const shown = [where, due ? `${due} due` : ''].filter(Boolean).join(' · ') || readTo || (cards ? plural(cards, 'card') : '') || (textless && status === 'ok' ? 'no text' : '');
  const shownPending = [...pending, ...(sel?.boxes ?? [])];
  const lastPending = pending.length ? boxRect(pending[pending.length - 1]!) : null;

  return (
    <div className="reader-wrap" ref={outerRef} data-wide={wide ? '1' : undefined}>
      <div ref={viewRef} className={`reader doc-view pdf-view${reading ? ' reading' : ''}`} data-page={current} data-roomy={roomy ? '1' : '0'} data-zoom={zoom} data-back={trail.back.length} data-fwd={trail.forward.length} data-hash={hash ?? undefined} data-bookmarks={bookmarks.length} data-highlights={highlights.length} data-portals={portals.length} data-ruler={ruler ? `${ruler.page}:${ruler.line}` : undefined} data-following={follower ? '1' : undefined} data-portal={showing ?? undefined} style={colW > 0 ? { width: pageW, ...(wide ? { '--fit-w': `${colW}px`, '--fit-left': `${room.left}px` } as React.CSSProperties : null) } : undefined}>
        <div className="meta">
          <Crumbs path={id} />
          {!(phone && session) && <button type="button" className="frozen-tag notes-toggle" data-on={notesOpen ? '1' : '0'} aria-pressed={notesOpen} title={'notes ⌘\\'} onClick={() => toggleNotes(id)}>notes</button>}
          {!isPdfPath(id) && <TabsToggle path={id} />}
          <StudyButton path={id} />
          <ExamTag path={id} />
          {follower && <span className="frozen-tag following" title="this pane shows where the portals of the page being read lead; close it to stop">following portals</span>}
          {info && canEnrol && !info.read && (
            <button type="button" className="frozen-tag enrol" onClick={startReading}>start reading <span className="kbd">r</span></button>
          )}
          {shown && <span className="right" title={rightTip}>{shown}</span>}
        </div>
        <h1>{titleOf(id, docs, root)}</h1>
        {(find || goto || looking || naming || chord || (portalFrom && active)) && (
          <div className="pdf-bar">
            {find && (
              <>
                <span className="pb-k">/</span>
                <input
                  ref={findRef}
                  dir="auto"
                  value={find.q}
                  spellCheck={false}
                  placeholder="search"
                  onChange={(e) => setFind((f) => (f ? { q: e.target.value, pages: [], at: 0 } : f))}
                  onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); void runFind(find.q, find.pages.length ? (e.shiftKey ? -1 : 1) : 0); } }}
                />
                <span className="pb-n">{find.pages.length ? `p. ${hitAt(find.pages, find.at)?.page}, ${find.at + 1} / ${hitCount(find.pages)}` : find.did === 'searching' ? 'searching' : find.did === 'done' && find.q ? 'none' : ''}</span>
              </>
            )}
            {goto && (
              <>
                <span className="pb-k">g</span>
                <input
                  ref={gotoRef}
                  type="number"
                  min={first}
                  max={last || 1}
                  placeholder={`${first}–${last}`}
                  onKeyDown={(e) => {
                    if (e.key !== 'Enter') return;
                    e.preventDefault();
                    const n = Number(e.currentTarget.value);
                    if (n >= 1) { leave(); scrollTo(n); }
                    setGoto(false);
                  }}
                  onBlur={() => setGoto(false)}
                />
              </>
            )}
            {naming && (
              <>
                <span className="pb-k">b</span>
                <input
                  ref={nameRef}
                  className="pb-name"
                  dir="auto"
                  value={naming.name}
                  spellCheck={false}
                  placeholder="bookmark"
                  onChange={(e) => setNaming((n) => (n ? { ...n, name: e.target.value } : n))}
                  onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); keepBookmark(); } }}
                />
                <span className="pb-n">p. {naming.page} · ⏎ keep</span>
              </>
            )}
            {chord && <span className="pb-n pb-wait" role="status" data-chord={chord}>{chord === 'set' ? 'mark…' : 'go to mark…'}</span>}
            {portalFrom && active && <span className="pb-n pb-wait" role="status" data-portal="pending">portal: go to where it should show, ⇧P again</span>}
            {looking && <span className="pb-n" role="status">looking</span>}
          </div>
        )}
        <div className={`doc-wrap pdf-body${reading ? ' reading' : ''}`} ref={wrapRef}>
          {reading && <div className="read-gutter" onPointerDown={gutterDown} onPointerMove={gutterMove} onPointerUp={gutterUp} />}
          {reading && status === 'ok' && (
            <>
              <div className="read-rule read-bar" style={{ top: 0, height: barHeight }} title={readPoint ? `read to p. ${readPoint.pos}` : undefined} />
              <div className="read-edge" style={{ top: barHeight }}><span className="read-knob" /></div>
            </>
          )}
          <div className="pdf-pages" ref={pagesRef} style={{ height: tops.total || undefined, width: pageW }} onPointerDown={onPointerDown} onMouseDown={onMouseDown} onClick={onPress} onPointerMove={onHover} onContextMenu={onMenu}>
            {status === 'loading' && <div className="empty">opening</div>}
            {sizes.map((s, i) => (
              <div
                key={base + i + 1}
                className="pdf-page"
                data-page={base + i + 1}
                ref={(el) => { if (el) pageEls.current.set(base + i + 1, el); else pageEls.current.delete(base + i + 1); }}
                style={{ width: s.w * scale, height: s.h * scale, top: tops.at[i + 1] }}
              />
            ))}
            {hash && Object.keys(inked).length > 0 && (
              <div className="pdf-ink">
                {sizes.map((s, i) => {
                  const n = base + i + 1;
                  // a page's writing is made when the page itself is drawn, as it comes near
                  const r = inked[n] !== undefined && rendered.current.has(n) ? pageRect(n) : null;
                  return r && <PageInk key={n} hash={hash} page={n} w={s.w} h={s.h} rev={inked[n]!} rect={r} live={liveInk.has(n)} onShown={pictureShown} />;
                })}
              </div>
            )}
            {/* the highlights, a box a line under the page's text: fractions of the page, so they hold at any zoom and through a page drawn again */}
            <div className="pdf-hls">
              {status === 'ok' && highlights.map(([key, h]) => h.quads.map((q, i) => {
                const r = boxRect({ page: q[0], x: q[1], y: q[2], w: q[3], h: q[4] });
                return r && <div key={`${key}:${i}`} className="hl" data-hl={key} data-ink={h.ink} data-page={q[0]} style={{ left: r.left, top: r.top, width: r.width, height: r.height }} />;
              }))}
              {ruler && (() => {
                const r = pageRect(ruler.page);
                return r && <div className="pdf-rule" data-page={ruler.page} data-line={ruler.line} style={{ left: r.left, top: r.top + ruler.band.top * r.height, width: r.width, height: (ruler.band.bottom - ruler.band.top) * r.height }} />;
              })()}
            </div>
            {/* the PDF's own links, where they lie: nothing a pointer meets (a press is read by where it falls), so a box or a selection begins on one as anywhere */}
            <div className="pdf-links">
              {status === 'ok' && [...rendered.current.keys()].map((n) => (links.current.get(n) ?? []).map((l, i) => {
                const p = pageRect(n);
                return p && <div key={`${n}:${i}`} className="plink" data-page={n} data-kind={l.url !== undefined ? 'web' : 'inside'} data-href={l.url} style={{ left: p.left + l.x * p.width, top: p.top + l.y * p.height, width: l.w * p.width, height: l.h * p.height }} />;
              }))}
            </div>
            {hints && (
              <div className="pdf-hints" data-typed={hints.typed}>
                {hints.targets.map((t) => {
                  const p = pageRect(t.page);
                  const on = t.label.startsWith(hints.typed);
                  return p && (
                    <kbd key={t.label} className="phint" data-label={t.label} data-kind={t.link ? (t.link.url !== undefined ? 'web' : 'link') : 'ref'} data-page={t.page} data-off={on ? undefined : '1'} title={t.text ?? t.link?.url} style={{ left: p.left + t.x * p.width, top: p.top + t.y * p.height }}>
                      {on && hints.typed ? <><span className="ph-t">{hints.typed}</span>{t.label.slice(hints.typed.length)}</> : t.label}
                    </kbd>
                  );
                })}
              </div>
            )}
            <div className="pdf-marks">
              {/* a bookmark: a small mark in the left gutter, beside the read bar; a portal's source: one in the page's right margin */}
              {status === 'ok' && bookmarks.map(([key, m]) => {
                const r = pageRect(m.page);
                return r && <div key={key} data-hit="1" className="bmark" data-mark={key} data-page={m.page} title={m.name} style={{ left: -12, top: r.top + m.y * r.height - 5 }} onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); }} onContextMenu={(e) => { e.preventDefault(); e.stopPropagation(); popMenu({ left: e.clientX, top: e.clientY, bottom: e.clientY }, [{ label: 'remove', act: 'bookmark-remove', run: () => dropMark(key, `bookmark removed · ${m.name}`) }], 'book-menu'); }} />;
              })}
              {status === 'ok' && portals.map(([key, m]) => {
                const r = pageRect(m.page);
                return r && <button type="button" key={key} data-hit="1" className="pmark" data-mark={key} data-page={m.page} data-to={m.to.page} aria-label={`portal to p. ${m.to.page}`} title={`shows p. ${m.to.page}${m.to.pdf !== undefined ? ' of another book' : ''}`} style={{ left: r.width - 16, top: r.top + m.y * r.height - 7 }} onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); }} onClick={(e) => { e.stopPropagation(); void openPortal(m, e.currentTarget).catch(console.error); }} onContextMenu={(e) => portalMenu(e, key, m)}>↗</button>;
              })}
              {status === 'ok' && drawn.map(({ passage: p, cards: n, dismissed }) => {
                const cur = lit === p.heading.text;
                const flashing = flash?.text === p.heading.text;
                return p.boxes.map((b, i) => {
                  const r = boxRect(b);
                  if (!r) return null;
                  const label = i ? `↳ ${plainMath(p.heading.text)} (${i + 1}/${p.boxes.length})` : plainMath(p.heading.text);
                  return (
                    <div key={`${p.index}:${i}`} className="pbox-group">
                      <div
                        className={`pbox${cur ? ' cur' : ''}${dismissed ? ' dis' : ''}${flashing ? ' flash' : ''}`}
                        data-section={p.heading.text}
                        data-page={b.page}
                        style={{ left: r.left, top: r.top, width: r.width, height: r.height }}
                      />
                      {roomy ? (
                        <div data-hit="1" className={`ptag${i ? ' cont' : ''}${cur ? ' cur' : ''}${dismissed ? ' dis' : ''}`} style={{ left: pageW + 12, top: r.top }} title="go to this section in the notes" onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); goToSection(p); }}>
                          {!i && <span className="pt-g">§</span>}{label}{!i && n > 0 && <span className="pt-c">◆{n}</span>}
                        </div>
                      ) : (
                        <div data-hit="1" className={`pgut${cur ? ' cur' : ''}${dismissed ? ' dis' : ''}`} style={{ left: pageW + 3, top: r.top }} title={label} onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); goToSection(p); }}>{i ? '↳' : '§'}</div>
                      )}
                    </div>
                  );
                });
              })}
              {shownPending.map((b, i) => {
                const r = boxRect(b);
                return r && (
                  <div key={`pending:${i}`} className="pbox pending" style={{ left: r.left, top: r.top, width: r.width, height: r.height }}>
                    {shownPending.length > 1 && <span className="pb-no">{i + 1}</span>}
                  </div>
                );
              })}
              {ghost && <div className="pbox pending ghost" style={ghost} />}
              {lastPending && !sel && (
                <div data-hit="1" className="pend" style={{ left: lastPending.left, top: lastPending.top + lastPending.height + 6 }}>
                  <button type="button" data-k="e" onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); void makeSection(false).catch(console.error); }}><kbd>e</kbd><span className="pe-l">section{pending.length > 1 ? ` · ${pending.length} boxes` : ''}</span></button>
                  <button type="button" data-k="m" onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); void cardOrClip().catch(console.error); }}><kbd>m</kbd><span className="pe-l">card</span></button>
                  {!mobile && <button type="button" data-k="esc" onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); clearBoxes(); }}><kbd>esc</kbd></button>}
                </div>
              )}
            </div>
          </div>
          {sel && (
            <div className="sel-cue" style={{ top: sel.rect.bottom + 8, left: sel.rect.left }}>
              <button type="button" className="cue-act" {...press(() => void makeSection(false).catch(console.error))}>
                section <span className="kbd">e</span>
              </button>
              <button type="button" className="cue-act" {...press(() => void cardOrClip().catch(console.error))}>
                card <span className="kbd">m</span>
              </button>
              {plugSel && <CueActions sel={plugSel} onRun={() => setSel(null)} />}
            </div>
          )}
          {peek && (
            <div
              className="pdf-peek"
              style={{ top: Math.max(60, Math.min(peek.rect.bottom + 8, window.innerHeight - 220)), left: Math.max(8, Math.min(peek.rect.left, window.innerWidth - PEEK_W - 40)) }}
              data-page={peek.page}
              onClick={followPeek}
            >
              <div className="pk-hd"><span>p. {peek.page}</span><span className="pk-t">{peek.text}</span><span className="kbd">esc</span></div>
              <canvas ref={peekCanvas} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
