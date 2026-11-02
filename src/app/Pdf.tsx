// A document with pages opens as a book (milestone 48): its PDF's pages on
// the left, rendered by pdf.js with the text layer on, and its body on the
// right in the full editor: the person's notes on those pages, one
// continuous document, never frozen. ⌘\ hides the notes and shows them.
//
// The pages carry what the notes say about them. A gold bar in the margin
// runs from the first page to the read point (`pos` and `y` on the `read`
// line). Boxes drawn on the pages (drag; drag again for another, on any
// page; a text selection boxes its lines) become a section of the notes
// with `e`: a `##` heading named from the page, in book order, with its
// `<!-- read … boxes=… -->` line, back in three days until dismissed
// (FORMAT.md §6.5). `m` makes the section and puts the caret in it to card,
// or on a page that names no sections (a passage book, Arabic) clips the
// box into the notes under `## p. N` (§6.6). Every section's boxes are drawn
// on its pages, tagged with its name (a § in the gutter when there is no
// room), dashed once dismissed; the caret's section lights its boxes and
// the pages scroll to them. Nothing is written into the PDF, ever; every
// change goes to the Markdown, through the open notes' writer.

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { boxesEnd, formatClip, meta, sectionDismissed, setField, type Box, type Doc } from '../format/index.js';
import { boxAround, countIn, findAll, findText, jumpTarget, linesOf, refOf, sectionName, type Found, type PageItem } from '../pdf/index.js';
import { pickPos, type Band } from '../reader/index.js';
import { addPassage, passagesOf, pointOn, sectionState, type Passage } from '../schedule/index.js';
import { addToPage, childDirOf } from '../vault/index.js';
import { CueActions } from '../plugins/CueActions.js';
import { onPluginAction, publishSelection, toPluginSelection, type PluginSelection } from '../plugins/index.js';
import { titleOf } from './names.js';
import { TextLayer, pageBits, type PDFDocumentProxy } from './pdfjs.js';
import { acquirePdf, itemsOf } from './bookPdf.js';
import { Crumbs } from './Crumbs.js';
import { Reader } from './Reader.js';
import { StudyButton } from './StudyButton.js';
import { ExamTag } from './ExamTag.js';
import { TabsToggle } from './TabsToggle.js';
import { useApp, type DocInfo } from './store.js';
import { useDoc } from './useDoc.js';
import { currentVault, enrolReading } from './vault.js';
import { writeDoc } from './sections.js';
import { notify } from './land.js';
import { appNow } from './clock.js';
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
/** The narrowest a page is drawn while names still sit beside it. */
const PAGE_MIN = 420;
/** The widest a page is drawn. */
const PAGE_MAX = 860;
/** Room at the page's right for the gutter's §. */
const GUTTER = 18;
/** How far back from a passage the lens reads pages for a heading to name it. */
const NAME_BACK = 30;

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
}

interface Size { w: number; h: number }

/** Smart jump's answer: the page a reference points to, shown in a peek without leaving the page. */
interface Peek {
  page: number;
  /** The target line's baseline and type size, in PDF units. */
  y: number;
  height: number;
  text: string;
  rect: DOMRect;
}

/** How much of the target page the peek shows, css px at the page's scale. */
const PEEK_H = 150;
const PEEK_W = 480;

interface Find {
  q: string;
  /** Pages with a hit, in order, and how many on each. */
  pages: { page: number; n: number }[];
  /** Index into `pages` of the one shown. */
  at: number;
}

interface Rect { left: number; top: number; width: number; height: number }

// ── highlights: the CSS Custom Highlight API, one registry for every lens ──

type HighlightKind = 'ilmi-extract' | 'ilmi-hit';
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

// ── the book: pages beside notes ─────────────────────────────────

interface PdfProps {
  id: string;
  /** In the active pane: keys that need no selection reach this lens. */
  active?: boolean;
  /** Inside a reading session: `[` `]` belong to the session. */
  session?: boolean;
  /** A session reading on in the book: the pages land at the read point. */
  readOn?: boolean;
}

