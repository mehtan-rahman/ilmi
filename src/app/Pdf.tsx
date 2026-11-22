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
// after a short hold, since milestone 57) become a passage with `e`: kept
// with the PDF, among its marks, and in no note, back on its cadence until
// dismissed (FORMAT.md §6.5; `passages.ts`). The note on a PDF is the
// person's own: only `m` writes in it, a clip of each box (§6.6) where the
// caret is in the note, or at its end, the caret under it for the card.
// Every passage's boxes are drawn on its pages, tagged with its pages (a §
// in the gutter when there is no room), dashed once dismissed; a press on
// the tag has what can be done with it. A note written before milestone 81
// holds its passages as boxed sections under headings: those are drawn the
// same, tagged with the heading, the caret's section lit and the pages
// scrolled to it. Nothing is written into the PDF, ever; every
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
//
// Written notes (milestone 82). A note whose pages are paper (`written.ts`)
// opens here too, in the same column: there is no file and nothing for
// pdf.js, its pages are its sheets, each drawn as its paper (`paper.ts`),
// and its id stands where a PDF's hash does, for what is written on it and
// for the passages kept from it. In the column a page is known by its place,
// 1 to N, so the page in view, `g`, the place kept and the zoom are as they
// are for a PDF; a sheet has a number of its own that it keeps when a page
// before it is deleted, and that number is used only where something leaves
// the column or comes into it: the key its strokes are under, a box kept as
// a passage or clipped into a note, a passage's boxes read back (`sheetAt`,
// `placeOfSheet` below; for a PDF both are the page itself). What a PDF's
// text gives (the contents, search, links and references, the ruler,
// highlights, bookmarks, marks, portals, the read bar) is not there for
// paper, and its keys do nothing. `add page` under the last page adds one,
// and on an iPad a stroke begun low on the last page adds one by itself;
// `more` has the paper and `delete this page`. The tools to write with are a
// row of the bar (`InkBar.tsx`) wherever there is a canvas, over a PDF's
// pages as well; with none (the Mac) a notebook says `written on an ipad`
// there.

import { visibleBottom } from './viewport.js';
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { boxesAt, boxesEnd, formatClip, meta, pagesLabel, parseBoxes, sectionDismissed, setField, type Box, type Doc, type SectionSchedule } from '../format/index.js';
import {
  actionPage, bandNear, bookmarksOf, boxAround, contentsHere, contentsWithin, countIn, downPage, findAll, findText, flatOutline, flipRect, headingAbove, highlightAt, highlightHolding, highlightOf,
  highlightsOf, hintLabels, hintStep, isCollectionMark, letterId, lineBands, lineQuads, linesOf, linkAt, lookupUrl, newMarkId, pageLinks, placeOf, portalAbove, portalsOf,
  passageMarksOf, pushPlace, quadBoxes, refOf, referenceTokens, resolveDest, sectionName, seekTarget, stepBack, stepForward, stepLine, textBoxes, tokenAt, uprightItems,
  type ContentsEntry, type ContentsPdf, type Found, type LineBand, type PageItem, type PageLink, type Place, type RefToken,
} from '../pdf/index.js';
import { pickPos, type Band } from '../reader/index.js';
import { passagesOf, pointOn, sectionState, type Passage } from '../schedule/index.js';
import { INKS, passageId, childDirOf, isPdfPath, type InkStroke, type Mark, type Portal, type Quad, type StoreFs } from '../vault/index.js';
import { PAPERS, SHEET_H, SHEET_W, addSheet, addSheetAfter, addWritten, duplicateSheet, healSheets, inkFoot, newWrittenTab, placeOfSheet as placeAmong, removeSheet, setPaper, sheetAt as sheetAmong, type PaperKind } from './written.js';
import { InkMenu, PageGrid, PageSetup, PaperSheet, sharePages } from './PageTools.js';
import { paperLook, paperOf, runLength, sheetSize, type PaperSpec } from './paper.js';
import { InkBar, InkToggle } from './InkBar.js';
import { redo as inkRedo, undo as inkUndo, useInkTools } from './inkTools.js';
import { CueActions } from '../plugins/CueActions.js';
import { onPluginAction, publishSelection, toPluginSelection, type PluginSelection } from '../plugins/index.js';
import { notesOf, notesTabsOf, pdfForNotes, titleOf } from './names.js';
import { besideAt } from './panes.js';
import {
  addLens, addNote, ensureNote, findCollectionMark, followTo, followed, goToMark, lensChanged, openContents, openNotes, togglePortalsBeside, openWeb, portalPending, setCollectionMark, setMark, setPortalPending, setTrail,
  takeBesidePlace, takePlace, toggleNotes, trailOf, useFollowed, useFollower, followingAt, useBesidePlace, useMarks, usePlaceWanted, usePortalPending, useTrail, type BookContents, type BookLens,
} from './book.js';
import { popMenu, popMenuOpen, type PopItem } from './popMenu.js';
import { TextLayer, pageBits, type PDFDocumentProxy, type PDFPageProxy } from './pdfjs.js';
import { acquirePdf, itemsOf } from './bookPdf.js';
import { pdfFail, type PdfFail } from './pdfFail.js';
import { addSurface, afterScene, covered, fillSheet, restSheet, forgetSheet, hasCanvas, holdScenes, inContent, onFingers, onLayout, onSurface, pagePaper, pinchSheets, portOf, sceneSoon, settleSheets, type Box as InkBox, type PenEvent, type SheetSpec, type Surface } from './ink.js';
import { PageInkSvg } from './PageInkSvg.js';
import { onLiveSheet } from './pageInk.js';
import { dropSurface, hexOf, holesOver, paperArgs, sendSurface, surfaceGo, surfacePicture, surfaceZoom, type SurfaceMark } from './surface.js';
import { Icon } from './icons.js';
import { StudyButton } from './StudyButton.js';
import { ExamTag } from './ExamTag.js';
import { TabsToggle } from './TabsToggle.js';
import { useApp, type DocInfo } from './store.js';
import { useDocs } from './useDoc.js';
import { currentVault, enrolReading, logReading, setBookZoom, unlogReading } from './vault.js';
import { placeAtCaret, writeDoc } from './sections.js';
import { bringPassageBack, changePassage, keepPassage, putPassage, schedOf } from './passages.js';
import { chipWhen } from './bookNotes.js';
import { failed, notify } from './land.js';
import { hapticTick } from './haptics.js';
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
const PAGE_MAX = 1600;
/** How far down the view the place kept across a change of scale is, px: under the words over the pages. */
const PLACE_AT = 60;
/** The same where the rows over the pages are outside the scroller: the view begins under them. */
const PLACE_OUT = 14;
/** The zooms a book's pages step through: 1 is the pages fitted to the pane's width; under it they are centred, over it they scroll sideways. */
export const ZOOMS = [0.5, 0.75, 1, 1.25, 1.5, 2, 2.5, 3, 4];
/** The least and the most a pinch leaves the pages at; between them a pinch stops anywhere. */
export const ZOOM_MIN = ZOOMS[0]!;
export const ZOOM_MAX = ZOOMS[ZOOMS.length - 1]!;
/** The most pixels a page's canvas is drawn with: past it the page is drawn coarser, not larger (a canvas over WebKit's limit draws nothing). */
const CANVAS_MAX = 16_000_000;
/**
 * The most pixels a page's whole drawing has on a device (pdf.js's own viewer keeps to 5 MP on iOS): zoomed in past
 * it the page is drawn whole at this, and the part of it in view sharp over that (`pg-detail`), never the whole page
 * at the zoom (at 250% a page is some 22 MP, a second's drawing and 90 MB).
 */
const BASE_MAX_MOBILE = 5_242_880;
/** The most pixels the drawing of the part of a page in view has, with what lies about it. */
const DETAIL_MAX = 8_000_000;
/** The widest a page's middle-sized picture from the system is, px (`pg-mid`): what a page shows at once, zoomed out or arriving, until its own drawing comes. */
const MID_MAX = 1280;
/** The generations of the tiles asked for, counted for every book open: the app does not draw an asking older than the last it was told. */
const tileGens = { n: 0, readers: 0 };
/** How many pages from the one in view a page keeps its middle-sized picture. */
const MID_KEEP = 4;
/**
 * A tile's size, in the pixels of the page as drawn at the size it is shown (the app's drawing, round 2): a band across
 * the page (up to `TILE_W` wide) rather than a square, since Core Graphics reads the whole page for each tile it draws
 * and a page of type is mostly reading: a screen is some six bands, one reading each, drawn at once on six cores.
 */
const TILE_W = 2048;
const TILE_H = 384;
/** How much about the view has its tiles too, of the view's width and height each way: a scroll finds them there. */
const TILE_MARGIN_X = 0.25;
const TILE_MARGIN_Y = 0.5;
/** How a tile comes from the app: a BMP has nothing to compress or decode. */
const TILE_FORMAT = 'bmp';
/** The width of a page's middle-sized picture where the app draws tiles: one width, so the app keeps it on disk for every zoom. */
const MID_W = 1024;
/** Pages from the one in view that show their middle-sized picture, and further that have it made and kept ahead. */
const MID_SHOW = 2;
const MID_WARM = 10;
/** Zoomed, a page this far outside the view gives its canvas back, px. */
const FAR = AHEAD * 3;
/** The pixels to a point a page's writing is drawn with: the least of these that the screen has, for the size the page is drawn at. */
const INK_SCALES = [1, 1.5, 2, 3, 4, 6];
/** The most pixels a page's writing is drawn with. */
const INK_MAX = 20_000_000;
/** A pinch's wheel events closer together than this are one gesture, ms. */
const PINCH_GAP = 260;
/** How far back from a passage the lens reads pages for a heading to name it. */
const NAME_BACK = 30;
/** How far past its foot a pageless notebook's sheet is drawn, of its height: a stroke kept on one sheet runs on over the next (88: a sheet's height, where it was half). */
export const RUN_OVER = 1;
/** How many sheets above the ones near the view a pageless notebook's ink is drawn from: a stroke is kept on the sheet its top lies on and may run on into the view from as far up (the surface's `runsOver`). */
const RUNS_OVER = 8;
/** How far down a notebook's last page a stroke begins for a page to be added after it: its lower third. */
const ADD_FROM = 2 / 3;

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
/** A figure's peek: room for the picture over its caption. */
const PEEK_FIG_H = 330;
const PEEK_W = 480;
/** The width a page is drawn at for its peek, px: the peek shows about half of it across. */
const PEEK_PAGE = 880;

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
/** The PDF being opened, kept across a restart: what was being opened when the page last went down. */
/** How long a PDF's pages are asked their sizes before it is shown: past this the rest are read behind it. */
const SIZES_WAIT = 400;
/** How long a jump waits for the small picture of the page it goes to, at most. */
const JUMP_HOLD = 150;
/** How many pixels across a page's small picture is: enough to say what the page is while its drawing comes. */
const LOW_W = 256;
/** How many pages on from the one in view have their small pictures there, the way the reader is going; and behind. */
const LOW_AHEAD = 18;
const LOW_BEHIND = 8;
/**
 * Where the app draws a PDF's pages as pictures (`ilmipage:`, the system's own drawing off the page's thread): the
 * collection and the file's name among its bytes. Null where there is no app to ask (a test), no store, or the
 * file's bytes are not on this device.
 */
function picturesOf(rel: string | undefined): { root: string; hash: string } | null {
  const vault = currentVault();
  if (!rel || !vault || typeof window === 'undefined' || !('__TAURI_INTERNALS__' in window)) return null;
  const fs = vault.fs as Partial<StoreFs>;
  const hash = fs.blobAt?.(vault.abs(rel)) ?? null;
  if (!hash || fs.isAway?.(vault.abs(rel))) return null;
  return { root: vault.root, hash };
}
/** A page's picture, `w` pixels across (a JPEG). */
const lowUrl = (at: { root: string; hash: string }, n: number, w = LOW_W, q = 0.6): string => `ilmipage://localhost/${at.hash}/${n}?root=${encodeURIComponent(at.root)}&w=${w}&q=${q}`;
/**
 * (dev) A drawing held back as long as a slower device would take over it: `window.ilmiSlowDraw` ms for each
 * screen's worth of pixels (3.5 MP, an 11-inch iPad's page at fit), set by a smoke (`"slow"`) to see on a simulator,
 * whose processor is a Mac's, what the order of drawing does where each page takes a while.
 */
async function slowDraw(pixels: number, took = 0): Promise<void> {
  const w = window as unknown as { ilmiSlowDraw?: number; ilmiSlowFactor?: number };
  const ms = w.ilmiSlowDraw ?? 0;
  // (or `ilmiSlowFactor` times as long as the drawing took, as the app's own drawings are held back: `dev_pages_slow`)
  const wait = ms > 0 ? (ms * pixels) / 3.5e6 : took * Math.max(0, (w.ilmiSlowFactor ?? 1) - 1);
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
}
/** Every page's size as the system reads it, once a file; null where it cannot. */
const sizesAsked = new Map<string, Promise<Size[] | null>>();
function pageSizes(hash: string): Promise<Size[] | null> {
  let p = sizesAsked.get(hash);
  if (!p) {
    const root = currentVault()?.root ?? '';
    p = import('@tauri-apps/api/core').then((m) => m.invoke<[number, number][]>('pdf_sizes', { root, hash })).then((all) => all.map(([w, h]) => ({ w, h })), () => null);
    sizesAsked.set(hash, p);
    void p.then((v) => { if (!v) sizesAsked.delete(hash); });
  }
  return p;
}
/** How long after its last page is drawn a file is no longer held to be opening. */
const OPENED_MS = 4000;
const OPENING_KEY = 'ilmi.pdf.opening';
/** What this page itself has marked as opening: a mark that is not this page's was left by one that went down. */
let openingHere: string | null = null;
function opening(rel: string | null): void {
  openingHere = rel;
  try { if (rel === null) localStorage.removeItem(OPENING_KEY); else localStorage.setItem(OPENING_KEY, rel); } catch { /* no storage: no guard */ }
}
/** Whether the file is marked as opening by a page before this one: it went down with the file half open. (The same file opening in a second pane of this page is this page's own mark.) */
function fellOpening(rel: string): boolean {
  try { return localStorage.getItem(OPENING_KEY) === rel && openingHere !== rel; } catch { return false; }
}
/** A mark left by a page before this one, taken off: that page was closed, not taken down. */
function forgetOpening(rel: string): void {
  try { if (localStorage.getItem(OPENING_KEY) === rel && openingHere !== rel) localStorage.removeItem(OPENING_KEY); } catch { /* no storage */ }
}
/** Whether the page's own process was taken from under it in this run of the app: asked of the app once (it loaded the page again then). False where there is no app to ask. */
let fellAsked: Promise<boolean> | null = null;
function pageFell(): Promise<boolean> {
  fellAsked ??= import('@tauri-apps/api/core').then((m) => m.invoke<boolean>('page_fell', {})).then((v) => v === true, () => false);
  return fellAsked;
}
/** Whether this page holds the file to be opening still. */
function openingStill(rel: string): boolean {
  try { return localStorage.getItem(OPENING_KEY) === rel; } catch { return false; }
}
// a page put away in the ordinary way (the app closed, or sent behind another) went down with nothing: only a page
// taken from under a file that was opening leaves the mark
if (typeof window !== 'undefined') {
  window.addEventListener('pagehide', () => { if (openingHere !== null) opening(null); });
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden' && openingHere !== null) opening(null); });
}

function hitAt(pages: Find['pages'], at: number): { page: number; k: number } | null {
  let k = at;
  for (const p of pages) {
    if (k < p.n) return { page: p.page, k };
    k -= p.n;
  }
  return null;
}

const places = new Map<string, { top: number; at: { page: number; y: number } | null; x: number | null }>();
/** The zoom each book's pages had before a finger's two taps fitted them: two more go back to it. */
const lastZooms = new Map<string, number>();
/** The zoom two taps go to from fit, where there is none to go back to. */
const TAP_ZOOM = 2;
/** How long the pages take to come to rest where they will be laid out, ms. */
const SETTLE_MS = 220;
/** The zoom one step in (`dir` 1) or out (-1) from `z`; 0 is fit. */
export function zoomStep(z: number, dir: number): number {
  if (dir === 0) return 1;
  // from anywhere a pinch left it: the next step past it, that way
  if (dir > 0) return ZOOMS.find((v) => v > z + 0.005) ?? ZOOM_MAX;
  return [...ZOOMS].reverse().find((v) => v < z - 0.005) ?? ZOOM_MIN;
}

/** A zoom as a pinch leaves it: held between the least and the most, to a hundredth; all but fit is fit. */
export function zoomHeld(z: number): number {
  const v = Math.round(Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, z)) * 100) / 100;
  return Math.abs(v - 1) < 0.03 ? 1 : v;
}

/** The pixels to a point a page `w` by `h` points has its writing drawn with, shown `px` px to the point on this screen. */
export function inkScale(w: number, h: number, px: number, dpr: number): number {
  const want = Math.max(1, px * dpr);
  const most = Math.sqrt(INK_MAX / Math.max(1, w * h));
  let got = INK_SCALES[0]!;
  for (const v of INK_SCALES) { if (v > most) break; got = v; if (v >= want - 0.01) break; }
  return got;
}

/** `v` px on a whole pixel of a screen with `dpr` pixels to the px. */
export const onPixel = (v: number, dpr: number): number => Math.round(v * dpr) / dpr;

/**
 * How wide the pages are drawn (milestone 86): the fitted width times the
 * zoom, on whole pixels of the screen, and, where they are narrower than the
 * pane and centred in it, leaving as many pixels either side: a page that
 * begins between two pixels is drawn across both, its print, its paper's
 * rules and what is written on it alike.
 */
export function pagesWidth(fitW: number, colW: number, zoom: number, dpr: number): number {
  const raw = fitW * zoom;
  if (!(colW > 0)) return raw;
  return raw < colW ? colW - 2 * onPixel((colW - raw) / 2, dpr) : onPixel(raw, dpr);
}

/** The room between two pages at a zoom, px: it grows with the pages, so a zoom is the same picture larger. */
export const pageGap = (zoom: number, dpr: number): number => Math.max(1 / dpr, onPixel(GAP * zoom, dpr));

/** Each page's top in the column (from index 1; `at[0]` is 0) and the column's height, every page as tall as whole pixels of the screen. */
export function pageTops(sizes: readonly { w: number; h: number }[], scale: number, gap: number, dpr: number): { at: number[]; total: number } {
  const at: number[] = [0];
  let y = 0;
  sizes.forEach((s, i) => { at[i + 1] = y; y += onPixel(s.h * scale, dpr) + (i < sizes.length - 1 ? gap : 0); });
  return { at, total: y };
}

interface Rect { left: number; top: number; width: number; height: number }

/** Each notebook open as a surface of the system's own has a name of its own (milestone 87). */
let surfaceSeq = 0;
/**
 * Whether a book's pages on an iPad are the native page view (`PdfSurface.swift`): a setting until it passes its
 * checks, off unless `ilmi.pdf.native` is `1` in this device's storage (the tweaks' `pages: native`, or a check).
 */
export function nativePdfOn(): boolean {
  try { return localStorage.getItem('ilmi.pdf.native') === '1'; } catch { return false; }
}
/** A book's native surface told what it is and holds (`ink_pdf`), only when that is not what it was last told. */
const pdfSaid = new Map<string, string>();
function sendPdfSurface(spec: Record<string, unknown> & { id: string }): void {
  const text = JSON.stringify(spec);
  if (pdfSaid.get(spec.id) === text) return;
  pdfSaid.set(spec.id, text);
  void import('@tauri-apps/api/core').then((m) => m.invoke('ink_pdf', { spec })).catch((e: unknown) => { pdfSaid.delete(spec.id); console.error(e); });
}
function dropPdfSurface(id: string): void {
  if (!pdfSaid.has(id)) return;
  pdfSaid.delete(id);
  void import('@tauri-apps/api/core').then((m) => m.invoke('ink_pdf', { spec: { id } })).catch(() => {});
}
const pdfDo = (ask: Record<string, unknown>): Promise<Record<string, unknown> | null> => import('@tauri-apps/api/core').then((m) => m.invoke<Record<string, unknown>>('ink_pdf_do', { ask })).catch(() => null);
/** Room left round a notebook's pages on its surface, px at fit: as the reader leaves round a PDF's. */
const SURFACE_PAD = { top: 18, side: 30, bottom: 80 };

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

/** Whether a note on the pages at `id` is open in the pane beside (a selector over the store). */
const notesBeside = (id: string) => (s: { docs: Record<string, DocInfo>; panes: Parameters<typeof besideAt>[0] }): boolean =>
  notesTabsOf(id, s.docs).some((tab) => besideAt(s.panes, tab) !== null);

export function Pdf({ id, active = true, session = false, readOn = false, onLast }: PdfProps) {
  const open = useApp(notesBeside(id));
  const mobile = useApp((s) => s.mobile);
  const [head, setHead] = useState<HTMLElement | null>(null);
  // a book open is its pages (milestone 70): the inspector closed until its toggle asks for it over this book
  // (the sidebar is left as it was: opening a book does not close the tree)
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
      <div className="book-pages"><Pages id={id} active={active} session={session} readOn={readOn} onLast={onLast} notesOpen={open} head={head} /></div>
      {/* under a finger the rows over the pages are the pane's, not the scroller's: a scroller pulled past its edge
          takes what sticks in it along (the row came loose from the pane's top and its left as the pages were
          pulled). They are drawn here, over the scroller (`book-head`; `Pages` puts them in), with the classes their
          look hangs on; after the scroller, so the first `.pdf-view` of a book is still its pages' */}
      {mobile && <div className="reader doc-view pdf-view book-head" ref={setHead} />}
    </div>
  );
}

/** The open collection's store, when it is one: where a page's strokes are. */
const inkStore = (): StoreFs | null => {
  const vault = currentVault();
  return vault && 'pageInk' in vault.fs ? (vault.fs as StoreFs) : null;
};


/** A notebook's pages, as many as it has sheets. */
const sheetSizes = (n: number, size: Size = { w: SHEET_W, h: SHEET_H }): Size[] => Array.from({ length: n }, () => ({ w: size.w, h: size.h }));

/**
 * A passage's boxes on the pages, what it is called, its state. `key` is
 * what it is known by here: a passage kept with the PDF by its boxes, a
 * boxed section of an older note (`section`) by its heading.
 */
interface Drawn {
  key: string;
  name: string;
  boxes: Box[];
  cards: number;
  dismissed: boolean;
  /** A boxed section of a note: where its heading is, and the note it is in. */
  section?: Passage;
  sectionIn?: string;
  /** A passage kept with the PDF: its line. */
  sched?: SectionSchedule;
}