export function Pdf({ id, active = true, session = false, readOn = false }: PdfProps) {
  const hidden = useApp((s) => s.notesHidden);
  // ⌘\ hides the notes and shows them, ahead of the app's split (it checks `defaultPrevented`)
  useEffect(() => {
    if (!active) return;
    const onKey = (e: KeyboardEvent) => {
      if (!(e.metaKey || e.ctrlKey) || e.shiftKey || e.altKey || e.key !== '\\') return;
      e.preventDefault();
      useApp.setState((s) => ({ notesHidden: !s.notesHidden }));
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [active]);
  return (
    <div className="book" data-notes={hidden ? '0' : '1'} data-path={id}>
      <div className="book-pages"><Pages id={id} active={active} session={session} readOn={readOn} /></div>
      {!hidden && <div className="book-notes"><Reader key={id} id={id} active={active} notes /></div>}
    </div>
  );
}

/** A passage's boxes on the pages, its heading's name, its cards, its state. */
interface Drawn {
  passage: Passage;
  cards: number;
  dismissed: boolean;
}

function Pages({ id, active, session, readOn }: Required<PdfProps>) {
  const docs = useApp((s) => s.docs);
  const root = useApp((s) => s.vault);
  const caret = useApp((s) => s.caretHeading);
  const focus = useApp((s) => s.bookFocus);
  const reveal = useApp((s) => s.reveal);
  const notesHidden = useApp((s) => s.notesHidden);
  const info: DocInfo | undefined = docs[id];
  const loaded = useDoc(id);
  const [status, setStatus] = useState<'loading' | 'ok' | 'gone'>('loading');
  const [pdf, setPdf] = useState<PDFDocumentProxy | null>(null);
  const [sizes, setSizes] = useState<Size[]>([]);
  const [textless, setTextless] = useState(false);
  const [colW, setColW] = useState(0);
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
  const viewRef = useRef<HTMLDivElement>(null);
  const pagesRef = useRef<HTMLDivElement>(null);
  const findRef = useRef<HTMLInputElement>(null);
  const gotoRef = useRef<HTMLInputElement>(null);
  const pageEls = useRef(new Map<number, HTMLDivElement>());
  const rendered = useRef(new Map<number, number>());
  const rendering = useRef(new Set<number>());
  const texts = useRef(new Map<number, string>());
  const dragRef = useRef(false);
  const st = useRef({ sel, pending, recent, find, goto, peek });
  st.current = { sel, pending, recent, find, goto, peek };
  const canEnrol = info?.type === 'source' || info?.type === 'extract' || info?.type === 'note';
  const reading = !!info?.read && info.type !== 'note';
  const rel = info?.pdf;

  // ── the file, shared with the notes' crops ──
  const range = info?.pages;
  useEffect(() => {
    if (!rel) return;
    let live = true;
    const held = acquirePdf(rel);
    rendered.current.clear();
    texts.current.clear();
    lines.current.clear();
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
      setBase(lo - 1);
      setPdf(doc);
      setSizes(out);
      setTextless(!hasText);
      setStatus('ok');
    })().catch((e: unknown) => { console.error(id, e); if (live) setStatus('gone'); });
    return () => {
      live = false;
      held.release();
      setPdf(null);
      setSizes([]);
      setStatus('loading');
    };
  }, [id, rel, range?.first, range?.last]);

  // the column's width sets the scale: a page fits it, with room for the names beside it when there is room
  useLayoutEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setColW(el.clientWidth));
    ro.observe(el);
    setColW(el.clientWidth);
    return () => ro.disconnect();
  }, [status]);

  const maxW = sizes.reduce((m, s) => Math.max(m, s.w), 0) || 612;
  const roomy = colW >= PAGE_MIN + TAG_ROOM;
  const pageW = Math.max(120, Math.min(PAGE_MAX, roomy ? colW - TAG_ROOM : colW - GUTTER));
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

  // ── rendering, as pages come near ──
  const renderPage = useCallback(async (n: number) => {
    const el = pageEls.current.get(n);
    if (!el || !pdf || rendered.current.get(n) === scale || rendering.current.has(n)) return;
    rendering.current.add(n);
    try {
      const page = await pdf.getPage(n);
      const viewport = page.getViewport({ scale });
      const dpr = window.devicePixelRatio || 1;
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
  }, [pdf, scale, id]);

  const scroller = () => wrapRef.current?.closest<HTMLElement>('.book-pages, .pane-body') ?? null;

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
        if (pr.top <= top) n = Math.max(n, k);
        if (pr.top <= bottom && (!at || k > at.page)) at = { page: k, y: Math.min(1, Math.max(0, (bottom - pr.top) / pr.height)) };
      }
      setCurrent(n);
      // the pages near the view drawn here too: a covered window may hold the observer's callbacks back
      for (const [k, el] of pageEls.current) {
        const pr = el.getBoundingClientRect();
        if (pr.bottom >= r.top - AHEAD && pr.top <= r.bottom + AHEAD) void renderPage(k);
      }
      const v = viewRef.current;
      if (v && at) { v.dataset.atPage = String(at.page); v.dataset.atY = at.y.toFixed(3); }
    };
    onScroll();
    sc.addEventListener('scroll', onScroll, { passive: true });
    return () => sc.removeEventListener('scroll', onScroll);
  }, [status, sizes, base, scale, renderPage]);

  const scrollTo = (n: number) => {
    const el = pageEls.current.get(Math.max(first, Math.min(last, n)));
    el?.scrollIntoView({ block: 'start' });
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
    if (!always && top >= sr.top + 30 && top <= sr.bottom - 120) return;
    sc.scrollTo({ top: Math.max(0, sc.scrollTop + top - sr.top - 60) });
  }, []);

  // the caret's section in the notes lights its boxes, and the pages scroll to them
  useEffect(() => {
    if (caret?.path !== id) return;
    const text = drawnRef.current.some((d) => d.passage.heading.text === caret.text) ? caret.text : null;
    setLit(text);
    if (text) scrollToPassage(text);
  }, [caret?.path, caret?.text, caret?.nth, id, status, sizes.length, scrollToPassage]);
  // reading on: the pages land once at the read point, the bar's end a third of the way down the view
  const landedAt = useRef<string | null>(null);
  useEffect(() => {
    if (!readOn || status !== 'ok' || !sizes.length || landedAt.current === id) return;
    const sc = scroller();
    const rp = info?.read?.pos !== undefined ? { pos: info.read.pos, y: info.read.y ?? 1 } : null;
    if (!sc || !rp || rp.pos < first || rp.pos > last) return;
    const r = pageRect(rp.pos);
    if (!r) return;
    landedAt.current = id;
    sc.scrollTo({ top: Math.max(0, r.top + rp.y * r.height - sc.clientHeight / 3) });
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
  // a section opened from the queue with the notes hidden: nothing else lands it, so the pages do
  useEffect(() => {
    if (!notesHidden || !reveal || reveal.path !== id || reveal.heading === undefined || status !== 'ok') return;
    setLit(reveal.heading);
    scrollToPassage(reveal.heading, true);
    useApp.setState({ reveal: null });
  }, [notesHidden, reveal, id, status, scrollToPassage]);

  /** Go to a passage's section in the notes (shown, if hidden): the caret at its heading. */
  const goToSection = (p: Passage) => {
    setLit(p.heading.text);
    useApp.setState({ notesHidden: false, reveal: { path: id, index: p.index, heading: p.heading.text } });
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
      if (find?.q) for (const f of findAll(strs, find.q, true)) hits.push(rangeOf(nodes, f));
    }
    setHighlight(id, 'ilmi-extract', own);
    setHighlight(id, 'ilmi-hit', hits);
  }, [tick, extracts, find?.q, id]);
  useEffect(() => () => { setHighlight(id, 'ilmi-extract', []); setHighlight(id, 'ilmi-hit', []); }, [id]);

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
            next = { text, page: Number(pageEl.dataset.page), rect: range.getBoundingClientRect(), line: range.startContainer.parentElement?.textContent ?? '', boxes };
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

  /** `e`: the boxes become a section of the notes, in book order; the read point moves past them. `write`: the caret goes in it. */
  const makeSection = async (write: boolean, known?: { name: string }) => {
    const boxes = boxesNow();
    if (!boxes.length) return;
    clearBoxes();
    const { name } = known ?? await nameOf(boxes);
    let made: { index: number; text: string } | null = null;
    await writeDoc(id, (d) => {
      made = addPassage(d, name, boxes, appNow());
      const r = meta(d).read;
      const end = boxesEnd(boxes);
      if (r && end && meta(d).type !== 'note') {
        const { pos: _p, y: _y, ...rest } = r;
        setField(d, 'read', { ...rest, ...pointOn(r, end.page, end.y) });
      }
    });
    const m = made as { index: number; text: string } | null;
    if (!m) return;
    const text = m.text;
    setLit(text);
    setRecent(write ? null : m);
    notify(`§ ${plainMath(text)} · back in 3d, until dismissed${write ? '' : ' · ⏎ to write in it'}`, null, async () => {
      await writeDoc(id, (d) => {
        const at = d.blocks.findIndex((b) => b.kind === 'heading' && b.text === text && b.read?.boxes !== undefined);
        if (at >= 0) d.blocks.splice(at, 1);
      });
    });
    if (write) useApp.setState({ notesHidden: false, reveal: { path: id, index: m.index, heading: text, write: true } });
  };

  /** `m`: on a page that names its sections, the section with the caret in it; otherwise each box clipped under its page, the caret below. */
  const cardOrClip = async () => {
    const boxes = boxesNow();
    if (!boxes.length) return;
    const named = await nameOf(boxes);
    if (named.named) { await makeSection(true, named); return; }
    clearBoxes();
    let at = -1;
    await writeDoc(id, (d) => {
      for (const b of boxes) at = addToPage(d, b.page, { kind: 'raw', text: formatClip(b) });
    });
    if (at < 0) return;
    notify(`clipped · ${boxes.length === 1 ? `p. ${boxes[0]!.page}` : `${boxes.length} boxes`} · the card goes below it: word ::: meaning`);
    useApp.setState({ notesHidden: false, reveal: { path: id, index: at, write: true } });
  };

  const startReading = () => { if (canEnrol && !info?.read) enrolReading(id).catch(console.error); };

  // ── drawing a box: drag on a page; a double click or ⌥-drag selects text instead ──
  const onMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.button !== 0 || e.altKey || e.detail > 1 || e.metaKey || e.ctrlKey) return;
    const t = e.target as HTMLElement;
    if (t.closest('[data-hit]')) return;
    const pageEl = t.closest<HTMLElement>('.pdf-page');
    const col = pagesRef.current;
    if (!pageEl || !col) return;
    e.preventDefault();
    // the keys that follow (`e`, `m`) are the pages', not the notes' to type
    (document.activeElement as HTMLElement | null)?.blur?.();
    window.getSelection()?.removeAllRanges();
    setRecent(null);
    const page = Number(pageEl.dataset.page);
    const x0 = e.clientX;
    const y0 = e.clientY;
    const move = (ev: MouseEvent) => {
      const c = col.getBoundingClientRect();
      setGhost({ left: Math.min(x0, ev.clientX) - c.left, top: Math.min(y0, ev.clientY) - c.top, width: Math.abs(ev.clientX - x0), height: Math.abs(ev.clientY - y0) });
    };
    const up = (ev: MouseEvent) => {
      window.removeEventListener('mousemove', move);
      window.removeEventListener('mouseup', up);
      setGhost(null);
      if (Math.abs(ev.clientX - x0) < 8 || Math.abs(ev.clientY - y0) < 6) return;
      const pr = pageEl.getBoundingClientRect();
      const clamp = (n: number) => Math.min(1, Math.max(0, n));
      const x = clamp((Math.min(x0, ev.clientX) - pr.left) / pr.width);
      const y = clamp((Math.min(y0, ev.clientY) - pr.top) / pr.height);
      const r = clamp((Math.max(x0, ev.clientX) - pr.left) / pr.width);
      const b = clamp((Math.max(y0, ev.clientY) - pr.top) / pr.height);
      if (r - x <= 0.005 || b - y <= 0.003) return;
      setPending((p) => [...p, { page, x, y, w: r - x, h: b - y }]);
    };
    window.addEventListener('mousemove', move);
    window.addEventListener('mouseup', up);
  };

  // ── search and go to page ──
  const runFind = async (q: string, step = 0) => {
    const cur = st.current.find;
    if (cur && cur.q === q && cur.pages.length) {
      const at = (cur.at + step + cur.pages.length) % cur.pages.length;
      setFind({ ...cur, at });
      scrollTo(cur.pages[at]!.page);
      return;
    }
    if (!pdf || !q.trim()) { setFind(q ? { q, pages: [], at: 0 } : null); return; }
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
    let at = pages.findIndex((p) => p.page >= current);
    if (at < 0) at = 0;
    setFind({ q, pages, at });
    const hit = pages[at];
    if (hit) scrollTo(hit.page);
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
  const doJump = async () => {
    const s = st.current.sel;
    if (!s || !pdf) return;
    const ref = refOf(s.text);
    if (!ref) return;
    const all: string[][] = [];
    for (let n = 1; n <= pdf.numPages; n++) all.push((await pageLines(n)).map((l) => l.text));
    const hit = jumpTarget(all, ref, s.page);
    if (!hit) { setPeek(null); return; }
    const line = (await pageLines(hit.page))[hit.line];
    if (!line) return;
    setPeek({ page: hit.page, y: line.y, height: line.height, text: line.text, rect: s.rect });
  };
  useEffect(() => {
    const canvas = peekCanvas.current;
    if (!peek || !pdf || !canvas) return;
    let live = true;
    (async () => {
      const page = await pdf.getPage(peek.page);
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
  }, [peek, pdf, scale]);

  useEffect(() => { if (find) findRef.current?.focus(); }, [find !== null]);
  useEffect(() => { if (goto) gotoRef.current?.focus(); }, [goto]);

  // ── keys: in the capture phase, so the boxes' keys come before the session's and the notes' ──
  const keyRef = useRef<(e: KeyboardEvent) => void>(() => {});
  keyRef.current = (e: KeyboardEvent) => {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    const s = st.current;
    const have = s.pending.length > 0 || (s.sel?.boxes.length ?? 0) > 0;
    const take = () => { e.preventDefault(); e.stopPropagation(); };
    if (e.key === 'Escape') {
      if (s.pending.length || s.find || s.goto || s.peek || s.recent) {
        setPending([]); setFind(null); setGoto(false); setPeek(null); setRecent(null);
        take();
      }
      return;
    }
    if (inField(e.target)) return;
    if (have && e.key === 'e') { take(); void makeSection(false).catch(console.error); return; }
    if (have && e.key === 'm') { take(); void cardOrClip().catch(console.error); return; }
    // a reference under the selection: its target in a peek
    if (s.sel && e.key === 'Enter' && refOf(s.sel.text)) { take(); void doJump(); return; }
    if (s.recent && e.key === 'Enter' && !have) {
      take();
      const r = s.recent;
      setRecent(null);
      useApp.setState({ notesHidden: false, reveal: { path: id, index: r.index, heading: r.text, write: true } });
      return;
    }
    if (s.recent && e.key !== 'Shift') setRecent(null);
    if (!active) return;
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
      if (next) goToSection(next);
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

  if (status === 'gone' || (status === 'ok' && !info)) {
    return <div className="reader-wrap"><div className="reader"><div className="empty">no longer in the collection</div></div></div>;
  }

  // the top row as the reader's: one short token, what is due, else the cards; the rest in its tooltip
  const cards = info?.cards ?? 0;
  const due = info?.due ?? 0;
  const counts = cards ? `${plural(cards, 'card')}${due ? `, ${due} due` : ''}` : '';
  const span = !sizes.length ? '' : !base && !range ? plural(sizes.length, 'page') : first === last ? `p. ${first}` : `pp. ${first}–${last}`;
  const readTo = info?.read?.pos ? `read to p. ${info.read.pos}` : '';
  const rightTip = [status === 'ok' ? span : '', textless ? 'no text' : '', counts].filter(Boolean).join(', ');
  const shown = readTo || (due ? `${due} due` : cards ? plural(cards, 'card') : '') || (textless && status === 'ok' ? 'no text' : '');
  const shownPending = [...pending, ...(sel?.boxes ?? [])];
  const lastPending = pending.length ? boxRect(pending[pending.length - 1]!) : null;

  return (
    <div className="reader-wrap">
      <div ref={viewRef} className={`reader doc-view pdf-view${reading ? ' reading' : ''}`} data-page={current} data-roomy={roomy ? '1' : '0'}>
        <div className="meta">
          <Crumbs path={id} />
          <TabsToggle path={id} />
          <StudyButton path={id} />
          <ExamTag path={id} />
          {info && canEnrol && !info.read && (
            <button type="button" className="frozen-tag enrol" onClick={startReading}>start reading <span className="kbd">r</span></button>
          )}
          {shown && <span className="right" title={rightTip}>{shown}</span>}
        </div>
        <h1>{titleOf(id, docs, root)}</h1>
        {(find || goto) && (
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
                  onChange={(e) => setFind((f) => (f ? { ...f, q: e.target.value, pages: [], at: 0 } : f))}
                  onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); void runFind(find.q, find.pages.length ? (e.shiftKey ? -1 : 1) : 0); } }}
                />
                <span className="pb-n">{find.pages.length ? `p. ${find.pages[find.at]?.page}, ${find.at + 1} / ${find.pages.length}` : find.q ? 'none' : ''}</span>
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
                    if (n >= 1) scrollTo(n);
                    setGoto(false);
                  }}
                  onBlur={() => setGoto(false)}
                />
              </>
            )}
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
          <div className="pdf-pages" ref={pagesRef} style={{ height: tops.total || undefined, width: pageW }} onMouseDown={onMouseDown}>
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
            <div className="pdf-marks">
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
                  <button type="button" data-k="e" onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); void makeSection(false).catch(console.error); }}><kbd>e</kbd>section{pending.length > 1 ? ` · ${pending.length} boxes` : ''}</button>
                  <button type="button" data-k="m" onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); void cardOrClip().catch(console.error); }}><kbd>m</kbd>card</button>
                  <button type="button" data-k="esc" onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); clearBoxes(); }}><kbd>esc</kbd></button>
                </div>
              )}
            </div>
          </div>
          {sel && (
            <div className="sel-cue" style={{ top: sel.rect.bottom + 8, left: sel.rect.left }}>
              <button type="button" className="cue-act" onMouseDown={(e) => { e.preventDefault(); void makeSection(false).catch(console.error); }}>
                section <span className="kbd">e</span>
              </button>
              <button type="button" className="cue-act" onMouseDown={(e) => { e.preventDefault(); void cardOrClip().catch(console.error); }}>
                card <span className="kbd">m</span>
              </button>
              {plugSel && <CueActions sel={plugSel} onRun={() => setSel(null)} />}
            </div>
          )}
          {peek && (
            <div
              className="pdf-peek"
              style={{ top: Math.max(60, Math.min(peek.rect.bottom + 8, window.innerHeight - 220)), left: Math.max(8, Math.min(peek.rect.left, window.innerWidth - PEEK_W - 40)) }}
              onClick={() => { scrollTo(peek.page); setPeek(null); }}
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