function Pages({ id, active, session, readOn, onLast, notesOpen, head }: Omit<Required<PdfProps>, 'onLast'> & { onLast: PdfProps['onLast']; notesOpen: boolean; /** Where the rows over the pages are drawn on a device: the pane's own place for them, outside the scroller. */ head: HTMLElement | null }) {
  /** Whether the pages have a note yet: the bar's word is `create notes` until they do. */
  const hasNotes = useApp((st) => notesTabsOf(id, st.docs).length > 0);
  /** Whether one more note can be attached: the pages' PDF is a document of its own (`+` beside the notes' word). */
  const canAddNote = useApp((st) => pdfForNotes(id, st.docs) !== null);
  const lastRef = useRef(onLast);
  lastRef.current = onLast;
  const docs = useApp((s) => s.docs);
  const root = useApp((s) => s.vault);
  const caret = useApp((s) => s.caretHeading);
  const focus = useApp((s) => s.bookFocus);
  const mobile = useApp((s) => s.mobile);
  const phone = useApp((s) => s.phone);
  const info: DocInfo | undefined = docs[id];
  /** The notes on these pages: the document itself when it has pages, and every note attached to its PDF (`book.ts`); none yet for a PDF on its own with no note. */
  const notesKey = notesOf(id, docs).join('\n');
  const notes = useMemo(() => (notesKey === '' ? [] : notesKey.split('\n')), [notesKey]);
  const loadedNotes = useDocs(notes);
  /** A written notebook (milestone 82): its pages are its sheets, there from the start. */
  const written = info?.written;
  /** Its sheets run on as one (85): no gaps, no page count, nothing to add or delete by hand; it grows as it is written on. */
  const pageless = !!written?.pageless;
  /** A notebook's paper is dark (its own colour, or the theme's where it has none): what is written on it is drawn the dark way (87). */
  const inkDark = useApp((s) => (written ? paperLook(written, s.theme).dark : false));
  /** The page setup's panel is up. */
  const [setup, setSetup] = useState(false);
  /** Its sheets' size, as its page setup has it (85). */
  const { w: sheetW, h: sheetH } = sheetSize(written);
  const [status, setStatus] = useState<'loading' | 'ok' | 'gone' | 'unreadable'>(written ? 'ok' : 'loading');
  const statusRef = useRef(status);
  statusRef.current = status;
  /** Whether the collection has said what it holds: a document it has not spoken of yet is not one that has gone. */
  const docsKnown = useApp((s) => s.docsKnown);
  /** Why the file did not open, for the page to say; and how often it has been tried again. */
  const [fail, setFail] = useState<PdfFail | null>(null);
  const [tries, setTries] = useState(0);
  const [pdf, setPdf] = useState<PDFDocumentProxy | null>(null);
  const [sizes, setSizes] = useState<Size[]>(() => (written ? sheetSizes(written.sheets.length, sheetSize(written)) : []));
  const [textless, setTextless] = useState(false);
  /** The room the pages have: the pane's width inside its padding, and that padding (`left` the padding before them). */
  const [room, setRoom] = useState({ w: 0, pad: 0, left: 0 });
  /** This book's zoom: kept for the device with the collection's view state (`setBookZoom`), so it is there after a restart. */
  const zoom = useApp((s) => s.bookZooms[id] ?? 1);
  const zoomRef = useRef(zoom);
  zoomRef.current = zoom;
  /** One step in or out, or (0) back to fit. */
  const zoomBy = useCallback((dir: number) => {
    const z0 = useApp.getState().bookZooms[id] ?? 1;
    const z1 = zoomStep(z0, dir);
    // the bar's steps and the keys zoom about the middle of the view, as two fingers there would: what is under the
    // eye stays under it
    if (z1 !== z0) aboutMiddle.current();
    setBookZoom(id, z1);
  }, [id]);
  /** What is at the middle of the view is kept there through the next change of scale (set below). */
  const aboutMiddle = useRef<() => void>(() => {});
  const [tick, setTick] = useState(0);
  /** The pages' overview is up (85). */
  const [grid, setGrid] = useState(false);
  /** The row of tools is shown, not tucked away (`inkTools.ts`). */
  const toolsShown = useInkTools((s) => s.kept.shown);
  const [sel, setSel] = useState<Sel | null>(null);
  const [current, setCurrent] = useState(1);
  const currentRef = useRef(current);
  currentRef.current = current;
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
  const st = useRef({ sel, pending, find, goto, peek, looking, hints, naming, chord, ruler, lastHl });
  st.current = { sel, pending, find, goto, peek, looking, hints, naming, chord, ruler, lastHl };
  const canEnrol = !written && (info?.type === 'source' || info?.type === 'extract' || info?.type === 'note');
  const reading = !written && !!info?.read && info.type !== 'note';
  /** The PDF's file; a notebook has none. */
  const rel = written ? undefined : info?.pdf;
  // a notebook's sheets, in order: the page at place `n` of the column is sheet `sheets[n - 1]`
  const sheetsKey = written ? written.sheets.join(' ') : null;
  const sheets = useMemo(() => (sheetsKey === null ? null : sheetsKey.split(' ').filter(Boolean).map(Number)), [sheetsKey]);
  const sheetsRef = useRef(sheets);
  sheetsRef.current = sheets;
  /** The page at place `n` as it is known outside the column (its strokes' key, a box kept): a notebook's sheet number, a PDF's page itself. */
  const sheetAt = useCallback((n: number): number | null => (sheetsRef.current ? sheetAmong(sheetsRef.current, n) : n), []);
  /** The place in the column of what is known outside it as `sheet`; null for a sheet that is gone. */
  const placeOfSheet = useCallback((sheet: number): number | null => (sheetsRef.current ? placeAmong(sheetsRef.current, sheet) : sheet), []);
  /** Boxes as they leave the column: each names its sheet. */
  const boxesOut = (boxes: readonly Box[]): Box[] => boxes.flatMap((b) => { const s = sheetAt(b.page); return s === null ? [] : [{ ...b, page: s }]; });

  // ── what is written on the pages: found by the file's hash and the page ──
  /** The PDF's SHA-256, once its row is known. */
  const writtenId = written?.id;
  const hash = useMemo(() => {
    // a notebook's id stands where the hash does
    if (writtenId !== undefined) return writtenId;
    const vault = currentVault();
    return rel && vault && status !== 'gone' && status !== 'unreadable' ? inkStore()?.blobAt(vault.abs(rel)) ?? null : null;
  }, [rel, status, writtenId]);
  /**
   * On an iPad a notebook's pages are a surface of the system's own (milestone 87, `surface.ts`): one native scroll
   * view over the place the pages would be, its scroll and its zoom the system's, its paper and ink drawn there.
   * The bar, the menus, page setup, the overview and the box's bar stay this page's, over it.
   */
  const native = !!written && mobile && !phone && hasCanvas() && hash !== null;
  /**
   * On an iPad with the setting on, a book's pages are a native surface too (`PdfSurface.swift`): the system's scroll
   * and zoom, its tiles drawn on several cores, nothing laid out again when a zoom ends. The bar stays this page's.
   */
  // (the setting changed: drawn again, as the one or the other)
  const [, setNativeSaid] = useState(0);
  useEffect(() => { const f = () => setNativeSaid((t) => t + 1); window.addEventListener('ilmi-pdf-native', f); return () => window.removeEventListener('ilmi-pdf-native', f); }, []);
  const pdfSurf = !written && mobile && !phone && hasCanvas() && hash !== null && nativePdfOn();
  /** The rows over the pages are outside the scroller (a device's, where the pages are the page's own): nothing of them scrolls, or is pulled, with the pages. */
  const outside = mobile && !native && !pdfSurf;
  const overPages = (rows: ReactNode): ReactNode => (outside ? head && createPortal(rows, head) : rows);
  /** Something of the rows over the pages, wherever they are drawn. */
  const inBar = (sel: string): Element | null => (outside ? head : viewRef.current)?.querySelector(sel) ?? null;
  const inBarRef = useRef(inBar);
  inBarRef.current = inBar;
  const surfaceId = useMemo(() => `surface:${++surfaceSeq}`, []);
  const pdfSurfId = useMemo(() => `pdf:${++surfaceSeq}`, []);
  const [pdfSurfEl, setPdfSurfEl] = useState<HTMLDivElement | null>(null);
  /** Where the last box a held finger drew on the surface lies on the glass: its bar goes under it. */
  const [pdfPend, setPdfPend] = useState<{ x: number; y: number; w: number; h: number } | null>(null);
  const pdfSurfRef = useRef(false);
  const pdfSurfIdRef = useRef(pdfSurfId);
  const [surfaceEl, setSurfaceEl] = useState<HTMLDivElement | null>(null);
  /** What the surface last said: where the last box drawn lies (on the page), and whether the pages are moving. */
  const [surfaceAt, setSurfaceAt] = useState<{ pend: InkBox | null; moving: boolean; lay: readonly number[] | null }>({ pend: null, moving: false, lay: null });
  /** The zoom the surface has: what the store says is sent to it only when it is another. */
  const surfaceZoomAt = useRef<number | null>(null);
  const theme = useApp((s) => s.theme);
  /** What is left on the pages: the PDF's marks, read once and held (`book.ts`). */
  const marks = useMarks(hash);
  const marksRef = useRef(marks);
  marksRef.current = marks;
  const bookmarks = useMemo(() => bookmarksOf(marks), [marks]);
  const highlights = useMemo(() => highlightsOf(marks), [marks]);
  const portals = useMemo(() => portalsOf(marks), [marks]);
  /** The pages written on (as the store knows them: a notebook's by their sheets' numbers), each with a count that moves when its strokes do. */
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
  /**
   * A pageless notebook is one sheet (88), drawn as long as what is written on it and a little more (`runLength`):
   * `foot` is how far down it the lowest thing written reaches as the store has it, `len` how long it is drawn, in
   * points. It grows as it is written on and is never shorter while it is open; null until the store has said, and
   * for pages. On an iPad the surface keeps the length itself once it is told the foot.
   */
  const [runLen, setRunLen] = useState<{ foot: number; len: number } | null>(null);
  /** Moves when the notebook is opened again in a lens that was kept (its tab shown again): the sheet is then as long as what is written, whatever it was. */
  const [runOpened, setRunOpened] = useState(0);
  const writtenRef = useRef(written);
  writtenRef.current = written;
  useEffect(() => () => setRunLen(null), [id]);
  // (an iPad's surface is told once: what is written there afterwards it has itself)
  const runSeen = native ? 0 : inked;
  const runSheets = native ? '' : sheetsKey;
  useEffect(() => {
    if (!pageless || writtenId === undefined) { setRunLen(null); return; }
    let live = true;
    // (first, a sheet that holds strokes and was lost from the list in a merge is listed again)
    void healSheets(id, writtenId, sheetsRef.current ?? []).then((list) => inkFoot(writtenId, list, sheetH)).then((foot) => {
      const w = writtenRef.current;
      if (!live || !w) return;
      const len = runLength(paperOf(w, 0), foot);
      setRunLen((was) => (was && was.len >= len && was.foot >= foot ? was : { foot: Math.max(foot, was?.foot ?? 0), len: Math.max(len, was?.len ?? 0) }));
    }, console.error);
    return () => { live = false; };
  }, [id, pageless, writtenId, sheetH, runSeen, runSheets, runOpened, written?.paper, written?.rule, written?.top]);
  /** A notebook's pages near the view, by place: only these are drawn as paper with their writing's picture (a PDF's page is drawn as it comes near, `renderPage`). */
  const [near, setNear] = useState<{ lo: number; hi: number } | null>(null);
  const isNear = (n: number): boolean => near !== null && n >= near.lo && n <= near.hi;
  /** The pages a canvas lies over just now: their pictures stand aside. */
  const [liveInk, setLiveInk] = useState<ReadonlySet<number>>(new Set());
  const inkedRef = useRef(inked);
  inkedRef.current = inked;
  /** Waiting for a page's picture to be on the screen. */
  const shownWaits = useRef(new Map<number, () => void>());
  const pictureShown = useCallback((n: number) => { shownWaits.current.get(n)?.(); shownWaits.current.delete(n); }, []);

  const runRef = useRef(pageless);
  runRef.current = pageless;
  /** The notebook's last sheet a page was added after by itself: once for each. */
  const addedAfter = useRef<number | null>(null);
  // ── written on where the Pencil lands: the pages near the screen are sheets, each lying where its page lies ──
  useEffect(() => {
    const fs = inkStore();
    const sc = wrapRef.current?.closest<HTMLElement>('.book-pages, .pane-body');
    if (!hash || !fs || !sc || !hasCanvas() || status !== 'ok' || native) return;
    const hostId = `pages:${id}`;
    const sheetOf = (n: number) => `p.${hash}.${n}`;
    const pageOfSheet = (sheet: string): number | null => (sheet.startsWith(`p.${hash}.`) ? Number(sheet.slice(hash.length + 3)) : null);
    /** What each sheet was last filled at: the count a page's strokes move by. */
    const filled = new Map<number, number>();
    const fill = (n: number) => {
      const rev = inkedRef.current[n];
      // (a phone's notebook is read from the page's own drawing of its strokes: nothing is written there, and
      // PencilKit's canvas drew a thin stroke a pixel wide whatever its width, soft at the edge. Its canvases rest.)
      const shown = !(sheetsRef.current && useApp.getState().phone);
      const as = rev === undefined ? undefined : shown ? rev : -1 - rev;
      if (rev === undefined || filled.get(n) === as) return;
      filled.set(n, as!);
      if (!shown) {
        setLiveInk((s) => { if (!s.has(n)) return s; const next = new Set(s); next.delete(n); return next; });
        void restSheet(sheetOf(n));
        return;
      }
      // the canvas stays on the screen with what the page holds (85): the writing is drawn from its strokes at rest as it
      // is while written, at whatever size the page is; the picture of it stands aside once the canvas has it
      afterScene(() => void fillSheet(sheetOf(n), pagePaper(fs, hash, n), () => fs.pageInkFile(hash, n, 'drawing'), true)
        .then((took) => { if (took) setLiveInk((s) => (s.has(n) ? s : new Set(s).add(n))); })
        .catch((e: unknown) => { filled.delete(n); console.error(e); }));
    };
    const surface: Surface = {
      host() {
        if (!sc.isConnected || !sc.getClientRects().length) return null;
        const { view, port, top, left, height } = portOf(sc, inBarRef.current('.meta'));
        if (port.w <= 0 || port.h <= 0 || covered(sc, port)) return { id: hostId, view, port: { ...port, h: 0 }, top, left, height, open: null, sheets: [] };
        const column = pagesRef.current;
        const sheets: SheetSpec[] = [];
        const there = new Set<number>();
        const dark = document.documentElement.dataset.theme === 'dark';
        for (const [place, el] of pageEls.current) {
          // a notebook's page is written on under its sheet's own number
          const n = sheetAt(place);
          if (n === null) continue;
          const r = inContent(sc, el);
          if (r.y + r.h < top - AHEAD || r.y > top + view.h + AHEAD) continue;
          // a pageless notebook's sheet is written on past its foot: a stroke begun on it runs on over the next, whole
          // (a PDF's page draws what is written on it itself, 89: its canvas is for the stroke under the Pencil)
          sheets.push({ id: sheetOf(n), frame: sheetsRef.current && runRef.current ? { ...r, h: r.h * (1 + RUN_OVER) } : r, hit: r, zoom: scaleRef.current, blend: dark ? 'screen' : 'multiply', ...(sheetsRef.current ? {} : { vector: true }) });
          there.add(n);
          fill(n);
        }
        // a page gone far has no canvas: its picture is what there is of its writing until it comes near again
        setLiveInk((s) => ([...s].every((n) => there.has(n)) ? s : new Set([...s].filter((n) => there.has(n)))));
        return { id: hostId, view, port, top, left, height, open: null, sheets, ...(column && !column.style.transform ? { pages: inContent(sc, column), zoom: { z: zoomRef.current, min: ZOOM_MIN, max: ZOOM_MAX } } : {}) };
      },
      made(sheet) {
        const n = pageOfSheet(sheet);
        if (n === null) return;
        // a canvas made anew holds nothing yet: the picture shows until it does
        setLiveInk((s) => { if (!s.has(n)) return s; const next = new Set(s); next.delete(n); return next; });
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
        // a notebook never runs out of paper: a stroke begun low on its last page adds the next, once for that page
        const list = sheetsRef.current;
        if (!list || list[list.length - 1] !== n || addedAfter.current === n || e.y === undefined) return;
        const el = pageEls.current.get(list.length);
        if (!el) return;
        const r = inContent(sc, el);
        if (e.y < r.y + r.h * ADD_FROM) return;
        addedAfter.current = n;
        void addSheet(id).catch((err: unknown) => { addedAfter.current = null; console.error(err); });
      },
      async kept(sheet: string) {
        // kept: the canvas stays as it is, on the screen. Nothing is swapped for it, so nothing blinks or goes soft
        const n = pageOfSheet(sheet);
        if (n !== null) setLiveInk((s) => (s.has(n) ? s : new Set(s).add(n)));
      },
    };
    const off = addSurface(surface);
    // (89) a page the canvases' side says is written on has a place to be drawn in, before the store has heard of it
    const offLive = onLiveSheet((sheet) => { const n = pageOfSheet(sheet); if (n !== null) setLiveInk((s) => (s.has(n) ? s : new Set(s).add(n))); });
    const onScroll = () => sceneSoon();
    sc.addEventListener('scroll', onScroll, { passive: true });
    return () => { sc.removeEventListener('scroll', onScroll); offLive(); off(); };
  }, [hash, status, id, sheetAt, native]);
  // ── a notebook's surface (87): what it says, and what it is given of the store ──
  const surfaceHears = useRef<(e: import('./ink.js').SurfaceEvent) => void>(() => {});
  useEffect(() => {
    const fs = inkStore();
    if (!native || !hash || !fs) return;
    const sheetOf = (n: number) => `p.${hash}.${n}`;
    const pageOfSheet = (sheet: string): number | null => (sheet.startsWith(`p.${hash}.`) ? Number(sheet.slice(hash.length + 3)) : null);
    /** The sheets the surface has asked for, each with the count its strokes were last given at. */
    const given = new Map<number, number>();
    const fill = (n: number) => {
      given.set(n, inkedRef.current[n] ?? 0);
      const sheet = sheetOf(n);
      void fillSheet(sheet, pagePaper(fs, hash, n), () => fs.pageInkFile(hash, n, 'drawing'), true).catch((e: unknown) => { given.delete(n); console.error(e); });
    };
    wantedRef.current = { given, fill };
    // what is written on its sheets is kept through the same door as a canvas's: it has no host of the page's
    const surface: Surface = {
      host: () => null,
      paper(sheet) {
        const n = pageOfSheet(sheet);
        return n === null ? null : pagePaper(fs, hash, n);
      },
      async kept() { /* the surface shows what it holds */ },
    };
    const off = addSurface(surface);
    const offEars = onSurface(surfaceId, (e) => {
      if (e.what === 'want') {
        for (const sheet of e.sheets ?? []) {
          const n = pageOfSheet(sheet);
          if (n === null) continue;
          // the surface holds nothing of it yet: it is given what the store holds, whatever was given before
          forgetSheet(sheet);
          fill(n);
        }
        return;
      }
      surfaceHears.current(e);
    });
    return () => { off(); offEars(); wantedRef.current = null; };
  }, [native, hash, surfaceId]);
  /** The sheets the surface holds, and how one is given what the store holds. */
  const wantedRef = useRef<{ given: Map<number, number>; fill(n: number): void } | null>(null);
  // strokes come by a merge, or written on another device: a sheet the surface holds is given them
  useEffect(() => {
    const w = wantedRef.current;
    if (!native || !w) return;
    for (const [n, was] of w.given) if ((inked[n] ?? 0) !== was) w.fill(n);
  }, [native, inked]);
  // ── a notebook's pages: its sheets, with nothing to load ──
  useEffect(() => {
    if (writtenId === undefined) return;
    return () => { setSizes([]); setStatus('loading'); };
  }, [id, writtenId]);
  useEffect(() => {
    if (!sheets) return;
    setBase(0);
    setPdf(null);
    setTextless(false);
    setSizes((was) => (was.length === sheets.length && was.every((s) => s.w === sheetW && s.h === sheetH) ? was : sheetSizes(sheets.length, { w: sheetW, h: sheetH })));
    setStatus('ok');
    lastRef.current?.(sheets.length);
  }, [sheets, id, writtenId, sheetW, sheetH]);
  // ── the file, shared with the notes' crops ──
  const range = info?.pages;
  // a file whose opening took the page down with it (a device with too little memory for it: the page comes back
  // white, and a tab kept from last time would do it again at every start) is not opened by itself a second time:
  // it says so, and `try again` is the reader's to press
  useEffect(() => {
    if (!rel) return;
    if (fellOpening(rel) && tries === 0) {
      // marked by a page before this one: held back only if that page's process was taken from under it (the app
      // says so, `page_fell`). An app closed while a file was opening left the same mark and took nothing down
      let asking = true;
      void pageFell().then((fell) => {
        if (!asking) return;
        if (fell) {
          setFail({ kind: 'fell', said: 'this pdf closed the page the last time it was opened', detail: 'it may be too large for this device · it is not opened again by itself' });
          setStatus('unreadable');
        } else {
          forgetOpening(rel);
          setTries((n) => n + 1);
        }
      });
      return () => { asking = false; };
    }
    let live = true;
    opening(rel);
    const held = acquirePdf(rel);
    rendered.current.clear();
    texts.current.clear();
    lines.current.clear();
    links.current.clear();
    tokens.current.clear();
    outline.current = null;
    // the system reads every page's size in a moment (`pdf_sizes`), long before the library has the file open: the
    // pages are laid out at once, each shown as its small picture (`lowUrl`), and the library sharpens them when it comes
    const early: { got: Size[] | null } = { got: null };
    const hashNow = picturesOf(rel)?.hash;
    if (hashNow) {
      void pageSizes(hashNow).then((all) => {
        if (!live || !all || !all.length || early.got) return;
        const lo = Math.max(1, Math.min(range?.first ?? 1, all.length));
        const hi = Math.max(lo, Math.min(range?.last ?? all.length, all.length));
        early.got = all.slice(lo - 1, hi);
        if (statusRef.current === 'ok') return;
        lastRef.current?.(hi);
        setBase(lo - 1);
        setSizes(early.got);
        setStatus('ok');
      });
    }
    (async () => {
      const doc = await held.promise;
      if (!live) return;
      const out: Size[] = [];
      let hasText = false;
      // only the document's own pages when it names a range; a range past the file's end is cut to it
      const lo = Math.max(1, Math.min(range?.first ?? 1, doc.numPages));
      const hi = Math.max(lo, Math.min(range?.last ?? doc.numPages, doc.numPages));
      if (early.got && early.got.length === hi - lo + 1) {
        // laid out already, by the system's sizes: the library is only what sharpens them, and whether they have text
        // is asked of the first few behind the reader's back
        setPdf(doc);
        void (async () => {
          let has = false;
          for (let n = lo; n <= Math.min(hi, lo + PROBE - 1) && !has; n++) has = (await pageBits(await doc.getPage(n))).some((b) => b.str.trim() !== '');
          if (live) setTextless(!has);
        })().catch(console.error);
        return;
      }
      // every page's size, while that is quick: a long book on a slow device is shown once its first pages are
      // known, the rest taken to be the size of the last one read, and put right when they have been read (a book's
      // pages are nearly always one size, so nothing moves)
      const began = Date.now();
      let n = lo;
      for (; n <= hi; n++) {
        if (n >= lo + PROBE && Date.now() - began > SIZES_WAIT) break;
        const page = await doc.getPage(n);
        if (!live) return;
        const v = page.getViewport({ scale: 1 });
        out.push({ w: v.width, h: v.height });
        if (n < lo + PROBE && !hasText) hasText = (await pageBits(page)).some((b) => b.str.trim() !== '');
      }
      const read = out.length;
      const like = out[read - 1]!;
      while (out.length < hi - lo + 1) out.push({ w: like.w, h: like.h });
      if (!live) return;
      lastRef.current?.(hi);
      setBase(lo - 1);
      setPdf(doc);
      setSizes(out);
      setTextless(!hasText);
      setStatus('ok');
      // (it is still held to be opening: its pages are yet to be drawn, which is what a device has no room for. The
      // mark goes a few seconds after the last of them is, `settled` below)
      if (read < out.length) {
        const exact = out.slice();
        let differs = false;
        for (let k = read; k < exact.length; k++) {
          const v = (await doc.getPage(lo + k)).getViewport({ scale: 1 });
          if (!live) return;
          if (Math.abs(v.width - like.w) > 0.01 || Math.abs(v.height - like.h) > 0.01) { exact[k] = { w: v.width, h: v.height }; differs = true; }
          // (the page's own work comes first: a breath every few pages)
          if (k % 8 === 0) await new Promise((r) => setTimeout(r, 0));
          if (!live) return;
        }
        if (differs) setSizes(exact);
      }
    })().catch(async (e: unknown) => {
      console.error(id, e);
      opening(null);
      // a file that is there and will not open is not one that has gone; and why it did not is said
      const vault = currentVault();
      const st = vault ? await vault.fs.stat(vault.abs(rel)).catch(() => null) : null;
      const there = vault ? st !== null : true;
      const away = !!vault && !!(vault.fs as Partial<StoreFs>).isAway?.(vault.abs(rel));
      if (!live) return;
      setFail(pdfFail(e, there, away, st?.size ?? 0));
      setStatus(there ? 'unreadable' : 'gone');
    });
    return () => {
      live = false;
      // left while it was still opening (the tab closed, another document): that is not a fall
      if (openingStill(rel)) opening(null);
      held.release();
      setPdf(null);
      setSizes([]);
      setStatus('loading');
    };
  }, [id, rel, range?.first, range?.last, tries]);

  // a PDF that did not open is tried again by itself when what it waited for may have come: the file landing in the
  // collection, its bytes arriving on this device, a sync or a fetch ending; and every so often while its bytes are
  // on their way. (`try again` on the page does the same at once.)
  useEffect(() => {
    if (!rel || (status !== 'unreadable' && status !== 'gone') || (fail?.kind !== 'away' && fail?.kind !== 'absent')) return;
    const vault = currentVault();
    let timer: ReturnType<typeof setTimeout> | null = null;
    const soon = (ms = 600) => { if (timer) clearTimeout(timer); timer = setTimeout(() => setTries((n) => n + 1), ms); };
    const isAway = () => useApp.getState().away.includes(rel);
    let wasAway = isAway();
    let wasBusy = !!useApp.getState().sync.busy;
    const offStore = useApp.subscribe((st) => {
      const [nowAway, nowBusy] = [st.away.includes(rel), !!st.sync.busy];
      if ((wasAway && !nowAway) || (wasBusy && !nowBusy)) soon();
      wasAway = nowAway;
      wasBusy = nowBusy;
    });
    const offVault = vault?.subscribe((ev) => { if (ev.kind === 'tree' || (ev.kind === 'doc' && ev.path === rel)) soon(); });
    const every = setInterval(() => setTries((n) => n + 1), 20_000);
    return () => { offStore(); offVault?.(); if (timer) clearTimeout(timer); clearInterval(every); };
  }, [rel, status, fail?.kind]);

  // the library has the file open (the pages were laid out before it, by the system's sizes): the pages in view are
  // drawn now, as a scroll would have them drawn. (Not left to the observer: a covered window holds its word back.)
  useEffect(() => {
    if (!pdf || status !== 'ok') return;
    const t = setTimeout(() => scrollerOf.current?.()?.dispatchEvent(new Event('scroll')), 0);
    return () => clearTimeout(t);
  }, [pdf, status]);

  // every page near the view, and further on the way the reader is going, has its small picture under it (the
  // system's drawing, asked for as a picture: a few milliseconds each, off this thread): a page is never bare paper
  // while it scrolls in, is flung to, or is jumped to. They are let go far behind
  const lowDir = useRef<{ at: number; down: boolean }>({ at: 0, down: true });
  useEffect(() => {
    if (status !== 'ok' || written || !sizes.length) return;
    const at = picturesOf(rel);
    if (!at) return;
    if (current !== lowDir.current.at) lowDir.current = { at: current, down: current >= lowDir.current.at };
    const [behind, ahead] = lowDir.current.down ? [LOW_BEHIND, LOW_AHEAD] : [LOW_AHEAD, LOW_BEHIND];
    for (const [n, el] of pageEls.current) {
      const img = el.querySelector<HTMLImageElement>(':scope > img.pg-low');
      const near = n >= current - behind && n <= current + ahead;
      if (near && !img) {
        const made = document.createElement('img');
        made.className = 'pg-low';
        made.alt = '';
        made.decoding = 'async';
        made.draggable = false;
        made.src = lowUrl(at, n);
        el.prepend(made);
      } else if (img && (n < current - behind - 12 || n > current + ahead + 12)) img.remove();
      // (a middle-sized picture is let go as soon as its page is a few pages from the view)
      if (n < current - MID_KEEP || n > current + MID_KEEP) el.querySelector(':scope > img.pg-mid')?.remove();
      // where the app draws tiles, the pages about the one in view show their middle-sized picture, and those further
      // on have it made and kept on disk ahead of a zoom out or a scroll, the nearest first (not shown: only asked)
      else if (tilesRef.current && Math.abs(n - current) <= MID_SHOW) midRef.current(n, el);
    }
    if (tilesRef.current) {
      for (let d = MID_SHOW + 1; d <= MID_WARM; d++) {
        for (const n of [current + d, current - d]) {
          if (n < base + 1 || n > base + sizes.length || warmed.current.has(`${at.hash}:${n}`)) continue;
          warmed.current.add(`${at.hash}:${n}`);
          void fetch(`${lowUrl(at, n, MID_W, 0.85)}&k=mid&p=${600 + d}`).then((r) => r.arrayBuffer(), () => null).catch(() => null);
        }
      }
    }
  }, [status, written, sizes.length, rel, current, hash, base]);
  /** The middle-sized pictures asked to be made ahead, by book and page. */
  const warmed = useRef(new Set<string>());

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
  const dpr = typeof window === 'undefined' ? 1 : window.devicePixelRatio || 1;
  const pageW = pagesWidth(fitW, colW, zoom, dpr);
  /** Zoomed past the pane: the pages scroll sideways, the words over them stay. */
  const wide = colW > 0 && pageW > colW;
  /** The sections' names sit beside the page only where a centred page leaves them the room. */
  const roomy = (colW - pageW) / 2 + room.pad >= TAG_ROOM;
  const scale = colW > 0 ? pageW / maxW : 1;
  /** Each page's top, px from the top of the column, and the column's height. */
  // (a pageless notebook's sheets run on as one: nothing between them)
  const tops = useMemo(() => pageTops(sizes, scale, pageless ? 0 : pageGap(zoom, dpr), dpr), [sizes, scale, pageless, zoom, dpr]);

  /** How high the pages' column is drawn, px: a pageless notebook's ends where its one long sheet does (88), the sheets past that not shown. */
  const colH = useMemo(() => {
    if (!pageless || !runLen || !sizes.length) return tops.total;
    const k = Math.min(sizes.length - 1, Math.max(0, Math.floor(runLen.len / sheetH - 1e-9)));
    return Math.min(tops.total, (tops.at[k + 1] ?? 0) + onPixel(Math.min(sheetH, runLen.len - k * sheetH) * scale, dpr));
  }, [pageless, runLen, sizes, tops, sheetH, scale, dpr]);

  /** How much of the page at `i` (from 0) is shown, px from its top: all of it, but for a pageless notebook's sheets at and past its foot. */
  const cutAt = (i: number): number => { const full = onPixel((sizes[i]?.h ?? 0) * scale, dpr); return colH < tops.total ? Math.min(full, colH - (tops.at[i + 1] ?? 0)) : full; };

  const first = base + 1;
  const last = base + sizes.length;
  /** A page's place in the column, px; null for a page not shown. */
  const pageRect = useCallback((n: number): Rect | null => {
    const s = sizes[n - base - 1];
    if (!s) return null;
    return { left: 0, top: tops.at[n - base] ?? 0, width: onPixel(s.w * scale, dpr), height: onPixel(s.h * scale, dpr) };
  }, [sizes, base, tops, scale, dpr]);
  const boxRect = useCallback((b: Box): Rect | null => {
    const p = pageRect(b.page);
    return p && { left: p.left + b.x * p.width, top: p.top + b.y * p.height, width: b.w * p.width, height: b.h * p.height };
  }, [pageRect]);

  // whatever is drawn over the pages (a cue, a peek, the search) is told to the canvases, which stand aside for it
  useEffect(() => { sceneSoon(); });
  // a new scale, or strokes come by a merge: the canvases are told
  useEffect(() => { sceneSoon(); }, [scale, sizes, inked, room, sheets]);

  // ── rendering, as pages come near ──
  const scaleRef = useRef(scale);
  scaleRef.current = scale;
  /** The scale the pages have at fit. */
  const fit = scale / zoom;
  const renderRef = useRef<(n: number) => Promise<void>>(async () => {});
  // a file is held to be opening (`opening`) until its pages near the view have been drawn and stayed drawn a
  // while: a page that goes down while they are drawn is one this file took down
  const settleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const relRef = useRef(rel);
  relRef.current = rel;
  const settled = () => {
    if (settleTimer.current) clearTimeout(settleTimer.current);
    settleTimer.current = setTimeout(() => { settleTimer.current = null; const r = relRef.current; if (r && openingStill(r)) opening(null); }, OPENED_MS);
  };
  useEffect(() => () => { if (settleTimer.current) clearTimeout(settleTimer.current); }, []);
  const scrollerOf = useRef<(() => HTMLElement | null) | null>(null);
  const pdfRef = useRef(pdf);
  pdfRef.current = pdf;
  // What a page shows, bottom to top: its small picture (`img.pg-low`), a middle-sized one where its drawing is not
  // yet as fine (`img.pg-mid`), its drawing whole (`canvas.pg-base`), the part of it in view drawn sharp where the
  // whole drawing is coarser than the screen (`canvas.pg-detail`, zoomed in), and its text. Whatever is drawn stays
  // until what takes its place has been drawn: a zoom first stretches the pixels there are (the canvases fill the
  // page's box), and nothing shown is ever taken away for something with less in it (pdf.js's own viewer does the
  // same: `PDFPageView`'s css zoom and its detail canvas).
  /** The device pixels across a page at the scale it is laid out at, and down it; null for a page not laid out. */
  const needOf = (el: HTMLElement): { w: number; h: number } | null => {
    const full = window.devicePixelRatio || 1;
    const w = parseFloat(el.style.width); const h = parseFloat(el.style.height);
    return w > 0 && h > 0 ? { w: Math.round(w * full), h: Math.round(h * full) } : null;
  };
  /** The most pixels across a page's whole drawing has here at this size. */
  const capOf = (need: { w: number; h: number }): number => {
    const most = useApp.getState().mobile ? BASE_MAX_MOBILE : CANVAS_MAX;
    return Math.min(need.w, Math.floor(need.w * Math.sqrt(most / Math.max(1, need.w * need.h))));
  };
  /** Whether a page's whole drawing will do at the size it is laid out at: as fine as it can be here (or nearly, where
   * the part in view is drawn over it), and not so much finer that it is a waste to hold. */
  const baseWill = (el: HTMLElement, base: HTMLCanvasElement): boolean => {
    const need = needOf(el);
    if (!need) return true;
    const cap = capOf(need);
    if (base.width > need.w * 2.6) return false;
    return cap >= need.w * 0.98 ? base.width >= need.w * 0.98 : base.width >= cap * 0.7;
  };
  /** What of a page is in view, as fractions of it; null where none is. */
  const inView = (el: HTMLElement): { x0: number; y0: number; x1: number; y1: number } | null => {
    const r = scrollerOf.current?.()?.getBoundingClientRect();
    const pr = el.getBoundingClientRect();
    if (!r || pr.width < 1 || pr.height < 1) return null;
    const x0 = Math.max(0, (r.left - pr.left) / pr.width); const x1 = Math.min(1, (r.right - pr.left) / pr.width);
    const y0 = Math.max(0, (r.top - pr.top) / pr.height); const y1 = Math.min(1, (r.bottom - pr.top) / pr.height);
    return x1 > x0 && y1 > y0 ? { x0, y0, x1, y1 } : null;
  };
  // ── tiles from the system (round 2) ──
  // Where the app can draw a PDF's pages itself (`ilmipage:`, Core Graphics on a few threads at once), the sharp page
  // is drawn by it in tiles (`img.pg-tile`, bands `TILE_W` × `TILE_H` at the size the page is shown) for what is in view
  // and a little about it, nearest the middle of the view first; pdf.js gives only the text, the search and the links.
  // A zoom keeps the tiles it has (their layer lies over the page by fractions of it, so it stretches with it) under
  // the new zoom's, and lets them go once the new ones cover the view. The page's middle-sized picture
  // (`img.pg-mid`, `MID_W` across, kept on disk by the app) lies under the tiles of every page near the view, so a
  // page zoomed out to, or scrolled to, shows at once.
  /** Whether this book's pages are the app's drawing (tiles), not pdf.js's canvases. */
  const tilesRef = useRef(false);
  // (`window.ilmiNoTiles`, dev: pdf.js's canvases as before, to measure the one against the other)
  tilesRef.current = !native && !pdfSurf && !written && useApp.getState().mobile && !!picturesOf(rel) && !(import.meta.env.DEV && (window as unknown as { ilmiNoTiles?: boolean }).ilmiNoTiles);
  /** The generation of the tiles asked for: a zoom makes a new one, and the app does not draw an older one's asking still waiting. */
  const tileGen = useRef(0);
  // (one count for every book open, ever larger: a book opened again asks with a generation past what the app was last told for it)
  if (tileGen.current === 0) tileGen.current = ++tileGens.n;
  /** This reader's own name for its generations (a book may be open in two panes). */
  const tileReader = useRef(0);
  if (tileReader.current === 0) tileReader.current = ++tileGens.readers;
  /** The zoom the pages were last laid out at, for the zoom log's `from`. */
  const zoomWas = useRef<number | null>(null);
  /** The tiles asked for and not yet come, by their address within the page (`n:scale:x:y`). */
  const tileAsked = useRef(new Map<string, number>());
  /** The zoom being followed for the zoom log: from, to, when, and what it has come to so far. */
  const zoomRec = useRef<{ from: number; to: number; t0: number; pictured: number | null; sharp: number | null; tiles: number; tileMs: number; text: number; most: number } | null>(null);
  /** The tiles' layer of page `el` for scale `s`, made where there is none: over the pictures and any canvas, under the text. */
  const layerOf = (el: HTMLElement, s: number): HTMLElement => {
    const key = String(s);
    let l = Array.from(el.querySelectorAll<HTMLElement>(':scope > .pg-tiles')).find((x) => x.dataset.scale === key);
    if (!l) {
      l = document.createElement('div');
      l.className = 'pg-tiles';
      l.dataset.scale = key;
      const text = el.querySelector(':scope > .textLayer');
      if (text) text.before(l); else el.append(l);
    }
    return l;
  };
  /** The tiles a page wants at the scale there is: the ones over what is in view and about it (`MARGIN` of the view each way), nearest first. */
  const tilesFor = (el: HTMLElement): { x: number; y: number; w: number; h: number; far: number; seen: boolean }[] => {
    const need = needOf(el);
    const sc = scrollerOf.current?.();
    if (!need || !sc) return [];
    const r = sc.getBoundingClientRect();
    const pr = el.getBoundingClientRect();
    if (pr.width < 1) return [];
    const k = need.w / pr.width;
    const mx = r.width * TILE_MARGIN_X; const my = r.height * TILE_MARGIN_Y;
    // the view and what is about it, in the page's pixels as drawn
    const vx0 = (r.left - pr.left) * k; const vx1 = (r.right - pr.left) * k; const vy0 = (r.top - pr.top) * k; const vy1 = (r.bottom - pr.top) * k;
    const ax0 = Math.max(0, vx0 - mx * k); const ax1 = Math.min(need.w, vx1 + mx * k); const ay0 = Math.max(0, vy0 - my * k); const ay1 = Math.min(need.h, vy1 + my * k);
    if (ax1 <= ax0 || ay1 <= ay0) return [];
    const cx = (vx0 + vx1) / 2; const cy = (vy0 + vy1) / 2;
    const out: { x: number; y: number; w: number; h: number; far: number; seen: boolean }[] = [];
    for (let y = Math.floor(ay0 / TILE_H) * TILE_H; y < ay1; y += TILE_H) {
      for (let x = Math.floor(ax0 / TILE_W) * TILE_W; x < ax1; x += TILE_W) {
        const w = Math.min(TILE_W, need.w - x); const h = Math.min(TILE_H, need.h - y);
        const seen = x < vx1 && x + w > vx0 && y < vy1 && y + h > vy0;
        out.push({ x, y, w, h, far: Math.hypot(x + w / 2 - cx, y + h / 2 - cy) / k, seen });
      }
    }
    return out.sort((a, b) => a.far - b.far);
  };
  /** Whether a page's tiles at the scale there is cover what of it is in view. */
  const tilesCover = (el: HTMLElement): boolean => {
    const l = el.querySelector<HTMLElement>(`:scope > .pg-tiles[data-scale="${scaleRef.current}"]`);
    if (!l) return false;
    const have = new Set(Array.from(l.children).map((t) => (t as HTMLElement).dataset.at));
    return tilesFor(el).every((t) => !t.seen || have.has(`${t.x},${t.y}`));
  };
  /** Whether a page in view shows a picture of itself (a tile, its middle-sized or its small picture, a canvas). */
  const pictured = (el: HTMLElement): boolean => !!el.querySelector(':scope > canvas') || Array.from(el.querySelectorAll<HTMLImageElement>(':scope > img.pg-low, :scope > img.pg-mid, :scope > .pg-tiles > img')).some((i) => i.complete && i.naturalWidth > 0);
  /** The tiles every page in view wants, asked for (the app draws them nearest first); those come let older layers go. */
  const askTiles = () => {
    const at = picturesOf(relRef.current);
    const sc = scrollerOf.current?.();
    if (!at || !sc || !tilesRef.current) return;
    const r = sc.getBoundingClientRect();
    const s = scaleRef.current;
    const g = tileGen.current;
    let allSharp = true; let allPictured = true; let any = false;
    for (const [n, el] of pageEls.current) {
      const pr = el.getBoundingClientRect();
      const visible = pr.height > 0 && pr.bottom > r.top && pr.top < r.bottom;
      if (!visible) {
        // a page a screen or more away keeps no tiles of another zoom
        if (pr.height > 0 && (pr.bottom < r.top - r.height || pr.top > r.bottom + r.height)) for (const l of Array.from(el.querySelectorAll<HTMLElement>(':scope > .pg-tiles'))) if (l.dataset.scale !== String(s)) l.remove();
        continue;
      }
      any = true;
      if (!pictured(el)) allPictured = false;
      const need = needOf(el);
      if (!need) continue;
      const want = tilesFor(el);
      const layer = layerOf(el, s);
      const have = new Map(Array.from(layer.children).map((t) => [(t as HTMLElement).dataset.at, t as HTMLElement]));
      // tiles of this zoom that have gone far from the view are let go (a page zoomed far in has hundreds)
      const keep = new Set(want.map((t) => `${t.x},${t.y}`));
      for (const [k, t] of have) if (!keep.has(k!)) { const pr2 = t.getBoundingClientRect(); if (pr2.bottom < r.top - r.height * 1.5 || pr2.top > r.bottom + r.height * 1.5 || pr2.right < r.left - r.width || pr2.left > r.right + r.width) t.remove(); }
      for (const t of want) {
        const id = `${n}:${s}:${t.x}:${t.y}`;
        if (have.has(`${t.x},${t.y}`)) continue;
        if (t.seen) allSharp = false;
        if (tileAsked.current.has(id)) continue;
        tileAsked.current.set(id, performance.now());
        const img = new Image();
        img.decoding = 'async';
        img.className = 'pg-tile';
        img.alt = '';
        img.draggable = false;
        img.dataset.at = `${t.x},${t.y}`;
        Object.assign(img.style, { left: `${(t.x / need.w) * 100}%`, top: `${(t.y / need.h) * 100}%`, width: `${(t.w / need.w) * 100}%`, height: `${(t.h / need.h) * 100}%` });
        // the lower the sooner: those in view first, nearest the middle first
        const p = Math.round(t.far / 8) + (t.seen ? 0 : 400);
        img.src = `ilmipage://localhost/${at.hash}/${n}?root=${encodeURIComponent(at.root)}&w=${need.w}&x=${t.x}&y=${t.y}&tw=${t.w}&th=${t.h}&k=tile&f=${TILE_FORMAT}&q=0.92&p=${p}&g=${g}&gk=${at.hash}:${tileReader.current}`;
        const asked = performance.now();
        img.decode().then(() => {
          tileAsked.current.delete(id);
          // (another zoom since: its layer is gone or not this one's; what it was asked for is gone)
          if (scaleRef.current !== s || !layer.isConnected) return;
          layer.append(img);
          const rec = zoomRec.current;
          if (rec) { rec.tiles++; rec.tileMs += performance.now() - asked; }
          tilesLanded();
        }, () => { tileAsked.current.delete(id); });
      }
    }
    noteZoom(any, allPictured, allSharp);
    if (viewRef.current) viewRef.current.dataset.tiles = `${tileAsked.current.size} ${allSharp ? 'sharp' : 'wanting'} g${g}`;
  };
  /** A tile has come: where a page's view is covered at this zoom, the layers of other zooms go. */
  const tilesLanded = () => {
    const s = String(scaleRef.current);
    for (const el of pageEls.current.values()) {
      const old = Array.from(el.querySelectorAll<HTMLElement>(':scope > .pg-tiles')).filter((l) => l.dataset.scale !== s);
      // (once the new tiles have come in all the way: they come in by opacity)
      if (old.length && tilesCover(el)) setTimeout(() => { if (tilesCover(el)) for (const l of old) l.remove(); }, 160);
    }
    tilesSoon();
  };
  /** The zoom being followed, written to the zoom log once its view has all been pictured and all been sharp. */
  const noteZoom = (any: boolean, allPictured: boolean, allSharp: boolean) => {
    const rec = zoomRec.current;
    if (!rec || !any) return;
    const t = performance.now() - rec.t0;
    if (allPictured && rec.pictured === null) rec.pictured = t;
    if (allSharp && rec.sharp === null) rec.sharp = t;
    if ((rec.sharp !== null && rec.pictured !== null) || t > 20000) {
      zoomRec.current = null;
      void import('@tauri-apps/api/core').then((m) => m.invoke('zoom_log', { line: `zoom from=${rec.from} to=${rec.to} sharp=${rec.sharp === null ? 'never' : rec.sharp.toFixed(0)} pictured=${rec.pictured === null ? 'never' : rec.pictured.toFixed(0)} tiles=${rec.tiles} tile_ms_mean=${rec.tiles ? (rec.tileMs / rec.tiles).toFixed(0) : '-'} text=${rec.text} asked_most=${rec.most} mobile=${useApp.getState().mobile ? 1 : 0}` })).catch(() => {});
      if (viewRef.current) viewRef.current.dataset.zoomLog = `${rec.sharp?.toFixed(0) ?? 'never'} ${rec.pictured?.toFixed(0) ?? 'never'}`;
    } else rec.most = Math.max(rec.most, tileAsked.current.size);
  };
  const tilesTimer = useRef(0);
  /** The tiles asked for in the next frame (once, however often asked). */
  const tilesSoon = () => {
    if (tilesTimer.current || !tilesRef.current) return;
    tilesTimer.current = requestAnimationFrame(() => { tilesTimer.current = 0; askTiles(); });
    // (a covered window holds frames back)
    setTimeout(() => { if (tilesTimer.current) { cancelAnimationFrame(tilesTimer.current); tilesTimer.current = 0; askTiles(); } }, 120);
  };
  const tilesSoonRef = useRef(tilesSoon);
  tilesSoonRef.current = tilesSoon;
  /** What a page wants drawn next: the whole of it, the part in view sharp over it, or nothing; where the app draws tiles, only its text. */
  const wants = (n: number): 'base' | 'detail' | 'text' | null => {
    const el = pageEls.current.get(n);
    if (!el) return null;
    if (tilesRef.current) return rendered.current.has(n) ? null : 'text';
    if (rendered.current.get(n) !== scaleRef.current) return 'base';
    const base = el.querySelector<HTMLCanvasElement>(':scope > canvas.pg-base');
    const need = needOf(el);
    if (!base || !need || base.width >= need.w * 0.98) return null;
    const v = inView(el);
    if (!v) return null;
    const d = el.querySelector<HTMLCanvasElement>(':scope > canvas.pg-detail');
    const e = 1e-4;
    if (d && Number(d.dataset.scale) === scaleRef.current && Number(d.dataset.x0) <= v.x0 + e && Number(d.dataset.y0) <= v.y0 + e && Number(d.dataset.x1) >= v.x1 - e && Number(d.dataset.y1) >= v.y1 - e) return null;
    return 'detail';
  };
  const wantsRef = useRef(wants);
  wantsRef.current = wants;
  /**
   * A page's middle-sized picture from the system (`ilmipage:`, off this thread, a few milliseconds), for a page in
   * view whose drawing is not there yet or is coarser: as many pixels as the page has on the screen, up to
   * `MID_MAX`. Zoomed out, that is the page sharp at once; anywhere, far finer than the small picture while the
   * library draws it.
   */
  const midFor = (n: number, el: HTMLElement) => {
    const at = picturesOf(relRef.current);
    const need = needOf(el);
    if (!at || !need) return;
    const w = tilesRef.current ? MID_W : Math.min(MID_MAX, Math.ceil(need.w / 128) * 128);
    const base = el.querySelector<HTMLCanvasElement>(':scope > canvas.pg-base');
    if (base && base.width >= Math.min(w, need.w) * 0.95) return;
    const was = el.querySelector<HTMLImageElement>(':scope > img.pg-mid');
    if (was && Number(was.dataset.w) >= Math.min(w, need.w) * 0.95) return;
    const img = document.createElement('img');
    img.className = 'pg-mid';
    img.alt = '';
    img.decoding = 'async';
    img.draggable = false;
    img.dataset.w = String(w);
    // (an older one, coarser, goes once this one has come)
    img.onload = () => { if (was?.isConnected) was.remove(); };
    // (a page in view: about as soon as the tiles nearest the middle, it is one picture; else after the tiles in view)
    img.src = `${lowUrl(at, n, w, 0.85)}&k=mid&p=${(inView(el) ? 40 : 200) + Math.abs(n - currentRef.current)}`;
    const low = el.querySelector(':scope > img.pg-low');
    if (was) was.after(img); else if (low) low.after(img); else el.prepend(img);
  };
  const midRef = useRef(midFor);
  midRef.current = midFor;
  const renderPage = useCallback(async (n: number) => {
    const el = pageEls.current.get(n);
    if (!el || !pdf || rendering.current.has(n) || !wantsRef.current(n)) return;
    // zoomed out, a page coming into view has its middle-sized picture at once: there it is the page sharp. (At fit
    // and over, the small picture serves the pages a scroll brings, as before; a zoom asks for the pages in view)
    if ((tilesRef.current || zoomRef.current < 1) && inView(el)) midRef.current(n, el);
    if (tilesRef.current) tilesSoonRef.current();
    // on a device one page is drawn at a time (a heavy page's drawing takes a great deal of memory while it lasts),
    // and of the pages waiting it is the one nearest the middle of the view that is drawn next: a page the reader
    // has flung past is not drawn at all, and the one they have stopped on does not wait behind those
    const one = useApp.getState().mobile;
    if (one) {
      waiting.current.add(n);
      if (drawing.current) return;
      drawing.current = true;
      try {
        for (;;) {
          const sc = scrollerOf.current?.();
          const r = sc?.getBoundingClientRect();
          let pick = -1; let best = Infinity;
          for (const k of waiting.current) {
            const pr = pageEls.current.get(k)?.getBoundingClientRect();
            if (!r || !pr || pr.height <= 0 || pr.bottom < r.top - AHEAD || pr.top > r.bottom + AHEAD || !wantsRef.current(k)) { waiting.current.delete(k); continue; }
            const far = Math.abs((pr.top + pr.bottom) / 2 - (r.top + r.bottom) / 2);
            if (far < best) { best = far; pick = k; }
          }
          if (pick < 0) break;
          waiting.current.delete(pick);
          await drawRef.current(pick);
        }
      } finally {
        drawing.current = false;
      }
      return;
    }
    await drawRef.current(n);
  }, [pdf, id]);
  const waiting = useRef(new Set<number>());
  const drawing = useRef(false);
  const drawRef = useRef<(n: number) => Promise<void>>(async () => {});
  /** What a page wants drawn, drawn now, at the scale there is; and then whatever it wants next. */
  const drawPage = useCallback(async (n: number) => {
    const el = pageEls.current.get(n);
    if (!el || !pdf || rendering.current.has(n)) return;
    const what = wantsRef.current(n);
    if (!what) return;
    rendering.current.add(n);
    try {
      const page = await pdf.getPage(n);
      if (what === 'detail') await drawDetail(n, el, page);
      else if (what === 'text') await drawText(n, el, page);
      else await drawBase(n, el, page);
    } catch (e) {
      console.error(id, `page ${n}`, e);
    } finally {
      rendering.current.delete(n);
    }
    // another zoom while it was drawn, or the part in view to draw after the whole: drawn next
    if (pageEls.current.get(n) === el && wantsRef.current(n)) void renderRef.current(n);
  }, [pdf, id]);
  /** A page's text, search and links from pdf.js, where the app draws the page itself: kept across zooms (it follows by the scale alone). */
  const drawText = async (n: number, el: HTMLElement, page: PDFPageProxy) => {
    const t0 = performance.now();
    const viewport = page.getViewport({ scale: scaleRef.current });
    const layer = document.createElement('div');
    layer.className = 'textLayer';
    el.style.setProperty('--total-scale-factor', String(scaleRef.current));
    el.querySelector(':scope > .textLayer')?.remove();
    el.append(layer);
    const tl = new TextLayer({ textContentSource: page.streamTextContent(), container: layer, viewport });
    await tl.render();
    if (!links.current.has(n)) {
      try {
        const v1 = page.getViewport({ scale: 1 });
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
    rendered.current.set(n, scaleRef.current);
    setTick((t) => t + 1);
    settled();
    const ms = performance.now() - t0;
    if (zoomRec.current) zoomRec.current.text++;
    void import('@tauri-apps/api/core').then((m) => m.invoke('zoom_log', { line: `draw kind=pdfjs-text page=${n} all=${ms.toFixed(1)}` })).catch(() => {});
  };
  /** A page drawn whole, at the scale there is when it begins. */
  const drawBase = async (n: number, el: HTMLElement, page: PDFPageProxy) => {
    const at = scaleRef.current;
    const viewport = page.getViewport({ scale: at });
    const full = window.devicePixelRatio || 1;
    // the canvas fills the page's box, which lies on whole pixels of the screen: where the screen's own pixels are
    // drawn, each pixel of the canvas is one of the screen's, none between two (86). Zoomed in past what a page's
    // whole drawing may hold (`capOf`), fewer: the part in view is drawn sharp over it
    const box = { w: onPixel(viewport.width, full), h: onPixel(viewport.height, full) };
    const most = useApp.getState().mobile ? BASE_MAX_MOBILE : CANVAS_MAX;
    const px = Math.min(full, Math.max(0.5, Math.sqrt(most / Math.max(1, box.w * box.h))));
    const canvas = document.createElement('canvas');
    canvas.className = 'pg-base';
    canvas.width = Math.max(1, Math.round(box.w * px));
    canvas.height = Math.max(1, Math.round(box.h * px));
    canvas.style.width = '100%';
    canvas.style.height = '100%';
    // the print intent draws without animation frames, which WebKit holds back in a covered window
    const t0 = performance.now();
    await page.render({ canvas, viewport, intent: 'print', transform: [canvas.width / viewport.width, 0, 0, canvas.height / viewport.height, 0, 0] }).promise;
    if (import.meta.env.DEV) await slowDraw(canvas.width * canvas.height, performance.now() - t0);
    const had = el.querySelector<HTMLCanvasElement>(':scope > canvas.pg-base');
    // zoomed again while it was drawn: what it is drawn for is gone. It goes in only where it is finer than what is shown
    if (scaleRef.current !== at && had && had.width >= canvas.width) {
      canvas.width = canvas.height = 0;
      rendered.current.set(n, baseWill(el, had) ? scaleRef.current : -1);
      return;
    }
    if (!el.isConnected || pageEls.current.get(n) !== el) { canvas.width = canvas.height = 0; return; }
    const layer = document.createElement('div');
    layer.className = 'textLayer';
    // (the text follows the scale the pages are laid out at by this alone: its places are fractions of the page)
    el.style.setProperty('--total-scale-factor', String(scaleRef.current));
    const tl = new TextLayer({ textContentSource: page.streamTextContent(), container: layer, viewport });
    // over the page's pictures, which stay under it; where the page had no drawing yet it comes in over them (opacity
    // alone), and where it had one (another zoom) it takes its place at once, with no blink. The part in view drawn
    // sharp over the last drawing stays while it is finer than this one
    const low = el.querySelector(':scope > img.pg-low');
    const mid = el.querySelector<HTMLImageElement>(':scope > img.pg-mid');
    const detail = el.querySelector<HTMLCanvasElement>(':scope > canvas.pg-detail');
    const need = needOf(el);
    const keep = detail && need && canvas.width < need.w * 0.98 ? detail : null;
    if (!had) canvas.classList.add('pg-new');
    el.replaceChildren(...[low, mid, canvas, keep, layer].filter((x): x is Element => !!x));
    if (had) had.width = had.height = 0;
    if (detail && !keep) detail.width = detail.height = 0;
    // the middle-sized picture goes once the drawing is as fine and has come in over it
    if (mid && canvas.width >= Number(mid.dataset.w ?? 0) * 0.95) setTimeout(() => { if (mid.isConnected && el.querySelector(':scope > canvas.pg-base') === canvas) mid.remove(); }, had ? 0 : 400);
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
    // drawn for the scale there is, or one that will do for it; else drawn again (and this stays until then)
    rendered.current.set(n, scaleRef.current === at || baseWill(el, canvas) ? scaleRef.current : -1);
    setTick((t) => t + 1);
    settled();
  };
  /**
   * The part of a page in view drawn sharp over its whole drawing, which is coarser than the screen (zoomed in), with
   * room about it as the pixels allow (pdf.js's detail canvas): it lies over the page by fractions of it, so a zoom
   * stretches it with the page. The one before stays until this one is drawn.
   */
  const drawDetail = async (n: number, el: HTMLElement, page: PDFPageProxy) => {
    const at = scaleRef.current;
    const v = inView(el);
    const need = needOf(el);
    if (!v || !need) return;
    const viewport = page.getViewport({ scale: at });
    const vw = (v.x1 - v.x0) * need.w; const vh = (v.y1 - v.y0) * need.h;
    const over = Math.max(0, Math.min(1, (Math.sqrt(DETAIL_MAX / Math.max(1, vw * vh)) - 1) / 2));
    // on whole pixels of the page as drawn at this scale, so the part lies pixel for pixel on the screen's
    const px0 = Math.max(0, Math.floor((v.x0 - (v.x1 - v.x0) * over) * need.w)); const px1 = Math.min(need.w, Math.ceil((v.x1 + (v.x1 - v.x0) * over) * need.w));
    const py0 = Math.max(0, Math.floor((v.y0 - (v.y1 - v.y0) * over) * need.h)); const py1 = Math.min(need.h, Math.ceil((v.y1 + (v.y1 - v.y0) * over) * need.h));
    if (px1 <= px0 || py1 <= py0) return;
    const canvas = document.createElement('canvas');
    canvas.className = 'pg-detail';
    canvas.width = px1 - px0;
    canvas.height = py1 - py0;
    const sx = need.w / viewport.width; const sy = need.h / viewport.height;
    const t0 = performance.now();
    await page.render({ canvas, viewport, intent: 'print', transform: [sx, 0, 0, sy, -px0, -py0] }).promise;
    if (import.meta.env.DEV) await slowDraw(canvas.width * canvas.height, performance.now() - t0);
    // zoomed again meanwhile: what it was drawn for is gone, and what is shown stays
    if (scaleRef.current !== at || !el.isConnected || pageEls.current.get(n) !== el || !el.querySelector(':scope > canvas.pg-base')) { canvas.width = canvas.height = 0; return; }
    Object.assign(canvas.dataset, { scale: String(at), x0: String(px0 / need.w), y0: String(py0 / need.h), x1: String(px1 / need.w), y1: String(py1 / need.h) });
    Object.assign(canvas.style, { left: `${(px0 / need.w) * 100}%`, top: `${(py0 / need.h) * 100}%`, width: `${((px1 - px0) / need.w) * 100}%`, height: `${((py1 - py0) / need.h) * 100}%` });
    const old = el.querySelector<HTMLCanvasElement>(':scope > canvas.pg-detail');
    if (old) { old.replaceWith(canvas); old.width = old.height = 0; } else el.querySelector(':scope > canvas.pg-base')?.after(canvas);
  };
  drawRef.current = drawPage;
  renderRef.current = renderPage;

  const scroller = () => wrapRef.current?.closest<HTMLElement>('.book-pages, .pane-body') ?? null;
  scrollerOf.current = scroller;
  /** How much taller the bar is for the tools' row under its words (an iPad's, `InkBar.tsx`); 0 with none. */
  const barExtra = (): number => (outside ? null : viewRef.current?.querySelector('.meta > .inkbar'))?.getBoundingClientRect().height ?? 0;
  /** How far down the view the place kept is: under the whole bar. */
  const placeAt = (): number => (outside ? PLACE_OUT : PLACE_AT + barExtra());
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
  /** Where a pinch let go: the page between the fingers, where in it (0 to 1 each way), and where on the screen. */
  const pinchEnd = useRef<{ page: number; x: number; y: number; cx: number; cy: number } | { left: number; top: number; x: number; y: number } | null>(null);
  aboutMiddle.current = () => {
    const sc = scroller();
    if (!sc || native) return;
    const r = sc.getBoundingClientRect();
    const cx = r.left + r.width / 2;
    const cy = (r.top + placeAt() + r.bottom) / 2;
    let under: { page: number; x: number; y: number } | null = null;
    let near = Infinity;
    for (const [k, el] of pageEls.current) {
      const pr = el.getBoundingClientRect();
      if (!(pr.width > 0 && pr.height > 0)) continue;
      const far = cy < pr.top ? pr.top - cy : cy > pr.bottom ? cy - pr.bottom : 0;
      if (far < near) { near = far; under = { page: k, x: (cx - pr.left) / pr.width, y: (cy - pr.top) / pr.height }; }
    }
    pinchEnd.current = under ? { ...under, cx, cy } : null;
  };
  /**
   * How far the scroller's content runs past the right edge of pages wider than the pane, as the web view lays it
   * out, measured whenever they are: WebKit leaves the pane's right padding out of what scrolls, so a pinch's plan
   * that counted it left the pages scrolled further than they can be, and the layout put them back, a jump sideways
   * of up to the padding in the frame after the pinch.
   */
  const trailRef = useRef<number | null>(null);
  /** What the pages are laid out by, for saying where they would lie at another zoom. */
  const layRef = useRef({ fitW: 0, colW: 0, pageW: 0, maxW: 612, scale: 1, left: 0, pad: 0, sizes: [] as Size[], pageless: false, total: 0, at: [0] as number[] });
  layRef.current = { fitW, colW, pageW, maxW, scale, left: room.left, pad: room.pad, sizes, pageless, total: colH, at: tops.at };
  /** Whether the pages can be written on: two fingers tapped are undo only then. */
  const canWriteRef = useRef(false);
  /** The pages have landed where they open (the place left, the read point, a section gone to): from here a scroll is the reader's, and remembered. */
  const landed = useRef(false);

  useEffect(() => {
    if (!pdf || !sizes.length) return;
    // a new scale: a page near the view keeps all it has (its canvases fill its box, so they are the same picture
    // larger or smaller, and its text follows by the scale alone), and is drawn again only where that is too coarse
    // for the screen now, or so much finer that it is a waste to hold; until then what it has stays. A page far from
    // the view gives its drawing back (its small picture stays under it: a page is never bare paper)
    if (tilesRef.current) {
      // the app's tiles: what is asked of an older zoom is not drawn, and the new zoom's are asked for
      tileGen.current = ++tileGens.n;
      const at = picturesOf(rel);
      if (at) void import('@tauri-apps/api/core').then((m) => m.invoke('pages_generation', { hash: `${at.hash}:${tileReader.current}`, g: tileGen.current })).catch(() => {});
      const from = zoomWas.current;
      zoomWas.current = zoom;
      if (from !== null && from !== zoom) zoomRec.current = { from, to: zoom, t0: performance.now(), pictured: null, sharp: null, tiles: 0, tileMs: 0, text: 0, most: 0 };
      for (const [n, el] of pageEls.current) if (inView(el)) midFor(n, el);
      tilesSoon();
    } else {
      const sc = scroller();
      const view = sc?.getBoundingClientRect();
      for (const [n, s] of rendered.current) {
        if (s === scale || rendering.current.has(n)) continue;
        const el = pageEls.current.get(n);
        const base = el?.querySelector<HTMLCanvasElement>(':scope > canvas.pg-base');
        const r = el?.getBoundingClientRect();
        if (el && base && view && r && r.bottom >= view.top - AHEAD && r.top <= view.bottom + AHEAD) {
          const will = baseWill(el, base);
          rendered.current.set(n, will ? scale : -1);
          // the part in view drawn sharp over it goes where the whole drawing is as fine as the screen now
          const need = needOf(el);
          const detail = el.querySelector<HTMLCanvasElement>(':scope > canvas.pg-detail');
          if (detail && need && base.width >= need.w * 0.98) { detail.remove(); detail.width = detail.height = 0; }
        } else if (el) {
          rendered.current.delete(n);
          for (const c of Array.from(el.querySelectorAll('canvas'))) { c.width = 0; c.height = 0; }
          const low = el.querySelector(':scope > img.pg-low');
          el.replaceChildren(...(low ? [low] : []));
        }
      }
      // the pages in view whose drawing is not as fine as the screen now have their middle-sized pictures at once
      for (const [n, el] of pageEls.current) if (inView(el) && wantsRef.current(n) === 'base') midFor(n, el);
    }
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
      const top = r.top + 70 + barExtra();
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
      // the app's tiles for what has come into view
      tilesSoonRef.current();
      // the place at the top of the view, for when the pages are drawn at another scale
      const from = r.top + placeAt();
      place.current = null;
      for (const [k, el] of pageEls.current) {
        const pr = el.getBoundingClientRect();
        if (pr.top <= from && pr.bottom > from) place.current = { page: k, y: (from - pr.top) / pr.height };
      }
      const cr = pagesRef.current?.getBoundingClientRect();
      placeX.current = cr && cr.width > 0 ? (r.left + r.width / 2 - cr.left) / cr.width : null;
      if (landed.current) places.set(id, { top: sc.scrollTop, at: place.current, x: placeX.current });
      // a notebook's pages near the view are the ones drawn as paper
      if (sheetsRef.current) {
        let lo = Infinity;
        let hi = -Infinity;
        for (const [k, el] of pageEls.current) {
          const pr = el.getBoundingClientRect();
          if (pr.height > 0 && pr.bottom >= r.top - AHEAD && pr.top <= r.bottom + AHEAD) { lo = Math.min(lo, k); hi = Math.max(hi, k); }
        }
        setNear((was) => (lo > hi ? was : was && was.lo === lo && was.hi === hi ? was : { lo, hi }));
      }
      // the pages near the view drawn here too: a covered window may hold the observer's callbacks back
      for (const [k, el] of pageEls.current) {
        const pr = el.getBoundingClientRect();
        if (pr.bottom >= r.top - AHEAD && pr.top <= r.bottom + AHEAD) void renderPage(k);
        // zoomed, a page is many times the canvas it is at fit: one far from the view gives it back, and draws again as it comes near.
        // On a device at any zoom: every page read through kept its drawing, sixty of them some 600 MB, and a
        // device takes the page's process away long before a book has been read through
        else if ((zoomRef.current > 1 || useApp.getState().mobile) && pr.height > 0 && (pr.bottom < r.top - FAR || pr.top > r.bottom + FAR) && rendered.current.has(k) && !rendering.current.has(k)) {
          rendered.current.delete(k);
          // (a canvas of no size gives its pixels back at once, not when it is collected)
          for (const c of Array.from(el.querySelectorAll('canvas'))) { c.width = 0; c.height = 0; }
          const low = el.querySelector(':scope > img.pg-low');
          el.replaceChildren(...(low ? [low] : []));
          // and the reader lets go of what it worked out to draw it
          const doc = pdfRef.current;
          if (doc) void doc.getPage(k).then((pg) => { (pg as unknown as { cleanup?: () => void }).cleanup?.(); }, () => {});
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
    // (a page's text is laid out by the scale alone: it follows in the frame the pages are laid out at it)
    for (const el of pageEls.current.values()) if (el.style.getPropertyValue('--total-scale-factor')) el.style.setProperty('--total-scale-factor', String(scale));
    const sc = scroller();
    if (!sc) return;
    // a pinch let go: the pages are laid out at their new size, and what was between the fingers is still there
    const held = pinchEnd.current;
    pinchEnd.current = null;
    if (pagesRef.current) { pagesRef.current.style.transform = ''; pagesRef.current.style.willChange = ''; }
    {
      const L = layRef.current;
      const pr = pagesRef.current?.getBoundingClientRect();
      if (pr && L.pageW > L.colW) trailRef.current = Math.max(0, sc.scrollWidth - (pr.left - sc.getBoundingClientRect().left + sc.scrollLeft + pr.width));
    }
    if (held && 'left' in held) {
      // (86) the pages were eased to where this layout puts them: the scroller stands where that was reckoned, and the
      // canvases, held as they were shown, are told once
      sc.scrollLeft = held.left;
      sc.scrollTop = held.top;
      const pages = pagesRef.current;
      const pr = pages?.getBoundingClientRect();
      if (pr && viewRef.current) viewRef.current.dataset.zoomOff = Math.max(Math.abs(pr.left - held.x), Math.abs(pr.top - held.y)).toFixed(2);
      // where the scroller cannot stand where it was reckoned (its content ends sooner than the plan said), the pages
      // are shown where they were eased to and come the rest of the way by a transform: nothing jumps
      const dx = pr ? held.x - pr.left : 0; const dy = pr ? held.y - pr.top : 0;
      if (pages && (Math.abs(dx) > 0.5 || Math.abs(dy) > 0.5)) {
        const t = `translate(${dx}px, ${dy}px)`;
        if (viewRef.current) viewRef.current.dataset.zoomEase = `${dx.toFixed(1)},${dy.toFixed(1)}`;
        pages.style.transform = t;
        requestAnimationFrame(() => requestAnimationFrame(() => {
          if (pages.style.transform !== t) return;
          pages.style.transition = `transform ${SETTLE_MS}ms ease-out`;
          pages.style.transform = '';
          setTimeout(() => { pages.style.transition = ''; }, SETTLE_MS + 40);
        }));
      }
      holdScenes(false);
      return;
    }
    const under = held ? pageEls.current.get(held.page) : undefined;
    if (held && under) {
      const pr = under.getBoundingClientRect();
      sc.scrollLeft += pr.left + held.x * pr.width - held.cx;
      sc.scrollTop += pr.top + held.y * pr.height - held.cy;
      return;
    }
    const at = place.current;
    const el = at ? pageEls.current.get(at.page) : undefined;
    if (at && el) {
      const pr = el.getBoundingClientRect();
      sc.scrollTop += pr.top + at.y * pr.height - (sc.getBoundingClientRect().top + placeAt());
    }
    if (placeX.current !== null) centreOn(sc, placeX.current);
  }, [scale]);

  // a pinch on a trackpad (WebKit sends it as a wheel with ctrl held) steps the zoom once a gesture
  useEffect(() => {
    const sc = scroller();
    if (!sc) return;
    let last = -Infinity;
    /** When the zoom last stepped for a pinch: a web view that says one pinch both ways (a wheel and a gesture) steps once. */
    let steppedAt = -Infinity;
    const onWheel = (e: WheelEvent) => {
      if (!e.ctrlKey) return;
      e.preventDefault();
      const fresh = e.timeStamp - last > PINCH_GAP;
      // a gesture's first event that says which way is the step; the rest of it only keeps the gesture alive
      if (!fresh || e.deltaY !== 0) last = e.timeStamp;
      if (fresh && e.deltaY !== 0 && e.timeStamp - steppedAt > PINCH_GAP) { steppedAt = e.timeStamp; zoomBy(e.deltaY < 0 ? 1 : -1); }
    };
    sc.addEventListener('wheel', onWheel, { passive: false });
    // (two fingers on the glass are heard by the canvases' side, below. Nothing here answers WebKit's own gesture
    // events: a page that says no to them has every recogniser on the web view held back, that one among them, and
    // the page is not the system's to magnify anyway: the viewport says so)
    return () => { sc.removeEventListener('wheel', onWheel); };
  }, [status, zoomBy]);

  // the row of tools tucked away or brought back: what is on the screen stays where it is under the eye
  const barWas = useRef<number | null>(null);
  useLayoutEffect(() => {
    const sc = scroller();
    const now = barExtra();
    // (at the very top there is nothing to keep still: the pages simply have the room, or give it back)
    if (sc && barWas.current !== null && now !== barWas.current && landed.current && sc.scrollTop > 0) sc.scrollTop += now - barWas.current;
    barWas.current = now;
  }, [toolsShown]);

  // ── two fingers on the glass (85) ──
  // Spread or closed, the pages grow and shrink under them, about the place between them; let go, the pages are laid
  // out at that size (anywhere between the least and the most) with the same place still between the fingers, and
  // drawn sharp at it. While the fingers are down the pages are only stretched (a transform, nothing laid out), and
  // the canvases over them are stretched alike (`pinchSheets`); the scroller still scrolls under the two fingers as
  // it does, and the stretch follows it. Two fingers down and up at once are undo, three redo, where the pages can
  // be written on. The fingers are heard by the canvases' side (`onFingers`, `ink.ts`): where a finger draws the
  // page itself is not told of touches on a sheet.
  useEffect(() => {
    const sc = scroller();
    const pages = pagesRef.current;
    if (!sc || !pages || status !== 'ok') return;
    const hostId = `pages:${id}`;
    interface Pinch {
      /** The zoom the pages had. */
      z0: number;
      /** The place between the fingers as it began, in the pages' own px. */
      ax: number; ay: number;
      /** Where the pages' corner was on the screen and in the scroller's content, and how far the scroller was scrolled. */
      left: number; top: number; ox: number; oy: number; sl: number; st: number;
      k: number; cx: number; cy: number;
    }
    let g: Pinch | null = null;
    // (the word's own text node is written to, the one React holds: a node put in its place would be one React no longer writes to)
    const say = (z: number) => { const t = inBarRef.current('.pt-pct')?.firstChild; if (t && t.nodeType === 3) t.nodeValue = `${Math.round(z * 100)}%`; };
    /** How far the pages are moved for the place they were taken by to lie between the fingers, stretched by `k`. */
    const shift = (p: Pinch) => ({ x: p.cx - (p.left - (sc.scrollLeft - p.sl)) - p.k * p.ax, y: p.cy - (p.top - (sc.scrollTop - p.st)) - p.k * p.ay });
    const draw = () => {
      if (!g) return;
      const t = shift(g);
      pages.style.transformOrigin = '0 0';
      pages.style.willChange = 'transform';
      pages.style.transform = `translate(${t.x}px, ${t.y}px) scale(${g.k})`;
      pinchSheets(hostId, { k: g.k, dx: g.ox + t.x - g.k * g.ox, dy: g.oy + t.y - g.k * g.oy });
      say(zoomHeld(g.z0 * g.k));
    };
    const undraw = () => { pages.style.transform = ''; pages.style.willChange = ''; pinchSheets(hostId, null); say(zoomRef.current); };
    /** Whether a place on the screen is on these pages: in their scroller, under the bar, with nothing of the page's over it. */
    const here = (x: number, y: number): boolean => {
      if (!sc.isConnected || !sc.getClientRects().length) return false;
      const r = sc.getBoundingClientRect();
      const bar = inBarRef.current('.meta')?.getBoundingClientRect().bottom ?? r.top;
      if (x < r.left || x > r.right || y < Math.max(r.top, bar) || y > r.bottom) return false;
      const at = document.elementFromPoint(x, y);
      return !!at && sc.contains(at) && !at.closest('.page-grid, .ink-menu');
    };
    const onScroll = () => { if (g) draw(); };
    sc.addEventListener('scroll', onScroll, { passive: true });
    // ── (86) the zoom the glass does itself ──
    // The canvases' side stretches the pages under the fingers, this column's own layer and the canvases over it at
    // once, and says nothing here but how far (for the bar's word). Let go, it says where the place the pages were
    // taken by is; here it is reckoned where the pages will lie laid out at the zoom they stopped at (the same picture
    // larger: the room between pages grows with them), kept inside what the scroller can show; the pages are eased
    // there, the column is given the same stretch as its own, and then laid out in one go with the scroller put where
    // it was reckoned: nothing moves when the layout takes over, and the canvases are told once.
    interface Plan { z: number; k: number; tx: number; ty: number; left: number; top: number; x: number; y: number }
    /** A zoom of the glass's going on: the zoom it began from, and where the pages are going. */
    let n: { z0: number; plan: Plan | null } | null = null;
    const plan = (z1: number, lx: number, ly: number, cx: number, cy: number): Plan => {
      const L = layRef.current;
      const px = window.devicePixelRatio || 1;
      const W1 = pagesWidth(L.fitW, L.colW, z1, px);
      const k = L.pageW > 0 ? W1 / L.pageW : 1;
      const scale1 = W1 / L.maxW;
      const tops1 = pageTops(L.sizes, scale1, L.pageless ? 0 : pageGap(z1, px), px);
      // the place in the column as it will be laid out: on the page it is on, as far down it
      let y1 = ly * k;
      for (let i = 0; i < L.sizes.length; i++) {
        const a = L.at[i + 1] ?? 0;
        const h = onPixel(L.sizes[i]!.h * L.scale, px);
        if (ly >= a && ly <= a + h) { y1 = (tops1.at[i + 1] ?? 0) + ((ly - a) / h) * onPixel(L.sizes[i]!.h * scale1, px); break; }
      }
      const sr = sc.getBoundingClientRect();
      const pr = pages.getBoundingClientRect();
      const ox = pr.left - sr.left + sc.scrollLeft;
      const oy = pr.top - sr.top + sc.scrollTop;
      // the column's left in the content: centred under the pane's width, at the pane's padding past it
      const edge = ox - (L.pageW < L.colW ? (L.colW - L.pageW) / 2 : 0);
      const wide1 = W1 > L.colW;
      const ox1 = edge + (wide1 ? 0 : (L.colW - W1) / 2);
      const maxL = wide1 ? Math.max(0, edge + W1 + (trailRef.current ?? 0) - sc.clientWidth) : 0;
      const maxT = Math.max(0, sc.scrollHeight - L.total + tops1.total - sc.clientHeight);
      const left = Math.min(maxL, Math.max(0, onPixel(ox1 + lx * k - (cx - sr.left), px)));
      const top = Math.min(maxT, Math.max(0, onPixel(oy + y1 - (cy - sr.top), px)));
      const x = sr.left + ox1 - left;
      const y = sr.top + oy - top;
      if (import.meta.env.DEV && viewRef.current) viewRef.current.dataset.zoomPlan = [ox, edge, trailRef.current ?? -1, maxL, left, W1, L.pageW, L.colW, sc.clientWidth, sc.scrollWidth, lx, cx - sr.left].map((v) => Math.round(v * 10) / 10).join(' ');
      return { z: z1, k, tx: x - pr.left, ty: y - pr.top + (y1 - ly * k), left, top, x, y };
    };
    /** `f` once what was just set has been drawn: two frames on, or soon where frames are held back. */
    const drawn = (f: () => void) => {
      let done = false;
      const run = () => { if (!done) { done = true; f(); } };
      requestAnimationFrame(() => requestAnimationFrame(run));
      setTimeout(run, 150);
    };
    const start = () => { holdScenes(true); viewRef.current?.setAttribute('data-pinch', '1'); };
    /** The pages are shown where `p` put them: the column takes that stretch as its own, and is then laid out as it is shown. */
    const handOver = (p: Plan, stretched: boolean) => {
      const go = () => {
        n = null;
        viewRef.current?.removeAttribute('data-pinch');
        if (p.z === zoomRef.current) {
          // no other size: only the scroller moves
          pages.style.transform = '';
          sc.scrollLeft = p.left;
          sc.scrollTop = p.top;
          say(zoomRef.current);
          holdScenes(false);
          pinchSheets(hostId, null);
          return;
        }
        pinchEnd.current = { left: p.left, top: p.top, x: p.x, y: p.y };
        setBookZoom(id, p.z);
        // (where nothing is laid out, the stretch is taken off here)
        setTimeout(() => { if (pinchEnd.current) { pinchEnd.current = null; pages.style.transform = ''; holdScenes(false); pinchSheets(hostId, null); } }, 400);
      };
      if (!stretched) { go(); return; }
      pages.style.transform = `translate(${p.tx}px, ${p.ty}px) scale(${p.k})`;
      drawn(go);
    };
    const off = onFingers((e) => {
      if (e.kind === 'fingers') {
        // down and up, hardly moved: two fingers take the last stroke back, three put it back
        if (!g && !n && canWriteRef.current && here(e.x, e.y)) { if (e.n >= 3) void inkRedo(); else void inkUndo(); }
        return;
      }
      if (e.kind === 'double') {
        // a finger tapped twice: the pages fitted, or back at the zoom they had before they were
        if (e.host !== hostId || n || g || !here(e.x, e.y)) return;
        const z0 = zoomRef.current;
        const fitted = Math.abs(z0 - 1) < 0.005;
        if (!fitted) lastZooms.set(id, z0);
        const pr = pages.getBoundingClientRect();
        const p = plan(fitted ? lastZooms.get(id) ?? TAP_ZOOM : 1, e.x - pr.left, e.y - pr.top, e.x, e.y);
        n = { z0, plan: p };
        start();
        say(p.z);
        settleSheets(hostId, p, SETTLE_MS);
        return;
      }
      if (e.native) {
        if (e.host !== hostId) return;
        if (e.phase === 'begin') {
          if (n || g) return;
          n = { z0: zoomRef.current, plan: null };
          start();
          return;
        }
        if (!n) return;
        if (e.phase === 'change') { say(zoomHeld(n.z0 * e.k)); return; }
        if (e.phase === 'end' || e.phase === 'cancel') {
          const p = plan(zoomHeld(n.z0 * e.k), e.lx ?? 0, e.ly ?? 0, e.x, e.y);
          n.plan = p;
          say(p.z);
          settleSheets(hostId, p, SETTLE_MS);
          return;
        }
        if (e.phase === 'settled' && n.plan) handOver(n.plan, true);
        return;
      }
      // (a zoom asked for with no layer of the web view's found to stretch: laid out at once)
      if (e.phase === 'settled') { if (n?.plan) handOver(n.plan, false); return; }
      if (e.phase === 'begin') {
        if (g || !here(e.x, e.y)) return;
        const r = pages.getBoundingClientRect();
        const o = inContent(sc, pages);
        g = { z0: zoomRef.current, ax: e.x - r.left, ay: e.y - r.top, left: r.left, top: r.top, ox: o.x, oy: o.y, sl: sc.scrollLeft, st: sc.scrollTop, k: 1, cx: e.x, cy: e.y };
        viewRef.current?.setAttribute('data-pinch', '1');
        return;
      }
      if (!g) return;
      if (e.phase === 'change') {
        // a little past either end gives, and comes back when let go
        g.k = Math.min(ZOOM_MAX * 1.2, Math.max(ZOOM_MIN * 0.8, g.z0 * e.k)) / g.z0;
        g.cx = e.x; g.cy = e.y;
        draw();
        return;
      }
      const was = g;
      g = null;
      viewRef.current?.removeAttribute('data-pinch');
      const z = zoomHeld(was.z0 * was.k);
      if (e.phase === 'cancel' || z === zoomRef.current) {
        // no other size: the pages are where the scroller left them
        const t = shift({ ...was, k: z / was.z0 });
        undraw();
        if (e.phase !== 'cancel') { sc.scrollLeft -= t.x; sc.scrollTop -= t.y; }
        return;
      }
      // the page between the fingers, and where in it: there again once the pages are laid out at the new size
      let under: { page: number; x: number; y: number } | null = null;
      let near = Infinity;
      for (const [n, el] of pageEls.current) {
        const x = el.offsetLeft, y = el.offsetTop, w = el.offsetWidth, h = el.offsetHeight;
        if (!(w > 0 && h > 0)) continue;
        const far = was.ay < y ? y - was.ay : was.ay > y + h ? was.ay - (y + h) : 0;
        if (far < near) { near = far; under = { page: n, x: (was.ax - x) / w, y: (was.ay - y) / h }; }
      }
      pinchEnd.current = under ? { ...under, cx: was.cx, cy: was.cy } : null;
      setBookZoom(id, z);
      // (the pages laid out anew take the stretch off; where nothing is laid out, it is taken off here)
      setTimeout(() => { if (pages.style.transform) { pinchEnd.current = null; undraw(); } }, 120);
    });
    return () => { off(); sc.removeEventListener('scroll', onScroll); if (g) undraw(); if (n) { n = null; holdScenes(false); pinchSheets(hostId, null); viewRef.current?.removeAttribute('data-pinch'); } };
  }, [status, id]);

  const scrollTo = (n: number) => {
    if (native) { void surfaceGo(surfaceId, { page: Math.max(first, Math.min(last, n)), y: 0 }); return; }
    if (pdfSurf) { void pdfDo({ id: pdfSurfId, op: 'go', page: Math.max(first, Math.min(last, n)), y: 0 }); return; }
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
      const from = sc.getBoundingClientRect().top + placeAt();
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
    if (native) {
      landed.current = true;
      void surfaceGo(surfaceId, { page: n, y: p.y, x: p.x ?? null });
      place.current = { page: n, y: p.y };
      return;
    }
    if (pdfSurf) {
      landed.current = true;
      void pdfDo({ id: pdfSurfId, op: 'go', page: n, y: Math.max(0, p.y - room / 1000), ...(p.x !== null && p.x !== undefined ? { x: p.x } : {}) });
      place.current = { page: n, y: p.y };
      return;
    }
    const el = pageEls.current.get(n);
    if (!sc || !el) return;
    const pr = el.getBoundingClientRect();
    landed.current = true;
    sc.scrollTop += pr.top + p.y * pr.height - (sc.getBoundingClientRect().top + placeAt() + room);
    if (p.x !== null && p.x !== undefined) centreOn(sc, p.x);
    // where the view is now, before its scroll says so: a ⌫ straight after goes from here
    place.current = { page: n, y: pr.height > 0 ? p.y - room / pr.height : p.y };
    if (p.x !== null && p.x !== undefined) placeX.current = p.x;
  };
  /** A jump is about to be made from here: here is where ⌫ comes back to. */
  const leave = () => setTrail(id, pushPlace(trailOf(id), here()));
  /**
   * A jump lands on a page that is already there to see: where the page it goes to has nothing drawn yet, its small
   * picture is asked for first and the view held where it is until that has come, a moment (150 ms at most: the
   * picture is a few milliseconds' work). So a jump never shows bare paper first.
   */
  const whenSeen = (n: number, go: () => void) => {
    const at = native || pdfSurf ? null : picturesOf(rel);
    const el = pageEls.current.get(Math.max(first, Math.min(last, n)));
    if (!at || !el || el.querySelector(':scope > canvas') || el.querySelector<HTMLImageElement>(':scope > img.pg-low')?.complete) { go(); return; }
    let gone = false;
    const once = () => { if (gone) return; gone = true; clearTimeout(timer); go(); };
    const timer = setTimeout(once, JUMP_HOLD);
    const img = new Image();
    img.decoding = 'async';
    img.onload = once;
    img.onerror = once;
    img.src = lowUrl(at, Math.max(first, Math.min(last, n)));
    // (the same picture is the page's own from now on: it is under the page when the view arrives)
    if (!el.querySelector(':scope > img.pg-low')) { img.className = 'pg-low'; img.alt = ''; img.draggable = false; el.prepend(img); }
  };
  /** A jump: here goes on the trail, the pages go to the place. */
  const jump = (to: { page: number; y: number }, exact = false) => { leave(); whenSeen(to.page, () => goPlace(to, exact ? 0 : JUMP_ROOM)); };
  /**
   * A jump to a place that may lie outside these pages (a chapter cut from a book): said, not made. `exact`: a place
   * that was the top of the view when it was kept (a bookmark, a mark, a portal's end) comes back as it was; a
   * heading, a link's end or a hit is given a little room over it.
   */
  const goTo = (to: { page: number; y: number }, exact = false) => {
    if (to.page < first || to.page > last) { notify(`p. ${to.page} is not among these pages`); return; }
    jump(to, exact);
  };
  const goBack = (): boolean => {
    const r = stepBack(trailOf(id), here());
    if (!r) return false;
    setTrail(id, r.trail);
    whenSeen(r.to.page, () => goPlace(r.to));
    return true;
  };
  const goForward = (): boolean => {
    const r = stepForward(trailOf(id), here());
    if (!r) return false;
    setTrail(id, r.trail);
    whenSeen(r.to.page, () => goPlace(r.to));
    return true;
  };

  // ── what the notes say about the pages: the passages, in book order ──
  /** Boxes as they come into the column: each at the place its sheet lies; null when a sheet of theirs is gone. */
  const boxesIn = (boxes: Box[] | null): Box[] | null => {
    if (!boxes) return null;
    const out: Box[] = [];
    for (const b of boxes) {
      const n = placeOfSheet(b.page);
      if (n === null) return null;
      out.push(n === b.page ? b : { ...b, page: n });
    }
    return out;
  };
  const drawn = useMemo((): Drawn[] => {
    // the boxed sections of the notes written before milestone 81, and the passages kept with the PDF; all in book order
    const old = notes.flatMap((note): Drawn[] => {
      const doc: Doc | undefined = loadedNotes.get(note)?.doc;
      return doc ? passagesOf(doc.blocks).map((p): Drawn => ({ key: p.heading.text, name: p.heading.text, boxes: p.boxes, cards: sectionState(doc.blocks, p.index).cards, dismissed: sectionDismissed(p.heading.read!), section: p, sectionIn: note })) : [];
    });
    const kept = passageMarksOf(marks).flatMap(([, m]): Drawn[] => {
      // a notebook's passage names its sheets: drawn where they lie now, and not at all once one of them is gone
      const boxes = boxesIn(parseBoxes(m.boxes));
      return boxes ? [{ key: m.boxes, name: pagesLabel(boxes), boxes, cards: 0, dismissed: m.due === undefined, sched: schedOf(m) }] : [];
    });
    return [...old, ...kept].map((d, i) => ({ d, i })).sort((a, b) => boxesAt(a.d.boxes) - boxesAt(b.d.boxes) || a.i - b.i).map((x) => x.d);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [notes, loadedNotes, marks, sheets]);
  const drawnRef = useRef(drawn);
  drawnRef.current = drawn;
  const nativeRef = useRef(native);
  nativeRef.current = native;
  const surfaceIdRef = useRef(surfaceId);

  /** Scroll the pages to a passage's first box, unless it is in view; `always` scrolls regardless. */
  const scrollToPassage = useCallback((text: string, always = false) => {
    const d = drawnRef.current.find((x) => x.key === text);
    const sc = scroller();
    const b = d?.boxes[0];
    if (nativeRef.current) {
      // a notebook's surface: its first box a little under the top of the view, unless it is the page in view already
      if (b && (always || place.current?.page !== b.page)) { landed.current = true; void surfaceGo(surfaceIdRef.current, { page: b.page, y: Math.max(0, b.y - 0.06) }); }
      return;
    }
    const el = b ? pageEls.current.get(b.page) : undefined;
    if (!sc || !b || !el) return;
    const sr = sc.getBoundingClientRect();
    const pr = el.getBoundingClientRect();
    const top = pr.top + b.y * pr.height;
    landed.current = true;
    const over = barExtra();
    if (!always && top >= sr.top + 30 + over && top <= sr.bottom - 120) return;
    sc.scrollTo({ top: Math.max(0, sc.scrollTop + top - sr.top - 60 - over) });
  }, []);

  // the caret's section in the note lights its boxes, and the pages scroll to them; only a caret someone put there:
  // a note just opened beside the pages has one at its top, and the reader's place is not to move for it (milestone 70)
  useEffect(() => {
    if (!caret || !notes.includes(caret.path) || !document.activeElement?.closest('.draft-doc')) return;
    const text = drawnRef.current.some((d) => d.section && d.sectionIn === caret.path && d.key === caret.text) ? caret.text : null;
    setLit(text);
    if (text) scrollToPassage(text);
  }, [caret?.path, caret?.text, caret?.nth, notes, status, sizes.length, scrollToPassage]);
  // what goes to a section of the note goes to its boxes too, once the pages are there: a session's come after the note has landed
  const going = useRef<string | null>(null);
  const focusSeen = useRef(0);
  const reveal = useApp((s) => s.reveal);
  useEffect(() => {
    if (reveal && notes.includes(reveal.path) && reveal.heading !== undefined) going.current = reveal.heading;
    // a passage asked for before the pages were there (a session on it, a row of the palette's list)
    if (focus && focus.path === id && focus.seq !== focusSeen.current) { focusSeen.current = focus.seq; going.current = focus.text; }
    const text = going.current;
    if (text === null || status !== 'ok' || !sizes.length || !drawn.some((d) => d.key === text)) return;
    going.current = null;
    setLit(text);
    scrollToPassage(text);
  }, [reveal, focus, id, notes, status, sizes.length, drawn, scrollToPassage]);
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
      if (was.at && pr && pr.height > 0) sc.scrollTop += pr.top + was.at.y * pr.height - (sc.getBoundingClientRect().top + placeAt());
      else sc.scrollTop = was.top;
      // the place is this one from here on: a scale that changes before the next scroll (the scroller's bar taking its
      // width as the pages fill the pane) keeps it, not the top the pages opened at
      if (was.at) place.current = was.at;
      // zoomed past the pane: across the pages where it was left too
      if (was.x !== null) centreOn(sc, was.x);
      return;
    }
    const rp = info?.read?.pos !== undefined ? { pos: info.read.pos, y: info.read.y ?? 1 } : null;
    const r = rp && rp.pos >= first && rp.pos <= last ? pageRect(rp.pos) : null;
    if (!rp || !r) return;
    sc.scrollTop = Math.max(0, r.top + rp.y * r.height - sc.clientHeight / 3);
    // the place is read again at once, so a scale that settles before the next scroll keeps the read point in view
    sc.dispatchEvent(new Event('scroll'));
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
  const goToSection = (p: Passage, note: string | undefined) => {
    if (note === undefined) return;
    setLit(p.heading.text);
    useApp.setState({ reveal: { path: note, index: p.index, heading: p.heading.text } });
    void openNotes(id, note).catch(console.error);
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
    if (pdfSurfRef.current) void pdfDo({ id: pdfSurfIdRef.current, op: 'clear' });
    window.getSelection()?.removeAllRanges();
  };

  /**
   * The words under the boxes drawn, as a selection would hold them: each
   * word whose middle lies in a box, its lines a quad each. What a
   * highlight and a look-up take where no text is selected (under a finger
   * a page's text never is: its drag is the scroll, its held drag the box).
   */
  const wordsUnder = (boxes: readonly Box[]): { text: string; quads: Quad[] } => {
    const words: string[] = [];
    const quads: Quad[] = [];
    const range = document.createRange();
    for (const b of boxes) {
      const el = pageEls.current.get(b.page);
      const layer = el?.querySelector('.textLayer');
      if (!el || !layer) continue;
      const pr = el.getBoundingClientRect();
      if (pr.width <= 0 || pr.height <= 0) continue;
      const left = pr.left + b.x * pr.width;
      const top = pr.top + b.y * pr.height;
      const right = left + b.w * pr.width;
      const bottom = top + b.h * pr.height;
      const rects: { x: number; y: number; w: number; h: number }[] = [];
      const walker = document.createTreeWalker(layer, NodeFilter.SHOW_TEXT);
      for (let n = walker.nextNode(); n; n = walker.nextNode()) {
        const span = n.parentElement;
        if (!span) continue;
        const sr = span.getBoundingClientRect();
        if (sr.bottom < top || sr.top > bottom || sr.right < left || sr.left > right) continue;
        for (const m of (n.textContent ?? '').matchAll(/\S+/g)) {
          range.setStart(n, m.index);
          range.setEnd(n, m.index + m[0].length);
          const r = range.getBoundingClientRect();
          const cx = r.left + r.width / 2;
          const cy = r.top + r.height / 2;
          if (r.width <= 0 || r.height <= 0 || cx < left || cx > right || cy < top || cy > bottom) continue;
          words.push(m[0]);
          rects.push({ x: (r.left - pr.left) / pr.width, y: (r.top - pr.top) / pr.height, w: r.width / pr.width, h: r.height / pr.height });
        }
      }
      quads.push(...lineQuads(b.page, rects));
    }
    return { text: words.join(' '), quads };
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
   * `e`: the boxes become a passage, kept with the PDF and in no note: back
   * on the cadence of the document's priority until dismissed. The read
   * point moves past the boxes. Nothing opens and nothing is asked: the
   * notice says when it is back, and undoes it. The page's own name for the
   * passage is said in the notice and nowhere kept.
   */
  const makeSection = async (from?: Box[]) => {
    const boxes = from ?? boxesNow();
    if (!boxes.length) return;
    const { name } = await nameOf(boxes);
    const made = await keepPassage(id, boxesOut(boxes));
    if (!made) { notify('marks are kept by the pdf\'s hash, which this collection does not have'); return; }
    clearBoxes();
    const end = boxesEnd(boxes);
    let before: Doc | null = null;
    // the read point moves past the last box (a notebook has none)
    if (!written) await writeDoc(id, (d) => {
      const r = meta(d).read;
      if (r && end && meta(d).type !== 'note') {
        before = structuredClone(d);
        const { pos: _p, y: _y, ...rest } = r;
        setField(d, 'read', { ...rest, ...pointOn(r, end.page, end.y) });
      }
    });
    logReading(id, 'section', { sec: made.label });
    setLit(made.boxes);
    notify(`§ ${plainMath(name || made.label)} · back in ${made.ivl}d, until dismissed`, null, async () => {
      unlogReading(id, made.label);
      await putPassage(made.hash, made.boxes, null);
      const was = before as Doc | null;
      const r = was ? meta(was).read : undefined;
      if (r) await writeDoc(id, (d) => { setField(d, 'read', r); });
    });
  };

  /** `m`: each box clipped into the note (of several, the one in front beside the pages, else the one used last; a PDF with none yet asks for one first), after the block the caret is in when the note is open and holds one, else at its end; the caret below, for the card. No heading is written. */
  const cardOrClip = async (from?: Box[]) => {
    const boxes = from ?? boxesNow();
    if (!boxes.length) return;
    // a clip is a line of a typed note: written notes among a PDF's notes take none
    const to = await ensureNote(id, true);
    if (to === null) return;
    // a notebook's clip names the sheet, as its strokes do
    const clips = boxesOut(boxes).map(formatClip);
    if (!clips.length) return;
    clearBoxes();
    let at = -1;
    await writeDoc(to, (d) => {
      let next = Math.max(0, Math.min(placeAtCaret(to) ?? d.blocks.length, d.blocks.length));
      for (const text of clips) { d.blocks.splice(next, 0, { kind: 'raw', text }); at = next++; }
    });
    if (at < 0) return;
    notify(`clipped · ${boxes.length === 1 ? `p. ${boxes[0]!.page}` : `${boxes.length} boxes`} · the card goes below it: word ::: meaning`, null, async () => {
      await writeDoc(to, (d) => {
        // the clips just written, each the last of its text
        for (const text of clips) {
          for (let k = d.blocks.length - 1; k >= 0; k--) {
            const b = d.blocks[k]!;
            if (b.kind === 'raw' && b.text === text) { d.blocks.splice(k, 1); break; }
          }
        }
      });
    });
    useApp.setState({ reveal: { path: to, index: at, write: true } });
    await openNotes(id, to);
  };

  /** A press on a passage's tag: when it is next, and what can be done with it. A boxed section of an older note goes to its heading in the notes. */
  const passageMenu = (e: React.MouseEvent, d: Drawn) => {
    e.preventDefault();
    e.stopPropagation();
    passageMenuAt((e.currentTarget as HTMLElement).getBoundingClientRect(), d);
  };
  const passageMenuAt = (tr: { left: number; bottom: number }, d: Drawn) => {
    if (d.section) { goToSection(d.section, d.sectionIn); return; }
    if (!hash || !d.sched) return;
    const h = hash;
    const sched = d.sched;
    setLit(d.key);
    const undoable = (said: string) => (undo: (() => Promise<void>) | null) => notify(said, null, undo ?? undefined);
    // under the tag itself, wherever on it the press fell
    popMenu({ left: tr.left, top: tr.bottom + 4, bottom: tr.bottom + 4 }, [
      { label: chipWhen(sched, appNow()), act: 'passage-when' },
      d.dismissed
        ? { label: 'bring back', act: 'passage-back', run: () => void bringPassageBack(id, h, d.key).then(undoable(`§ ${d.name} · brought back`)).catch(console.error) }
        : { label: 'dismiss', act: 'passage-dismiss', run: () => void changePassage(h, d.key, (x) => { const { due: _d, ivl: _i, reps: _r, af: _a, ...rest } = x; return rest; }).then((undo) => { logReading(id, 'done', { sec: d.name }); notify(`§ ${d.name} · dismissed`, null, async () => { unlogReading(id, d.name); await undo?.(); }); }).catch(console.error) },
      { label: 'remove', act: 'passage-remove', run: () => { const was = marksRef.current[passageId(d.key)]; void putPassage(h, d.key, null).then(() => notify(`§ ${d.name} · removed`, null, was?.kind === 'passage' ? () => putPassage(h, d.key, was) : undefined)).catch(console.error); } },
    ], 'book-menu');
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
    // (where the app draws the pages, a page's text is kept across zooms: drawn is having it at all)
    if (tilesRef.current ? !rendered.current.has(hit.page) : rendered.current.get(hit.page) !== scale) scrollTo(hit.page);
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
  /** The height a destination's `top` is measured against: a turned page's is not its height as shown, so a destination there is the page's top (0 says so to `downPage`). */
  const destHeight = async (n: number): Promise<number> => (pdf && (((await pdf.getPage(n)).rotate ?? 0) % 360 !== 0) ? 0 : heightOf(n));
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
        return referenceTokens(textBoxes(uprightItems((await pg.getTextContent()).items, v.transform, v.height), v.width, v.height));
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
    return d && { page: d.page, y: d.top === null ? 0 : downPage(d.top, await destHeight(d.page)) };
  };
  /** A link followed: a web one in the system's browser, an inside one a jump with the way back. */
  const followLink = async (l: PageLink, from: number) => {
    if (l.url !== undefined) { openWeb(l.url); return; }
    const to = await linkPlace(l, from);
    if (!to) { notify('this link\'s target is not in this pdf'); return; }
    goTo(to);
  };
  /** A link's destination in the peek, without going; a web one's address is said. */
  const peekLink = async (l: PageLink, from: number) => {
    if (l.url !== undefined) { notify(l.url); return; }
    const to = await linkPlace(l, from);
    if (!to) { notify('this link\'s target is not in this pdf'); return; }
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
    if (!e.altKey && hit.x < RULER_MARGIN && !mobile && !written && !st.current.sel) { void startRuler(hit).catch(console.error); return; }
    if (!e.altKey || written) return;
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
    // paper has nothing to peek at or look up
    if (written) return;
    const at = { left: e.clientX, top: e.clientY, bottom: e.clientY };
    const link = linkAt(links.current.get(hit.page) ?? [], hit.x, hit.y);
    const live = window.getSelection();
    const picked = st.current.sel?.text ?? (live && !live.isCollapsed && pagesRef.current?.contains(live.anchorNode) ? live.toString().replace(/\s+/g, ' ').trim() : '');
    const selRows: PopItem[] = picked ? [
      ...(st.current.sel ? [
        { label: 'passage', act: 'section', run: () => void makeSection().catch(console.error) },
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
      { label: 'passage', act: 'hl-section', run: () => void makeSection(quadBoxes(hl.quads)).catch(console.error) },
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
      const seen = (b: { y: number; h: number }) => { const mid = pr.top + (b.y + b.h / 2) * pr.height; return mid >= sr.top + placeAt() - 20 && mid <= sr.bottom; };
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
  const lensNow = useRef<{ contents(): Promise<BookContents>; go(p: { page: number; y: number }, exact?: boolean): void; show(p: { page: number; y: number }, portal: string): void }>({ contents: async () => ({ entries: [], here: -1, from: 'none' }), go: () => {}, show: () => {} });
  lensNow.current = {
    async contents() {
      const at = here();
      if (pdf) {
        outline.current ??= flatOutline(pdf as unknown as ContentsPdf, destHeight).catch((): ContentsEntry[] => []);
        // a chapter cut from a book lists what lies in its own pages
        const entries = contentsWithin(await outline.current, first, last);
        if (entries.length) return { entries, here: contentsHere(entries, at.page, at.y), from: 'outline' };
      }
      // no outline: the sections boxed on the pages, in the book's order
      const entries = drawnRef.current.flatMap((d): ContentsEntry[] => { const b = d.boxes[0]; return b ? [{ title: plainMath(d.name), depth: 0, page: b.page, y: b.y }] : []; });
      return { entries, here: contentsHere(entries, at.page, at.y), from: entries.length ? 'sections' : 'none' };
    },
    go: (e, exact) => goTo(e, exact),
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
  const lens = useMemo((): BookLens => ({ active: () => activeRef.current, contents: () => lensNow.current.contents(), go: (p, exact) => lensNow.current.go(p, exact), show: (p, portal) => lensNow.current.show(p, portal) }), []);
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
    if (p) goTo(p, true);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wanted, active, status, sizes.length, id]);

  // a place this book is to show beside another (a portal of that book's leads here): shown, no jump, by the lens that is not in front
  const beside = useBesidePlace(id);
  useEffect(() => {
    if (!beside || active || status !== 'ok' || !sizes.length) return;
    const p = takeBesidePlace(id);
    if (p) lensNow.current.show(p.place, p.portal);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [beside, active, status, sizes.length, id]);

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
        const head = headingAbove(() => items, n, n, n === at.page ? at.y + NAME_UNDER : Infinity, true);
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
    goTo(m, true);
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
  /** The words under the boxes drawn, searched for on the web (a finger's look-up: the desk's is a selection's right-click). */
  const lookUnder = () => {
    const { text } = wordsUnder(st.current.pending);
    if (!text) { notify('no words under the box to look up'); return; }
    openWeb(lookupUrl('web', text));
    clearBoxes();
  };
  const doHighlight = () => {
    if (marked() === null || !hash) return;
    // a selection's words, or with none the words under the boxes drawn
    const s: { text: string; quads: Quad[] } | null = st.current.sel ?? (st.current.pending.length ? wordsUnder(st.current.pending) : null);
    if (!s?.quads.length) {
      if (st.current.pending.length) { notify('no words under the box to highlight'); return; }
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
    hapticTick();
    clearBoxes();
    notify(mobile ? 'highlighted · hold it for its inks' : `highlighted · 1–${INKS} choose its ink`, null, () => setMark(hash, key, null));
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
  // ── a notebook's pages (milestone 82): one more, one fewer, their paper ──
  /** What a sheet holds: whether it is written on, and how many passages have a box on it. */
  const heldOn = (sheet: number): { inkOn: boolean; kept: number } => ({
    inkOn: inkedRef.current[sheet] !== undefined,
    kept: passageMarksOf(marksRef.current).filter(([, m]) => parseBoxes(m.boxes)?.some((b) => b.page === sheet)).length,
  });
  const morePage = () => void addSheet(id).catch(failed('add page'));
  /**
   * `delete this page`: the page in view goes, with what is written on it
   * and the passages kept from it. A page that holds either asks first, as
   * the tree's delete does (the row says what goes with it, a second press
   * does it); the notice has `undo`, which puts all of it back. A notebook
   * keeps a page: its only one deleted leaves a blank one (`written.ts`),
   * so a bare only page has nothing to delete.
   */
  const deletePage = (n: number, at: { left: number; top: number; bottom: number }, sure = false) => {
    const sheet = sheetAt(n);
    if (!written || sheet === null) return;
    const { inkOn, kept } = heldOn(sheet);
    if (written.sheets.length < 2 && !inkOn && !kept) return;
    if ((inkOn || kept > 0) && !sure) {
      const holds = [inkOn ? 'its writing' : '', kept ? plural(kept, 'passage') : ''].filter(Boolean).join(' and ');
      const menu = popMenu(at, [{ label: `delete page ${n} with ${holds}?`, act: 'page-delete-sure', danger: true, run: () => deletePage(n, at, true) }], 'book-menu');
      menu.querySelector('.ci')?.classList.add('asking');
      return;
    }
    void removeSheet(id, sheet).then((undo) => notify(`page ${n} deleted`, null, undo)).catch(failed('delete page'));
  };
  /** A notebook's `more`: its paper, the one it has marked, and `delete this page` (not for an only page with nothing on it). */
  const paperMenu = (at: { left: number; top: number; bottom: number }) => {
    if (!written) return;
    const sheet = sheetAt(current);
    const held = sheet === null ? null : heldOn(sheet);
    const items: PopItem[] = [
      // a written notebook under this one, with this one's page setup, shown as a tab beside it
      { label: 'new tab', act: 'more-tab', run: () => void newWrittenTab(id).catch(failed('new tab')) },
      ...(pageless ? [] : [{ label: 'all pages', act: 'more-pages', run: () => setGrid(true) }]),
      { label: 'page setup', act: 'more-setup', run: () => setSetup(true) },
      { label: mobile ? 'share as pdf' : 'export as pdf', act: 'more-share', run: () => sharePdf(at) },
      ...(pageless || sheet === null ? [] : [
        { label: '-' },
        { label: 'add page after this one', act: 'page-add-after', run: () => void addSheetAfter(id, sheet).catch(failed('add page')) },
        { label: 'duplicate this page', act: 'page-duplicate', run: () => void duplicateSheet(id, sheet).catch(failed('duplicate page')) },
        ...(held && (written.sheets.length > 1 || held.inkOn || held.kept > 0) ? [{ label: 'delete this page', act: 'page-delete', danger: true, run: () => deletePage(current, at) }] : []),
      ]),
    ];
    popMenu(at, items, 'book-menu');
  };
  /** `share as pdf` (a Mac's `export as pdf`): these pages with what is written on them, as one PDF (`PageTools.tsx`). */
  const sharePdf = (at: { left: number; top: number }) => {
    if (!hash) return;
    const name = titleOf(id, docs, root);
    const of = written
      ? { name, hash, written, inked: new Set(Object.keys(inkedRef.current).map(Number)) }
      : { name, hash, pages: sizes.map((s, i) => ({ page: base + i + 1, w: s.w, h: s.h })), inked: new Set(Object.keys(inkedRef.current).map(Number)) };
    void sharePages(of, { x: at.left, y: Math.max(0, at.top - 30), w: 30, h: 30 }).catch(failed(mobile ? 'share as pdf' : 'export as pdf'));
  };
  /** `+` beside the notes' word: one more note on these pages, typed or written. A notebook's own notes are typed. */
  const addMenu = (el: HTMLElement) => {
    if (written) { void addNote(id).catch(console.error); return; }
    const r = el.getBoundingClientRect();
    popMenu({ left: r.left, top: r.bottom + 4, bottom: r.bottom + 4 }, [
      { label: 'new note', act: 'new-note', run: () => void addNote(id).catch(console.error) },
      { label: 'new written notes', act: 'new-written', run: () => void addWritten(id).catch(failed('new written notes')) },
    ], 'book-menu');
  };
  /** The bar's `more`: what the keys do for a place, by name, so a finger has them too (a portal above all: ⇧P has no touch). */
  const moreMenu = (el: HTMLElement) => {
    const r = el.getBoundingClientRect();
    if (written) { paperMenu({ left: r.left, top: r.bottom + 4, bottom: r.bottom + 4 }); return; }
    const from = portalPending();
    // its reading, while it is enrolled: put off, or ended, as the session's `later` and `dismiss` do (the notice takes either back)
    const topic = info?.read ? (action: 'postpone' | 'done') => void import('./Session.js').then((m) => { const it = m.readingOf(id); if (it) m.actWithNotice(it, action); }).catch(console.error) : null;
    const items: PopItem[] = [
      ...(topic ? [{ label: 'later', act: 'more-later', run: () => topic('postpone') }, { label: 'dismiss', act: 'more-dismiss', run: () => topic('done') }, { label: '-' }] : []),
      { label: 'all pages', act: 'more-pages', run: () => setGrid(true) },
      ...(hash ? [{ label: mobile ? 'share as pdf' : 'export as pdf', act: 'more-share', run: () => sharePdf({ left: r.left, top: r.bottom + 4 }) }] : []),
      { label: '-' },
      { label: 'bookmark this place', act: 'more-bookmark', run: () => void startBookmark().catch(console.error) },
      from
        ? { label: `portal: p. ${from.page} shows this place`, act: 'more-portal-to', run: () => void portalKey().catch(console.error) }
        : { label: 'portal from this place…', act: 'more-portal-from', run: () => void portalKey().catch(console.error) },
      ...(from ? [{ label: 'cancel the portal', act: 'more-portal-cancel', run: () => setPortalPending(null) }] : []),
      { label: ruler ? 'hide the ruler' : 'ruler', act: 'more-ruler', run: () => { if (ruler) setRuler(null); else void startRuler().catch(console.error); } },
      ...(!mobile ? [{ label: followed(id) ? 'stop following portals beside' : 'portals beside', act: 'more-beside', run: () => togglePortalsBeside(id) }] : []),
    ];
    popMenu({ left: r.left, top: r.bottom + 4, bottom: r.bottom + 4 }, items, 'book-menu');
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
      { label: 'go there', act: 'portal-go', run: () => (p.to.pdf !== undefined ? goToMark(p.to.pdf, p.to, id) : goTo(p.to, true)) },
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
    const p = at ? portalAbove(portals, at) : null;
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
    // (the native surface: a third of the way down the view, from the place it says is at its top)
    if (!at && pdfSurf && place.current) at = { page: place.current.page, y: Math.min(1, place.current.y + 0.25) };
    if (!at) return;
    const bands = await bandsOf(at.page);
    let to: { page: number; line: number } | null = bands.length ? { page: at.page, line: bandNear(bands, at.y) } : await stepLine({ page: at.page, line: -1 }, 1, async (n) => (await bandsOf(n)).length, first, last);
    if (to && to.line < 0) to = null;
    const band = to ? (await bandsOf(to.page))[to.line] : undefined;
    if (!to || !band) { notify('no text here for the ruler'); return; }
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
      // the peek is a look at a line, the size it always is: the page drawn `PEEK_PAGE` wide, whatever the pane's width or the zoom
      const scale = PEEK_PAGE / page.getViewport({ scale: 1 }).width;
      const vp = page.getViewport({ scale });
      const dpr = window.devicePixelRatio || 1;
      const full = document.createElement('canvas');
      full.width = Math.floor(vp.width * dpr);
      full.height = Math.floor(vp.height * dpr);
      await page.render({ canvas: full, viewport: vp, intent: 'print', transform: [dpr, 0, 0, dpr, 0, 0] }).promise;
      if (!live) return;
      // a figure's caption lies under its picture: its peek is taller and ends just under the caption; anything else begins just above its line
      const fig = /^fig/i.test(peek.text.trim());
      const H = fig ? PEEK_FIG_H : PEEK_H;
      const top = Math.max(0, Math.min(vp.height - H, fig ? vp.height - peek.y * scale + 20 - H : vp.height - (peek.y + peek.height) * scale - 24));
      const w = Math.min(PEEK_W, vp.width);
      const h = H * (w / vp.width);
      canvas.width = Math.floor(w * dpr);
      canvas.height = Math.floor(h * dpr);
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      canvas.getContext('2d')?.drawImage(full, 0, top * dpr, vp.width * dpr, H * dpr, 0, 0, w * dpr, h * dpr);
    })().catch(console.error);
    return () => { live = false; };
  }, [peek, pdf]);

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
      if (s.pending.length || s.find || s.goto || s.peek || s.looking || s.hints || s.naming || s.chord || s.ruler || tying) {
        setPending([]); setFind(null); setGoto(false); setPeek(null); setHints(null);
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
      // once the word in the bar is gone and the pages lie as they will: the bar's line moves them, and a place read or gone to under it would be off by its height
      if (/^[A-Za-z]$/.test(e.key)) { const letter = e.key; const was = s.chord; setTimeout(() => void (was === 'set' ? setLetter(letter) : goLetter(letter)).catch(failed('mark')), 0); }
      return;
    }
    if (inField(e.target)) return;
    // the peek shows where a reference points: ⏎ goes there
    if (active && s.peek && e.key === 'Enter') { take(); followPeek(); return; }
    if (have && e.key === 'e') { take(); void makeSection().catch(console.error); return; }
    if (have && e.key === 'm') { take(); void cardOrClip().catch(console.error); return; }
    // a reference under the selection: its target in a peek
    if (s.sel && e.key === 'Enter' && refOf(s.sel.text)) { take(); void doJump().catch(console.error); return; }
    if (!active) return;
    // a menu or the palette over the pages has the keys
    const free = !useApp.getState().paletteOpen && popMenuOpen() === null && document.querySelector('.ctx-menu') === null;
    if (free && e.key === 'Backspace') { if (e.shiftKey ? goForward() : goBack()) take(); return; }
    // paper has no text: the contents, the hints, the search and what is left on a PDF's page have nothing to work on
    if (free && !written && !e.shiftKey && e.key === 't' && status === 'ok') { take(); openContents(id); return; }
    if (free && !written && !e.shiftKey && e.key === 'f' && status === 'ok') { take(); void showHints().catch(console.error); return; }
    // `n` and `N` step the search's hits, as ⏎ and ⇧⏎ do in its field
    if (free && (e.key === 'n' || e.key === 'N') && s.find?.q && s.find.pages.length) { take(); void runFind(s.find.q, e.key === 'n' ? 1 : -1).catch(console.error); return; }
    // what is left on the page (milestone 77)
    if (free && status === 'ok' && !written) {
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
    else if (e.key === '/') { if (written) return; take(); setFind((f) => f ?? { q: '', pages: [], at: 0 }); findRef.current?.focus(); }
    // (a pageless notebook has no pages to go to)
    else if (e.key === 'g') { if (pageless) return; take(); setGoto(true); }
    else if (!session && (e.key === ']' || e.key === '[')) {
      // step between the passages, in book order; with none, between pages
      const list = drawnRef.current;
      if (!list.length) { take(); scrollTo(current + (e.key === ']' ? 1 : -1)); return; }
      const at = list.findIndex((p) => p.key === lit);
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
        // a boxed section of the note goes to its heading there; a passage is only on the pages
        if (next.section) goToSection(next.section, next.sectionIn);
        else { setLit(next.key); scrollToPassage(next.key); }
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

  // ── a notebook's surface (87): told where it lies and what it holds; heard ──
  surfaceHears.current = (e) => {
    if (e.what === 'view') {
      if (e.page !== undefined) setCurrent(e.page);
      if (e.top !== undefined && e.y !== undefined) {
        place.current = { page: e.top, y: e.y };
        placeX.current = e.x ?? null;
        if (landed.current) places.set(id, { top: 0, at: place.current, x: placeX.current });
      }
      // the bar's zoom follows the fingers (its own text node, the one React holds)
      const t = inBarRef.current('.pt-pct')?.firstChild;
      if (t && t.nodeType === 3 && e.zoom !== undefined) t.nodeValue = `${Math.round(e.zoom * 100)}%`;
      const pend = e.pend ?? null;
      const moving = !!e.moving;
      const lay = e.lay ?? null;
      setSurfaceAt((was) => (was.moving === moving && was.pend?.x === pend?.x && was.pend?.y === pend?.y && was.pend?.w === pend?.w && was.pend?.h === pend?.h && (was.lay?.join(' ') ?? '') === (lay?.join(' ') ?? '') ? was : { pend, moving, lay }));
      landed.current = true;
      return;
    }
    if (e.what === 'moving') { setSurfaceAt((was) => (was.moving ? was : { ...was, moving: true })); return; }
    if (e.what === 'touch') {
      // the pages are not this page's to be pressed: what listens for a press anywhere else (a menu, a tool's settings) is told of one there
      const el = surfaceEl;
      if (!el) return;
      const init = { bubbles: true, cancelable: true, clientX: -1, clientY: -1 };
      el.dispatchEvent(typeof PointerEvent === 'function' ? new PointerEvent('pointerdown', { ...init, pointerType: 'touch', isPrimary: true }) : new Event('pointerdown', init));
      el.dispatchEvent(new MouseEvent('mousedown', init));
      return;
    }
    if (e.what === 'zoomed') {
      if (e.zoom === undefined) return;
      surfaceZoomAt.current = e.zoom;
      if (Math.abs(e.zoom - zoomRef.current) > 0.0005) setBookZoom(id, e.zoom);
      return;
    }
    if (e.what === 'grow') {
      // a notebook never runs out of paper: a stroke begun low on its last page adds the next, once for that page (a
      // pageless notebook's long sheet asks for its next sheet before its foot comes to the end of the last: 88)
      const list = sheetsRef.current;
      if (!list || e.sheet !== list[list.length - 1] || addedAfter.current === e.sheet) return;
      addedAfter.current = e.sheet ?? null;
      void addSheet(id).catch((err: unknown) => { addedAfter.current = null; console.error(err); });
      return;
    }
    if (e.what === 'add') { morePage(); return; }
    if (e.what === 'boxing') { settle(); return; }
    if (e.what === 'boxed') {
      if (e.page === undefined || e.x === undefined || e.y === undefined || e.w === undefined || e.h === undefined) return;
      const b: Box = { page: e.page, x: e.x, y: e.y, w: e.w, h: e.h };
      setPending((was) => [...was, b]);
      return;
    }
    if (e.what === 'tag') {
      const d = drawnRef.current.find((x) => x.key === e.key);
      if (d && e.x !== undefined && e.y !== undefined) passageMenuAt({ left: e.x, bottom: e.y + (e.h ?? 0) }, d);
      return;
    }
    // a tap on the pages lets go of the boxes drawn and not yet made into anything
    if (e.what === 'tap' && st.current.pending.length) setPending([]);
  };
  /** The passages' boxes and the boxes drawn, as the surface draws them. */
  const surfaceMarks = useMemo((): SurfaceMark[] => {
    if (!native) return [];
    const out: SurfaceMark[] = [];
    for (const d of drawn) {
      d.boxes.forEach((b, i) => {
        const name = plainMath(d.name);
        out.push({ key: d.key, page: b.page, x: b.x, y: b.y, w: b.w, h: b.h, tag: i ? `↳ ${name} (${i + 1}/${d.boxes.length})` : `§ ${name}${d.cards > 0 ? ` ◆${d.cards}` : ''}`, ...(lit === d.key ? { cur: true } : {}), ...(d.dismissed ? { dis: true } : {}), ...(flash?.text === d.key ? { flash: true } : {}) });
      });
    }
    pending.forEach((b, i) => out.push({ key: `pending:${i}`, page: b.page, x: b.x, y: b.y, w: b.w, h: b.h, pending: true, ...(pending.length > 1 ? { no: i + 1 } : {}) }));
    return out;
  }, [native, drawn, pending, lit, flash]);
  const surfaceOpen = useRef<{ page: number; y: number; x: number | null } | null | undefined>(undefined);
  const surfaceVeil = useRef<{ state: 'off' | 'asking' | 'on' }>({ state: 'off' });
  /** The surface is on the glass (its tab shown). */
  const surfaceLive = useRef(false);
  const sendRef = useRef<() => void>(() => {});
  sendRef.current = () => {
    const el = surfaceEl;
    if (!native || !written || !hash || !el || !sheets) return;
    // a pageless notebook's surface is told how far its writing reaches: not before the store has said
    if (pageless && !runLen) return;
    const r = el.getBoundingClientRect();
    // a tab not shown has no surface
    if (!el.isConnected || r.width < 8 || r.height < 8) {
      dropSurface(surfaceId);
      surfaceOpen.current = undefined;
      // (a pageless notebook shown again is opened again: its sheet as long as what is written on it then, and a little more)
      if (surfaceLive.current && pageless && runLen) { setRunLen(null); setRunOpened((n) => n + 1); }
      surfaceLive.current = false;
      return;
    }
    const book = el.closest<HTMLElement>('.book');
    const css = getComputedStyle(el);
    const look = paperLook(written, theme);
    // where it opens: where these pages were left, read once (it says where it is from then on)
    if (surfaceOpen.current === undefined) { const was = places.get(id); surfaceOpen.current = was?.at ? { page: was.at.page, y: was.at.y, x: was.x } : null; }
    const spec = paperOf(written, 0);
    // something not known to be laid over pages lies over them (the tree's sheet with its shade): the surface cannot be
    // cut to it, so the page shows a picture of the surface in its place, under whatever that is, and the surface
    // stands aside until it is gone
    const holes = holesOver(el);
    const wanted = holes.some((h) => h.wide);
    const veil = surfaceVeil.current;
    if (wanted && veil.state === 'off') {
      veil.state = 'asking';
      void surfacePicture(surfaceId).then((url) => {
        if (surfaceVeil.current.state !== 'asking') return;
        if (url) el.style.backgroundImage = `url(${url})`;
        surfaceVeil.current.state = 'on';
        sendRef.current();
      });
    } else if (!wanted && veil.state !== 'off') {
      veil.state = 'off';
      // (the surface is shown again first, then the picture under it goes)
      setTimeout(() => { if (surfaceVeil.current.state === 'off') el.style.backgroundImage = ''; }, 250);
    }
    surfaceLive.current = true;
    sendSurface({
      id: surfaceId,
      at: { x: r.left, y: r.top, w: r.width, h: r.height },
      key: hash,
      sheets,
      paper: paperArgs(spec),
      ...(pageless && runLen ? { foot: runLen.foot } : {}),
      look: { ...look, desk: hexOf(css.backgroundColor, '#e9e9e9'), accent: hexOf(css.getPropertyValue('--surface-accent') || css.outlineColor, '#b58a2a'), fg: hexOf(css.color, '#333333'), line: hexOf(css.borderTopColor, '#cccccc'), tag: hexOf(book ? getComputedStyle(book).getPropertyValue('--surface-tag') || css.columnRuleColor : css.columnRuleColor, '#ffffff') },
      pad: SURFACE_PAD,
      zoom: zoomRef.current,
      open: surfaceOpen.current,
      marks: surfaceMarks,
      holes: veil.state === 'on' ? [] : holes,
      add: !pageless,
      tagRoom: TAG_ROOM,
      ...(veil.state === 'on' ? { veiled: true } : {}),
    });
  };
  // told again whenever this draws, the page's layout changes, something is laid over the pages or taken away
  useEffect(() => { if (native) sendRef.current(); });
  useEffect(() => {
    if (!native || !surfaceEl) return;
    let timers: ReturnType<typeof setTimeout>[] = [];
    const soon = () => {
      for (const t of timers) clearTimeout(t);
      // (and again as what slid or faded in comes to rest)
      timers = [0, 140, 360, 700].map((ms) => setTimeout(() => sendRef.current(), ms));
    };
    const ro = new ResizeObserver(soon);
    ro.observe(surfaceEl);
    const mo = new MutationObserver(soon);
    mo.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['class', 'style', 'hidden', 'open', 'data-open', 'data-on'] });
    const off = onLayout(soon);
    window.addEventListener('resize', soon);
    document.addEventListener('transitionend', soon, true);
    document.addEventListener('animationend', soon, true);
    soon();
    return () => {
      for (const t of timers) clearTimeout(t);
      ro.disconnect(); mo.disconnect(); off();
      window.removeEventListener('resize', soon);
      document.removeEventListener('transitionend', soon, true);
      document.removeEventListener('animationend', soon, true);
    };
  }, [native, surfaceEl]);
  useEffect(() => {
    if (!native) return;
    return () => { dropSurface(surfaceId); surfaceOpen.current = undefined; };
  }, [native, surfaceId]);
  // the bar's zoom steps, ⌘0: the surface goes to the zoom the store has, when it is not the one it said
  useEffect(() => {
    if (!native) return;
    if (surfaceZoomAt.current === null) { surfaceZoomAt.current = zoom; return; }
    if (Math.abs(surfaceZoomAt.current - zoom) > 0.0005) { surfaceZoomAt.current = zoom; void surfaceZoom(surfaceId, zoom, true); }
  }, [native, zoom, surfaceId]);


  // ── a book's native surface (the native page view, phase 1): what it is told, what it says ──
  pdfSurfRef.current = pdfSurf;
  pdfSurfIdRef.current = pdfSurfId;
  /** Where it opens: where these pages were left, read once (it says where it is from then on). */
  const pdfOpen = useRef<{ page: number; y: number; x: number | null } | null | undefined>(undefined);
  const pdfZoomAt = useRef<number | null>(null);
  const pdfSend = useRef<() => void>(() => {});
  pdfSend.current = () => {
    const el = pdfSurfEl;
    const at = picturesOf(rel);
    // (not before the pages' count is known: a surface told it shows one page goes to the first)
    if (!pdfSurf || !el || !at || !hash || !sizes.length) return;
    const r = el.getBoundingClientRect();
    // a tab not shown has no surface
    if (!el.isConnected || r.width < 8 || r.height < 8) { dropPdfSurface(pdfSurfId); pdfOpen.current = undefined; return; }
    if (pdfOpen.current === undefined) {
      const was = places.get(id);
      const open = was?.at ? { page: was.at.page, y: was.at.y, x: was.x } : null;
      pdfOpen.current = open;
    }
    el.dataset.open = pdfOpen.current ? `${pdfOpen.current.page} ${pdfOpen.current.y.toFixed(3)}` : 'none';
    if (pdfZoomAt.current === null) pdfZoomAt.current = zoomRef.current;
    const css = getComputedStyle(el);
    // what the page lays on its pages, drawn by the surface (phase 3): fractions of each page
    const marksOut: Record<string, unknown>[] = [];
    for (const [key, h] of highlights) for (const q of h.quads) marksOut.push({ k: 'hl', key, page: q[0], x: q[1], y: q[2], w: q[3], h: q[4], ink: h.ink ?? 1 });
    for (const d of drawn) {
      d.boxes.forEach((b, i) => {
        const name = plainMath(d.name);
        marksOut.push({ k: 'box', key: d.key, page: b.page, x: b.x, y: b.y, w: b.w, h: b.h, tag: i ? `↳ ${name} (${i + 1}/${d.boxes.length})` : `§ ${name}${d.cards > 0 ? ` ◆${d.cards}` : ''}`, ...(lit === d.key ? { cur: true } : {}), ...(d.dismissed ? { dis: true } : {}), ...(flash?.text === d.key ? { flash: true } : {}) });
      });
    }
    pending.forEach((b, i) => marksOut.push({ k: 'pend', key: `pending:${i}`, page: b.page, x: b.x, y: b.y, w: b.w, h: b.h, ...(pending.length > 1 ? { no: i + 1 } : {}) }));
    if (ruler) marksOut.push({ k: 'rule', page: ruler.page, x: 0, y: ruler.band.top, w: 1, h: ruler.band.bottom - ruler.band.top });
    if (readPoint && readPoint.pos >= first && readPoint.pos <= last) marksOut.push({ k: 'read', page: readPoint.pos, x: 0, y: readPoint.y, w: 1, h: 0 });
    for (const [key, m] of bookmarks) marksOut.push({ k: 'bm', key, page: m.page, x: 0, y: m.y, w: 0, h: 0 });
    for (const [key, m] of portals) marksOut.push({ k: 'portal', key, page: m.page, x: 1, y: m.y, w: 0, h: 0 });
    sendPdfSurface({
      id: pdfSurfId, x: r.left, y: r.top, w: r.width, h: r.height,
      root: at.root, hash: at.hash,
      zoom: zoomRef.current, open: pdfOpen.current,
      dark: theme === 'dark', desk: hexOf(css.backgroundColor, '#e9e9e9'),
      holes: holesOver(el), top: 12, first, last,
      marks: marksOut,
      accent: hexOf(css.getPropertyValue('--accent').trim(), '#b58a2a'),
      fg: hexOf(css.getPropertyValue('--fg').trim() || css.color, '#333333'),
      paper: hexOf(css.getPropertyValue('--paper').trim(), '#ffffff'),
    });
  };
  useEffect(() => { if (pdfSurf) pdfSend.current(); });
  useEffect(() => {
    if (!pdfSurf || !pdfSurfEl) return;
    let timers: ReturnType<typeof setTimeout>[] = [];
    const soon = () => {
      for (const t of timers) clearTimeout(t);
      timers = [0, 140, 360, 700].map((ms) => setTimeout(() => pdfSend.current(), ms));
    };
    const ro = new ResizeObserver(soon);
    ro.observe(pdfSurfEl);
    const mo = new MutationObserver(soon);
    mo.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['class', 'style', 'hidden', 'open', 'data-open', 'data-on'] });
    const off = onLayout(soon);
    window.addEventListener('resize', soon);
    document.addEventListener('transitionend', soon, true);
    soon();
    return () => {
      for (const t of timers) clearTimeout(t);
      ro.disconnect(); mo.disconnect(); off();
      window.removeEventListener('resize', soon);
      document.removeEventListener('transitionend', soon, true);
    };
  }, [pdfSurf, pdfSurfEl]);
  useEffect(() => {
    if (!pdfSurf) return;
    return () => { dropPdfSurface(pdfSurfId); pdfOpen.current = undefined; };
  }, [pdfSurf, pdfSurfId]);
  // what it says: where the pages are (the page in view, the place kept, the read point), and the zoom it came to
  useEffect(() => {
    if (!pdfSurf) return;
    return onSurface(pdfSurfId, (e) => {
      const m = e as unknown as { what: string; page: number; y: number; x?: number; zoom: number; settled: boolean; asked?: boolean; foot: number; footY: number };
      if (m.what !== 'pdfplace') { pdfHear.current(e as unknown as Record<string, unknown>); return; }
      setCurrent(m.page);
      place.current = { page: m.page, y: m.y };
      placeX.current = m.x ?? null;
      landed.current = true;
      places.set(id, { top: 0, at: place.current, x: placeX.current });
      const v = viewRef.current;
      if (v) { v.dataset.atPage = String(m.foot); v.dataset.atY = m.footY.toFixed(3); v.dataset.topPage = String(m.page); v.dataset.topY = m.y.toFixed(4); }
      afterScroll.current();
      if (m.settled && !m.asked) {
        // the reader's own zoom (two fingers, two taps): kept, held as a pinch is held (to a hundredth, fit within 3%),
        // and the surface put exactly there where that is not where it stopped
        const z = zoomHeld(m.zoom);
        pdfZoomAt.current = z;
        if (Math.abs(z - zoomRef.current) > 0.005) setBookZoom(id, z);
        if (Math.abs(z - m.zoom) > 0.0005) void pdfDo({ id: pdfSurfId, op: 'zoom', zoom: z, animated: true });
      } else if (!m.settled) {
        // (the bar's word follows the fingers)
        const t = inBarRef.current('.pt-pct')?.firstChild;
        if (t && t.nodeType === 3) t.nodeValue = `${Math.round(m.zoom * 100)}%`;
      }
    });
  }, [pdfSurf, pdfSurfId, id]);
  /** What the surface says besides where it is: a selection, an action from its menu, a tap (a link's place). */
  const pdfHear = useRef<(m: Record<string, unknown>) => void>(() => {});
  pdfHear.current = (m) => {
    if (m.what === 'pdfsel') {
      const text = String(m.text ?? '');
      if (!text) { setSel(null); return; }
      const quads = (m.quads as number[][]).map((q) => [q[0], q[1], q[2], q[3], q[4]] as Quad);
      const byPage = new Map<number, { x: number; y: number; w: number; h: number }[]>();
      for (const q of quads) byPage.set(q[0], [...(byPage.get(q[0]) ?? []), { x: q[1], y: q[2], w: q[3], h: q[4] }]);
      const boxes = [...byPage].sort((a, b) => a[0] - b[0]).map(([n, rs]) => boxAround(n, rs)).filter((b): b is Box => b !== null);
      const r = m.rect as number[];
      setSel({ text, page: Number(m.page), rect: new DOMRect(r[0], r[1], r[2], r[3]), line: '', boxes, quads });
      if (viewRef.current) viewRef.current.dataset.selRect = r.map((v) => Math.round(v)).join(',');
      if (viewRef.current && quads[0]) viewRef.current.dataset.selQuad = quads[0].join(' ');
      return;
    }
    if (m.what === 'pdfact') {
      if (m.act === 'passage') void makeSection().catch(console.error);
      else if (m.act === 'card') void cardOrClip().catch(console.error);
      return;
    }
    if (m.what === 'pdfbox') {
      // a box drawn by a held finger where there was no word: one of the boxes drawn, for a passage or a card
      const r = m.rect as number[];
      setPending((cur) => [...cur, { page: Number(m.page), x: Number(m.x), y: Number(m.y), w: Number(m.w), h: Number(m.h) }]);
      setPdfPend({ x: r[0]!, y: r[1]!, w: r[2]!, h: r[3]! });
      return;
    }
    if (m.what === 'pdftap') {
      // a link there is followed, as a press on the web reader's page follows it (its links read by pdf.js, as they
      // come); else a mark there answers: a portal goes, a passage's box or tag opens its menu, a highlight its own
      const n = Number(m.page); const x = Number(m.x); const y = Number(m.y);
      const gx = Number(m.gx ?? 0); const gy = Number(m.gy ?? 0);
      const at = { left: gx, top: gy, bottom: gy };
      void (async () => {
        if (!pdf) return;
        // a tap on the pages lets go of the boxes drawn and not yet made into anything, whatever else it does
        if (st.current.pending.length) { setPending([]); setPdfPend(null); }
        if (n < 1) return;
        if (!links.current.has(n)) {
          try {
            const page = await pdf.getPage(n);
            const v1 = page.getViewport({ scale: 1 });
            const toView = typeof v1.convertToViewportPoint === 'function'
              ? (rr: number[]) => [...v1.convertToViewportPoint(rr[0]!, rr[1]!), ...v1.convertToViewportPoint(rr[2]!, rr[3]!)] as number[]
              : flipRect([0, 0, v1.width, v1.height]);
            links.current.set(n, pageLinks(await page.getAnnotations(), toView, v1.width, v1.height));
          } catch { links.current.set(n, []); }
        }
        const l = (links.current.get(n) ?? []).find((k) => x >= k.x && x <= k.x + k.w && y >= k.y && y <= k.y + k.h);
        if (viewRef.current) viewRef.current.dataset.tapped = `${n} ${x.toFixed(3)} ${y.toFixed(3)} link:${l ? 1 : 0}`;
        if (l) { await followLink(l, n); return; }
        const portal = portals.find(([, p]) => p.page === n && x > 0.9 && Math.abs(p.y - y) < 0.02);
        if (portal) { await openPortal(portal[1], { getBoundingClientRect: () => new DOMRect(gx - 8, gy - 8, 16, 16) } as unknown as HTMLElement); return; }
        const hlId = highlightAt(marksRef.current, n, x, y);
        const hl = hlId !== null ? marksRef.current[hlId] : undefined;
        if (viewRef.current) viewRef.current.dataset.tapped = `${n} ${x.toFixed(3)} ${y.toFixed(3)} ${hlId ?? '-'}`;
        if (hlId !== null && hl?.kind === 'highlight') {
          popMenu(at, [
            { label: 'passage', act: 'hl-section', run: () => void makeSection(quadBoxes(hl.quads)).catch(console.error) },
            { label: 'card', act: 'hl-card', run: () => void cardOrClip(quadBoxes(hl.quads)).catch(console.error) },
            { label: 'clear', act: 'hl-clear', run: () => clearHighlight(hlId) },
            { label: '-' },
            ...INK_NAMES.map((name, i): PopItem => ({ label: `${i + 1} · ${name}${hl.ink === i + 1 ? ' ✓' : ''}`, act: `ink-${i + 1}`, run: () => inkHighlight(hlId, i + 1) })),
          ], 'book-menu');
          return;
        }
        // (a passage's box or tag after a highlight: a highlight lies in a passage more often than not)
        const d = drawn.find((dd) => dd.boxes.some((b) => b.page === n && x >= b.x && x <= b.x + Math.max(b.w, 0.3) && y >= b.y - 0.02 && y <= b.y + b.h));
        if (d) { passageMenuAt({ left: gx, bottom: gy }, d); return; }
      })();
    }
  };
  // a search's hits drawn by the surface, the current one brought into view
  useEffect(() => {
    if (!pdfSurf) return;
    if (!find || !find.q.trim()) { void pdfDo({ id: pdfSurfId, op: 'find', q: '' }); return; }
    const hit = hitAt(find.pages, find.at);
    void pdfDo({ id: pdfSurfId, op: 'find', q: find.q, ...(hit ? { page: hit.page, k: hit.k } : {}) });
  }, [pdfSurf, pdfSurfId, find?.q, find?.at, find?.go, find?.pages]);
  // the bar's zoom steps, ⌘0: the surface goes to the zoom the store has, when it is not the one it said
  useEffect(() => {
    if (!pdfSurf) return;
    if (pdfZoomAt.current === null) { pdfZoomAt.current = zoom; return; }
    if (Math.abs(pdfZoomAt.current - zoom) > 0.0005) { pdfZoomAt.current = zoom; void pdfDo({ id: pdfSurfId, op: 'zoom', zoom, animated: true }); }
  }, [pdfSurf, zoom, pdfSurfId]);

  if ((status === 'unreadable' || status === 'gone') && info) {
    // why, in plain words, and a way to try again (it is tried by itself when the file lands)
    const why = fail ?? { kind: 'other' as const, said: 'could not open this pdf', detail: '' };
    return (
      <div className="reader-wrap">
        <div className="reader">
          <div className="empty pdf-fail" data-why={why.kind} role="status">
            <span className="pf-said">{why.said}</span>
            {why.detail && <span className="pf-detail">{why.detail}</span>}
            <button type="button" className="pf-again" data-act="pdf-again" onClick={() => { opening(null); void import('./sync.js').then((m) => m.retakeFile(rel ?? '')).catch(console.error).finally(() => setTries((n) => n + 1)); }}>try again</button>
          </div>
        </div>
      </div>
    );
  }
  if (!info && !docsKnown) {
    // drawn before the collection has said what it holds (a tab kept from last time): it is opening, not gone
    return <div className="reader-wrap"><div className="reader"><div className="empty" data-why="opening">opening</div></div></div>;
  }
  if (!info && isPdfPath(id)) {
    // a PDF the collection does not hold: gone, or still on its way from the device it was added on. It opens by
    // itself when it lands (the collection then knows it, and this is drawn again as its pages)
    return (
      <div className="reader-wrap">
        <div className="reader">
          <div className="empty pdf-fail" data-why="absent" role="status">
            <span className="pf-said">this pdf is not in the collection</span>
            <span className="pf-detail">if it was added on another device it may still be arriving · it opens by itself when it lands</span>
          </div>
        </div>
      </div>
    );
  }
  if (status === 'gone' || status === 'unreadable' || !info) {
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
  const where = status === 'ok' && sizes.length && !pageless ? `p. ${current} / ${last}` : '';
  // (a phone's bar has room for the page alone: what is due is on the day)
  const shown = [where, due && !phone ? `${due} due` : ''].filter(Boolean).join(' · ') || readTo || (cards ? plural(cards, 'card') : '') || (textless && status === 'ok' ? 'no text' : '');
  /** The pages can be written on: there is a canvas (an iPad's) and a key their strokes are kept under. */
  const canWrite = mobile && hasCanvas() && hash !== null;
  canWriteRef.current = canWrite && !phone;
  /** The tools' row: an iPad's (a phone's bar is one line). */
  const inkRow = canWrite && !phone && status === 'ok' && toolsShown;
  /** What is written on the pages is drawn by the page, as paths (89, `pageInk.ts`), wherever the pages are the page's own (a notebook's on an iPad are a surface): a PDF's on every device, where there are canvases what they say shown at once; a notebook's sheets read on a Mac or a phone, from what the store holds. One renderer: as sharp as the screen at any zoom, a stroke as wide as it was written. */
  const vectorInk = true;
  /** The scroller the pages lie in, and the book over them: where the lasso's menu and the overview are drawn. */
  const scrollerEl = wrapRef.current?.closest<HTMLElement>('.book-pages, .pane-body') ?? null;
  const bookEl = wrapRef.current?.closest<HTMLElement>('.book') ?? null;
  const shownPending = [...pending, ...(sel?.boxes ?? [])];
  const lastPending = pending.length ? boxRect(pending[pending.length - 1]!) : null;

  return (
    <div className="reader-wrap" ref={outerRef} data-wide={wide && !native && !pdfSurf ? '1' : undefined} data-native={native || pdfSurf ? '1' : undefined}>
      <div ref={viewRef} className={`reader doc-view pdf-view${reading ? ' reading' : ''}`} data-page={current} data-roomy={roomy ? '1' : '0'} data-zoom={zoom} data-back={trail.back.length} data-fwd={trail.forward.length} data-hash={hash ?? undefined} data-bookmarks={bookmarks.length} data-highlights={highlights.length} data-portals={portals.length} data-ruler={ruler ? `${ruler.page}:${ruler.line}` : undefined} data-following={follower ? '1' : undefined} data-portal={showing ?? undefined} data-written={written ? '1' : undefined} data-layout={pageless ? 'pageless' : undefined} data-tools={inkRow ? '1' : undefined} data-surface={native ? surfaceId : undefined} data-sel={sel ? sel.text.length : undefined} style={native || pdfSurf ? undefined : colW > 0 ? { width: pageW, ...(wide ? { '--fit-w': `${colW}px`, '--fit-left': `${room.left}px` } as React.CSSProperties : null) } : undefined}>
        {/* the bar over the pages, as wide as the pane whatever the page's width: what the book is, its notes, the zoom, the page, search */}
        {overPages(<>
        <div className="meta pdf-tools" data-ink={inkRow ? '1' : undefined} style={native || pdfSurf || outside ? undefined : colW > 0 ? { width: room.w + room.left + room.pad, marginLeft: wide ? -room.left : -((colW - pageW) / 2 + room.left) } : undefined}>
          {/* the bar's first row: the row itself only where the tools make a second under it (an iPad); anywhere else its words are the bar's own */}
          <div className="pt-row">
          {status === 'ok' && !written && <button type="button" className="pt-btn" data-tool="contents" title="contents t" aria-label="contents" onClick={() => openContents(id)}><Icon name="menu" /></button>}
          {/* after a jump (a link, a heading, a hit, a mark): back to where it was made from, what ⌫ does; a finger has no ⌫ */}
          {status === 'ok' && trail.back.length > 0 && <button type="button" className="frozen-tag pt-back" data-tool="back" title="back to where you were ⌫" onClick={() => { goBack(); }}>back</button>}
          <h1 className="pt-title" title={id}>{titleOf(id, docs, root)}</h1>
          {/* a written notebook is its own notes: the word is there only when it has a note already */}
          {!(phone && session) && (!written || hasNotes) && <button type="button" className="frozen-tag notes-toggle" data-on={notesOpen ? '1' : '0'} data-has={hasNotes ? '1' : '0'} aria-pressed={notesOpen} title={'notes ⌘\\'} onClick={() => toggleNotes(id)}>{notesOpen ? 'hide notes' : hasNotes ? 'open notes' : 'create notes'}</button>}
          {!phone && canAddNote && (hasNotes || !written) && <button type="button" className="pt-btn notes-add" data-tool="new-note" title={written ? 'new note' : 'new notes'} aria-label={written ? 'new note' : 'new notes'} aria-haspopup={written ? undefined : 'menu'} onClick={(e) => addMenu(e.currentTarget)}>+</button>}
          {/* a notebook of paper has its children as tabs as any document has (`tabs`), once it has any */}
          {!isPdfPath(id) && <TabsToggle path={id} />}
          {/* paper is written on where there is a canvas; anywhere else it is shown, and says where it is written */}
          {written && !canWrite && !phone && <span className="pt-readonly" role="note">written on an ipad</span>}
          <StudyButton path={id} />
          <ExamTag path={id} />
          {follower && <span className="frozen-tag following" title="this pane shows where the portals of the page being read lead; close it to stop">following portals</span>}
          {info && canEnrol && !info.read && (
            <button type="button" className="frozen-tag enrol" onClick={startReading}>start reading <span className="kbd">r</span></button>
          )}
          <span className="pt-grow" />
          {status === 'ok' && sizes.length > 0 && (
            <span className="pt-zoom">
              <button type="button" className="pt-btn" data-tool="zoom-out" title="smaller ⌘−" aria-label="smaller" disabled={zoom <= ZOOMS[0]!} onClick={() => zoomBy(-1)}>−</button>
              <button type="button" className="pt-btn pt-pct" data-tool="zoom-fit" title="fit the window ⌘0" onClick={() => zoomBy(0)}>{`${Math.round(zoom * 100)}%`}</button>
              <button type="button" className="pt-btn" data-tool="zoom-in" title="larger ⌘=" aria-label="larger" disabled={zoom >= ZOOMS[ZOOMS.length - 1]!} onClick={() => zoomBy(1)}>+</button>
            </span>
          )}
          {canWrite && !phone && status === 'ok' && <InkToggle />}
          {status === 'ok' && sizes.length > 1 && !phone && !pageless && <button type="button" className="pt-btn" data-tool="pages" title="all pages" aria-label="all pages" aria-pressed={grid} onClick={() => setGrid((g) => !g)}><Icon name="grid" /></button>}
          {shown && <button type="button" className="right pt-page" data-tool="page" title={[rightTip, 'g goes to a page'].filter(Boolean).join(' · ')} onClick={() => setGoto(true)}>{shown}</button>}
          {status === 'ok' && <button type="button" className="pt-btn" data-tool="more" title={written ? 'pages, page setup, share' : 'pages, share, bookmark, portal, ruler'} aria-label="more" aria-haspopup="menu" onClick={(e) => moreMenu(e.currentTarget)}><Icon name="more" /></button>}
          {status === 'ok' && !written && <button type="button" className="pt-btn" data-tool="search" title="search /" aria-label="search" aria-pressed={!!find} onClick={() => {
            // pressed with the search open, it closes it and its hits go (a finger has no esc)
            if (find) { setFind(null); return; }
            setFind({ q: '', pages: [], at: 0 });
            setTimeout(() => findRef.current?.focus(), 0);
          }}><Icon name="search" /></button>}
          </div>
          {/* the tools to write with, a second row of the bar: wherever the pages can be written on (the row decides itself that it is an iPad) */}
          {inkRow && <InkBar id={id} />}
        </div>
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
                    // the field lets the focus go first: the web view brings a focused field back into view, and would undo the scroll
                    e.currentTarget.blur();
                    if (n >= 1) { leave(); whenSeen(n, () => scrollTo(n)); }
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
            {portalFrom && active && <span className="pb-n pb-wait" role="status" data-portal="pending">{mobile ? 'portal: go to where it should show, then ⋯ · portal' : 'portal: go to where it should show, ⇧P again'}</span>}
            {looking && <span className="pb-n" role="status">looking</span>}
          </div>
        )}
        </>)}
        <div className={`doc-wrap pdf-body${reading ? ' reading' : ''}`} ref={wrapRef}>
          {reading && <div className="read-gutter" onPointerDown={gutterDown} onPointerMove={gutterMove} onPointerUp={gutterUp} />}
          {reading && status === 'ok' && (
            <>
              <div className="read-rule read-bar" style={{ top: 0, height: barHeight }} title={readPoint ? `read to p. ${readPoint.pos}` : undefined} />
              <div className="read-edge" style={{ top: barHeight }}><span className="read-knob" /></div>
            </>
          )}
          {/* an iPad's notebook: its pages are a surface of the system's own, lying over this place (87); what stands on the pages is drawn here, over it */}
          {native && (
            <div className="note-surface" ref={setSurfaceEl} data-moving={surfaceAt.moving ? '1' : undefined}>
              {/* where each sheet in view lies under the surface, as the surface last said: nothing is drawn here, but what asks where a page is (a menu's place, a check) finds it */}
              {surfaceAt.lay && sheets && sheets.map((n, i) => {
                const [x, y, w, h, pitch] = surfaceAt.lay as [number, number, number, number, number];
                return <div key={n} className="pdf-page sheet-place" data-page={i + 1} data-sheet={n} data-paper={written?.paper} data-rule={written ? paperOf(written, i).rule : undefined} aria-hidden="true" style={{ left: x, top: y + i * pitch, width: w, height: h }} />;
              })}
              {surfaceAt.pend && !surfaceAt.moving && pending.length > 0 && (
                <div data-hit="1" data-ink-over="" className="pend" style={{ left: Math.max(6, Math.min(surfaceAt.pend.x, (surfaceEl?.clientWidth ?? 9999) - 250)), top: surfaceAt.pend.y + surfaceAt.pend.h + 6 > (surfaceEl?.clientHeight ?? 9999) - 52 ? Math.max(6, surfaceAt.pend.y - 52) : surfaceAt.pend.y + surfaceAt.pend.h + 6 }}>
                  <button type="button" data-k="e" {...press(() => void makeSection().catch(console.error))}><span className="pe-l">passage{pending.length > 1 ? ` · ${pending.length} boxes` : ''}</span></button>
                  <button type="button" data-k="m" {...press(() => void cardOrClip().catch(console.error))}><span className="pe-l">card</span></button>
                </div>
              )}
            </div>
          )}
          {/* an iPad's book with the setting on: its pages are a native surface lying over this place */}
          {pdfSurf && (
            <div className="note-surface pdf-surface" ref={setPdfSurfEl} data-surface={pdfSurfId} data-pending={pending.length || undefined}>
              {pdfPend && pending.length > 0 && pdfSurfEl && (() => {
                const sr = pdfSurfEl.getBoundingClientRect();
                const left = Math.max(6, Math.min(pdfPend.x - sr.left, sr.width - 250));
                const below = pdfPend.y + pdfPend.h + 6 - sr.top;
                const top = below > sr.height - 52 ? Math.max(6, pdfPend.y - sr.top - 52) : below;
                return (
                  <div data-hit="1" data-ink-over="" className="pend" style={{ left, top }}>
                    <button type="button" data-k="e" {...press(() => void makeSection().then(() => setPdfPend(null)).catch(console.error))}><span className="pe-l">passage{pending.length > 1 ? ` · ${pending.length} boxes` : ''}</span></button>
                    <button type="button" data-k="m" {...press(() => void cardOrClip().then(() => setPdfPend(null)).catch(console.error))}><span className="pe-l">card</span></button>
                  </div>
                );
              })()}
            </div>
          )}
          {!native && !pdfSurf && <div className="pdf-pages" ref={pagesRef} data-run={pageless && colH < tops.total ? '1' : undefined} data-run-len={pageless && runLen ? `${runLen.len} ${runLen.foot.toFixed(1)}` : undefined} style={{ height: colH || undefined, width: pageW }} onPointerDown={onPointerDown} onMouseDown={onMouseDown} onClick={onPress} onPointerMove={onHover} onContextMenu={onMenu}>
            {status === 'loading' && <div className="empty">opening</div>}
            {sizes.map((s, i) => (
              // a notebook's page is its sheet: known by the sheet's number, so a page deleted before it leaves it as it is
              <div
                key={sheets ? `sheet:${sheets[i]}` : base + i + 1}
                className="pdf-page"
                data-page={base + i + 1}
                data-sheet={sheets ? sheets[i] : undefined}
                data-paper={written?.paper}
                data-ink-dark={inkDark ? '1' : undefined}
                ref={(el) => { if (el) pageEls.current.set(base + i + 1, el); else pageEls.current.delete(base + i + 1); }}
                // (a pageless notebook's sheets past its long sheet's foot are not shown, and the one the foot falls on is cut there: 88)
                data-cut={cutAt(i) < onPixel(s.h * scale, dpr) ? '1' : undefined}
                style={{ width: onPixel(s.w * scale, dpr), height: Math.max(0, cutAt(i)), top: tops.at[i + 1], ...(cutAt(i) <= 0 ? { display: 'none' } : null), ...(cutAt(i) < onPixel(s.h * scale, dpr) ? { '--full-h': `${onPixel(s.h * scale, dpr)}px` } as React.CSSProperties : null) }}
              >
                {/* the paper of every sheet, near or far: lines are cheap, and a page scrolled to fast is never bare (85) */}
                {written ? <PaperSheet spec={paperOf(written, i)} px={(onPixel(s.w * scale, dpr) / s.w) * dpr} /> : null}
              </div>
            ))}
            {hash && (Object.keys(inked).length > 0 || (vectorInk && liveInk.size > 0)) && (
              <div className="pdf-ink" data-paper={written?.paper} data-ink-dark={inkDark ? '1' : undefined}>
                {sizes.map((s, i) => {
                  const n = base + i + 1;
                  // what is written on it is kept under the page's own number: a notebook's sheet
                  const page = sheetAt(n);
                  // a page's writing is made when the page itself is drawn, as it comes near
                  const r = page !== null && (inked[page] !== undefined || (vectorInk && liveInk.has(page))) && (sheets ? isNear(n) || (pageless && near !== null && n < near.lo && n >= near.lo - RUNS_OVER) : rendered.current.has(n)) ? pageRect(n) : null;
                  // (89) where there are canvases a PDF's page draws its writing itself, a path a stroke: it goes wherever the page goes
                  // (a notebook's sheet says its paper, and whether that is dark; a pageless one's strokes run on past its foot)
                  return r && page !== null && <PageInkSvg key={page} hash={hash} page={page} at={n} w={s.w} h={s.h} rev={inked[page] ?? 0} rect={r} sheet={`p.${hash}.${page}`} paper={written?.paper} dark={written ? inkDark : undefined} run={pageless} onShown={pictureShown} />;
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
              {status === 'ok' && drawn.map((d) => {
                const { cards: n, dismissed } = d;
                const p = d;
                const cur = lit === d.key;
                const flashing = flash?.text === d.key;
                return p.boxes.map((b, i) => {
                  const r = boxRect(b);
                  if (!r) return null;
                  const label = i ? `↳ ${plainMath(p.name)} (${i + 1}/${p.boxes.length})` : plainMath(p.name);
                  return (
                    <div key={`${d.section ? d.section.index : 's'}:${d.key}:${i}`} className="pbox-group">
                      <div
                        className={`pbox${cur ? ' cur' : ''}${dismissed ? ' dis' : ''}${flashing ? ' flash' : ''}`}
                        data-section={d.key}
                        data-kept={d.section ? '0' : '1'}
                        data-page={b.page}
                        style={{ left: r.left, top: r.top, width: r.width, height: r.height }}
                      />
                      {roomy ? (
                        <div data-hit="1" data-for={d.key} className={`ptag${i ? ' cont' : ''}${cur ? ' cur' : ''}${dismissed ? ' dis' : ''}`} style={{ left: pageW + 12, top: r.top }} title={d.section ? 'go to this section in the notes' : 'passage'} onMouseDown={(e) => passageMenu(e, d)}>
                          {!i && <span className="pt-g">§</span>}{label}{!i && n > 0 && <span className="pt-c">◆{n}</span>}
                        </div>
                      ) : (
                        <div data-hit="1" data-for={d.key} className={`pgut${cur ? ' cur' : ''}${dismissed ? ' dis' : ''}`} style={{ left: pageW + 3, top: r.top }} title={label} onMouseDown={(e) => passageMenu(e, d)}>{i ? '↳' : '§'}</div>
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
                <div data-hit="1" className="pend" style={{ left: Math.max(0, Math.min(lastPending.left, (pagesRef.current?.clientWidth ?? 9999) - (mobile ? 340 : 280))), top: lastPending.top + lastPending.height + 6 }}>
                  <button type="button" data-k="e" onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); void makeSection().catch(console.error); }}><kbd>e</kbd><span className="pe-l">passage{pending.length > 1 ? ` · ${pending.length} boxes` : ''}</span></button>
                  <button type="button" data-k="m" onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); void cardOrClip().catch(console.error); }}><kbd>m</kbd><span className="pe-l">card</span></button>
                  {!written && <button type="button" data-k="h" onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); doHighlight(); }}><kbd>h</kbd><span className="pe-l">highlight</span></button>}
                  {mobile && !written && <button type="button" data-k="web" onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); lookUnder(); }}><span className="pe-l">look up</span></button>}
                  {!mobile && <button type="button" data-k="esc" onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); clearBoxes(); }}><kbd>esc</kbd></button>}
                </div>
              )}
            </div>
          </div>}
          {/* under a notebook's last page: one more */}
          {written && status === 'ok' && !pageless && !native && (
            <button type="button" className="add-page" data-tool="add-page" style={{ width: pageW }} onClick={morePage}>add page</button>
          )}
          {canWrite && (native ? <InkMenu host={surfaceId} scroller={surfaceEl} /> : <InkMenu host={`pages:${id}`} scroller={scrollerEl} />)}
          {setup && written && bookEl && <PageSetup id={id} into={bookEl} written={written} onClose={() => setSetup(false)} />}
          {grid && bookEl && status === 'ok' && (
            <PageGrid id={id} into={bookEl} written={written} hash={hash} base={base} sizes={sizes} current={current} inked={inked} pdf={pdf}
              onGo={(n) => { setGrid(false); setTimeout(() => scrollTo(n), 0); }} onDelete={(n, at) => deletePage(n, at)} onClose={() => setGrid(false)} />
          )}
          {sel && (
            <div className="sel-cue" style={{ top: sel.rect.bottom + 8, left: sel.rect.left }}>
              <button type="button" className="cue-act" {...press(() => void makeSection().catch(console.error))}>
                passage <span className="kbd">e</span>
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
              style={{ top: Math.max(60, Math.min(peek.rect.bottom + 8, visibleBottom() - (/^fig/i.test(peek.text.trim()) ? PEEK_FIG_H + 70 : 220))), left: Math.max(8, Math.min(peek.rect.left, window.innerWidth - PEEK_W - 40)) }}
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
