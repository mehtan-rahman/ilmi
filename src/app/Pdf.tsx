// The PDF lens: a source whose pages exist opens as pages, rendered by pdf.js
// with its text layer on, so a selection on a page is a DOM selection and
// `e` and `m` work as they do in the reader. The Markdown beside the PDF is
// the document; its cards and extracts sit in a rail to the right at their
// page, a `text` toggle reads the Markdown instead, and the left-margin ruler
// marks the page the way the marker marks a block. Highlights are the
// extracts' stored text found again on the page. Nothing is written into the
// PDF, ever; every change goes to the Markdown through the vault.

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { PRI_DEFAULT, meta, setField, type Card, type Doc } from '../format/index.js';
import { countIn, findAll, findText, jumpTarget, linesOf, refOf, type Found } from '../pdf/index.js';
import { pickPos, type Band } from '../reader/index.js';
import { addToPage, childDirOf, pageOfBlock } from '../vault/index.js';
import { cardLabel, revealIndex } from './chrome.js';
import { CueActions } from '../plugins/CueActions.js';
import { onPluginAction, publishSelection, toPluginSelection, type PluginSelection } from '../plugins/index.js';
import { Composer } from './Composer.js';
import { EL_GLYPH } from './items.js';
import { GLYPH, titleOf } from './names.js';
import { TextLayer, loadPdf, pageBits, type PDFDocumentProxy } from './pdfjs.js';
import { Reader, crumbOf } from './Reader.js';
import { useApp, type DocInfo } from './store.js';
import { useDoc } from './useDoc.js';
import { currentVault, enrolReading, extractNode, openNode } from './vault.js';
import './pdf.css';

/** Space between pages, px. */
const GAP = 18;
/** How far outside the view a page starts rendering, px. */
const AHEAD = 900;
/** Pages the lens looks at to decide whether the PDF has a text layer. */
const PROBE = 3;

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;

const inField = (t: EventTarget | null) => {
  const el = t as HTMLElement | null;
  const tag = el?.tagName?.toLowerCase();
  return tag === 'input' || tag === 'textarea' || !!el?.isContentEditable;
};

/** The selection on a page: its text, the page, where it sits on screen, and the text-layer line it starts in. */
interface Sel {
  text: string;
  page: number;
  rect: DOMRect;
  line: string;
}

interface Compose {
  seed: string;
  page: number;
  rect: DOMRect;
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

// ── the lens ─────────────────────────────────────────────────────

interface PdfProps {
  id: string;
  /** In the active pane: keys that need no selection reach this lens. */
  active?: boolean;
  /** Inside a reading session: `[` `]` belong to the session. */
  session?: boolean;
}

export function Pdf({ id, active = true, session = false }: PdfProps) {
  const [mode, setMode] = useState<'pages' | 'text'>('pages');
  if (mode === 'text') return <Reader id={id} active={active} onPages={() => setMode('pages')} />;
  return <Pages id={id} active={active} session={session} onText={() => setMode('text')} />;
}

interface PagesProps extends Required<PdfProps> {
  onText(): void;
}

/** An extract carved from a page, for the rail and the highlights. */
interface PageExtract {
  path: string;
  page: number;
  text: string;
}

function Pages({ id, active, session, onText }: PagesProps) {
  const docs = useApp((s) => s.docs);
  const root = useApp((s) => s.vault);
  const reveal = useApp((s) => s.reveal);
  const selected = useApp((s) => s.selectedCard);
  const info: DocInfo | undefined = docs[id];
  const loaded = useDoc(id);
  const [status, setStatus] = useState<'loading' | 'ok' | 'gone'>('loading');
  const [pdf, setPdf] = useState<PDFDocumentProxy | null>(null);
  const [sizes, setSizes] = useState<Size[]>([]);
  const [textless, setTextless] = useState(false);
  const [width, setWidth] = useState(0);
  const [tick, setTick] = useState(0);
  const [sel, setSel] = useState<Sel | null>(null);
  const [composer, setComposer] = useState<Compose | null>(null);
  const [current, setCurrent] = useState(1);
  const [pos, setPos] = useState<number | null>(null);
  const [find, setFind] = useState<Find | null>(null);
  const [goto, setGoto] = useState(false);
  const [extracts, setExtracts] = useState<PageExtract[]>([]);
  const [peek, setPeek] = useState<Peek | null>(null);
  const peekCanvas = useRef<HTMLCanvasElement>(null);
  const lines = useRef(new Map<number, ReturnType<typeof linesOf>>());
  const wrapRef = useRef<HTMLDivElement>(null);
  const pagesRef = useRef<HTMLDivElement>(null);
  const findRef = useRef<HTMLInputElement>(null);
  const gotoRef = useRef<HTMLInputElement>(null);
  const pageEls = useRef(new Map<number, HTMLDivElement>());
  const rendered = useRef(new Map<number, number>());
  const rendering = useRef(new Set<number>());
  const texts = useRef(new Map<number, string>());
  const dragRef = useRef(false);
  const selRef = useRef<Sel | null>(null);
  selRef.current = sel;
  const composerRef = useRef<Compose | null>(null);
  composerRef.current = composer;
  const findRefState = useRef<Find | null>(null);
  findRefState.current = find;
  const canExtract = info?.type === 'source' || info?.type === 'extract';
  const reading = !!info?.read;
  const readPos = info?.read?.pos ?? 0;

  // ── the file, through the vault's fs ──
  useEffect(() => {
    const vault = currentVault();
    const rel = info?.pdf;
    if (!vault || !rel) return;
    let live = true;
    let task: ReturnType<typeof loadPdf> | null = null;
    rendered.current.clear();
    texts.current.clear();
    lines.current.clear();
    (async () => {
      const bytes = await vault.fs.readBytes(vault.abs(rel));
      if (!live) return;
      task = loadPdf(bytes);
      const doc = await task.promise;
      if (!live) return;
      const out: Size[] = [];
      let hasText = false;
      for (let n = 1; n <= doc.numPages; n++) {
        const page = await doc.getPage(n);
        const v = page.getViewport({ scale: 1 });
        out.push({ w: v.width, h: v.height });
        if (n <= PROBE && !hasText) hasText = (await pageBits(page)).some((b) => b.str.trim() !== '');
      }
      if (!live) return;
      setPdf(doc);
      setSizes(out);
      setTextless(!hasText);
      setStatus('ok');
    })().catch((e: unknown) => { console.error(id, e); if (live) setStatus('gone'); });
    return () => {
      live = false;
      void task?.destroy();
      setPdf(null);
      setSizes([]);
      setStatus('loading');
    };
  }, [id, info?.pdf]);

  // the pages column's width sets the scale: a page fits it
  useLayoutEffect(() => {
    const el = pagesRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setWidth(el.clientWidth));
    ro.observe(el);
    setWidth(el.clientWidth);
    return () => ro.disconnect();
  }, [status]);

  const maxW = sizes.reduce((m, s) => Math.max(m, s.w), 0) || 612;
  const scale = width > 0 ? width / maxW : 1;
  /** Each page's top, px from the top of the column, and the column's height. */
  const tops = useMemo(() => {
    const out: number[] = [0];
    let y = 0;
    sizes.forEach((s, i) => { out[i + 1] = y; y += s.h * scale + (i < sizes.length - 1 ? GAP : 0); });
    return { at: out, total: y };
  }, [sizes, scale]);

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
      await page.render(dpr === 1 ? { canvas, viewport } : { canvas, viewport, transform: [dpr, 0, 0, dpr, 0, 0] }).promise;
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

  useEffect(() => {
    if (!pdf || !sizes.length) return;
    // a new scale: every page draws again as it comes near
    for (const [n, s] of rendered.current) if (s !== scale) { rendered.current.delete(n); pageEls.current.get(n)?.replaceChildren(); }
    const scroller = wrapRef.current?.closest('.pane-body') ?? null;
    const io = new IntersectionObserver((entries) => {
      for (const e of entries) if (e.isIntersecting) void renderPage(Number((e.target as HTMLElement).dataset.page));
    }, { root: scroller, rootMargin: `${AHEAD}px 0px` });
    for (const el of pageEls.current.values()) io.observe(el);
    return () => io.disconnect();
  }, [pdf, sizes, scale, renderPage]);

  // the page in view: for `read on`, and for the keys that step pages
  useEffect(() => {
    const scroller = wrapRef.current?.closest('.pane-body');
    const pages = pagesRef.current;
    if (!scroller || !pages) return;
    const onScroll = () => {
      const top = scroller.getBoundingClientRect().top + 70;
      let n = 1;
      for (const [k, el] of pageEls.current) if (el.getBoundingClientRect().top <= top) n = Math.max(n, k);
      setCurrent(n);
    };
    onScroll();
    scroller.addEventListener('scroll', onScroll, { passive: true });
    return () => scroller.removeEventListener('scroll', onScroll);
  }, [status, sizes]);

  const scrollTo = (n: number) => {
    const el = pageEls.current.get(Math.max(1, Math.min(sizes.length, n)));
    el?.scrollIntoView({ block: 'start' });
  };

  // ── what the Markdown says about the pages: cards by section, extracts by their line ──
  const cardsByPage = useMemo(() => {
    const out = new Map<number, { card: Card; index: number }[]>();
    const doc: Doc | undefined = loaded?.doc;
    doc?.blocks.forEach((b, i) => {
      if (b.kind !== 'card') return;
      const p = pageOfBlock(doc, i);
      if (p === null) return;
      out.set(p, [...(out.get(p) ?? []), { card: b, index: i }]);
    });
    return out;
  }, [loaded]);

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

  const extractsByPage = useMemo(() => {
    const out = new Map<number, PageExtract[]>();
    for (const e of extracts) out.set(e.page, [...(out.get(e.page) ?? []), e]);
    return out;
  }, [extracts]);

  // ── highlights: the extracts' text found again, and the search's hits ──
  useEffect(() => {
    const own: Range[] = [];
    const hits: Range[] = [];
    for (const [n] of rendered.current) {
      const layer = pageEls.current.get(n)?.querySelector('.textLayer');
      if (!layer) continue;
      const nodes = textNodes(layer);
      const strs = nodes.map((t) => t.data);
      for (const e of extractsByPage.get(n) ?? []) {
        const f = findText(strs, e.text);
        if (f) own.push(rangeOf(nodes, f));
      }
      if (find?.q) for (const f of findAll(strs, find.q, true)) hits.push(rangeOf(nodes, f));
    }
    setHighlight(id, 'ilmi-extract', own);
    setHighlight(id, 'ilmi-hit', hits);
  }, [tick, extractsByPage, find?.q, id]);
  useEffect(() => () => { setHighlight(id, 'ilmi-extract', []); setHighlight(id, 'ilmi-hit', []); }, [id]);

  // ── the selection, read from the DOM ──
  useEffect(() => {
    const capture = () => {
      if (composerRef.current) return;
      let next: Sel | null = null;
      const s = window.getSelection();
      const pages = pagesRef.current;
      if (s && pages && s.rangeCount > 0 && !s.isCollapsed) {
        const range = s.getRangeAt(0);
        const start = range.startContainer instanceof Element ? range.startContainer : range.startContainer.parentElement;
        const pageEl = start?.closest<HTMLElement>('.pdf-page');
        if (pageEl && pages.contains(pageEl)) {
          const text = s.toString().replace(/\s+/g, ' ').trim();
          if (text) next = { text, page: Number(pageEl.dataset.page), rect: range.getBoundingClientRect(), line: range.startContainer.parentElement?.textContent ?? '' };
        }
      }
      setSel((cur) => (cur === next || (cur && next && cur.text === next.text && cur.page === next.page && cur.rect.top === next.rect.top) ? cur : next));
    };
    document.addEventListener('selectionchange', capture);
    return () => document.removeEventListener('selectionchange', capture);
  }, []);

  // the selection as plugins see it: the text-layer line gives the context
  const plugSel = useMemo((): PluginSelection | null => (sel && !composer ? toPluginSelection({ path: id, text: sel.text, rect: sel.rect, block: null, blockText: sel.line, page: sel.page }) : null), [sel, composer, id]);
  useEffect(() => {
    publishSelection(plugSel);
    return () => publishSelection(null);
  }, [plugSel]);
  useEffect(() => onPluginAction(() => setSel(null)), []);

  const doExtract = () => {
    const s = selRef.current;
    if (!s || !canExtract) return;
    setSel(null);
    window.getSelection()?.removeAllRanges();
    extractNode(id, { text: s.text, blocks: [], page: s.page }).catch(console.error);
  };

  const openComposer = () => {
    const s = selRef.current;
    if (!s) return;
    setComposer({ seed: s.text, page: s.page, rect: s.rect });
    setSel(null);
  };

  const saveCard = (text: string, again: boolean, pri?: number) => {
    const c = composerRef.current;
    if (!c) return;
    const card: Card = { kind: 'card', text };
    if (pri !== undefined) card.sched = { pri };
    currentVault()?.update(id, (d) => { addToPage(d, c.page, card); }).catch(console.error);
    if (!again) setComposer(null);
  };

  const startReading = () => { if (canExtract && !reading) enrolReading(id).catch(console.error); };

  // ── search and go to page ──
  const runFind = async (q: string, step = 0) => {
    const cur = findRefState.current;
    if (cur && cur.q === q && cur.pages.length) {
      const at = (cur.at + step + cur.pages.length) % cur.pages.length;
      setFind({ ...cur, at });
      scrollTo(cur.pages[at]!.page);
      return;
    }
    if (!pdf || !q.trim()) { setFind(q ? { q, pages: [], at: 0 } : null); return; }
    const pages: Find['pages'] = [];
    for (let n = 1; n <= pdf.numPages; n++) {
      let text = texts.current.get(n);
      if (text === undefined) {
        text = (await pageBits(await pdf.getPage(n))).map((b) => b.str).join(' ');
        texts.current.set(n, text);
      }
      const k = countIn(text, q);
      if (k) pages.push({ page: n, n: k });
    }
    // start from the page in view
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
    const s = selRef.current;
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
      await page.render({ canvas: full, viewport: vp, transform: [dpr, 0, 0, dpr, 0, 0] }).promise;
      if (!live) return;
      // the line's top in css px, with a little of the page above it
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

  // ── keys ──
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === 'Escape') {
        if (composerRef.current || findRefState.current || goto || peek) {
          setComposer(null); setFind(null); setGoto(false); setPeek(null);
          e.preventDefault();
        }
        return;
      }
      if (inField(e.target) || composerRef.current) return;
      if (selRef.current) {
        if (e.key === 'e' && canExtract) { e.preventDefault(); doExtract(); return; }
        if (e.key === 'm') { e.preventDefault(); openComposer(); return; }
        // a reference under the selection: its target in a peek; in a session, ⏎ on anything else is still read on
        if (e.key === 'Enter' && refOf(selRef.current.text)) { e.preventDefault(); void doJump(); return; }
      }
      if (!active) return;
      if (e.key === 'r' && canExtract && !reading) { e.preventDefault(); startReading(); }
      else if (e.key === '/') { e.preventDefault(); setFind((f) => f ?? { q: '', pages: [], at: 0 }); findRef.current?.focus(); }
      else if (e.key === 'g') { e.preventDefault(); setGoto(true); }
      else if (!session && (e.key === ']' || e.key === '[')) { e.preventDefault(); scrollTo(current + (e.key === ']' ? 1 : -1)); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  // ── the ruler: the page read up to, as the marker is a block read up to ──
  const shownPos = pos ?? readPos;
  const setFromY = (clientY: number) => {
    const bands: Band[] = [];
    for (let n = 1; n <= sizes.length; n++) {
      const r = pageEls.current.get(n)?.getBoundingClientRect();
      if (r) bands.push({ top: r.top, height: r.height });
    }
    setPos(pickPos(bands, clientY));
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
    const page = pos;
    setPos(null);
    if (page === null) return;
    currentVault()?.update(id, (d) => {
      const r = meta(d).read;
      if (r) setField(d, 'read', { ...r, pos: page });
    }).catch(console.error);
  };

  // a card opened from the palette or a query: its page scrolls into view and the rail row is selected
  useEffect(() => {
    if (!reveal || reveal.path !== id || !loaded || status !== 'ok') return;
    const i = revealIndex(loaded.doc.blocks, reveal);
    if (i >= 0) {
      useApp.setState({ selectedCard: { path: id, index: i } });
      const p = pageOfBlock(loaded.doc, i);
      if (p !== null) scrollTo(p);
    }
    useApp.setState({ reveal: null });
  }, [reveal, loaded, status, id]);
  useEffect(() => () => { if (useApp.getState().selectedCard?.path === id) useApp.setState({ selectedCard: null }); }, [id]);

  if (status === 'gone' || (status === 'ok' && !info)) {
    return <div className="reader-wrap"><div className="reader"><div className="empty">no longer in the collection</div></div></div>;
  }

  const cards = info?.cards ?? 0;
  const due = info?.due ?? 0;
  const right = [
    status === 'ok' ? (textless ? `${plural(sizes.length, 'page')}, no text` : plural(sizes.length, 'page')) : '',
    cards ? `${plural(cards, 'card')}${due ? `, ${due} due` : ''}` : '',
  ].filter(Boolean).join(', ');
  const ruleHeight = shownPos >= 1 && sizes.length ? (tops.at[Math.min(shownPos, sizes.length)] ?? 0) + (sizes[Math.min(shownPos, sizes.length) - 1]?.h ?? 0) * scale : 0;
  const pagesWithRail = new Set([...cardsByPage.keys(), ...extractsByPage.keys()].filter((p) => p >= 1 && p <= sizes.length));

  return (
    <div className="reader-wrap">
      <div className={`reader doc-view pdf-view${reading ? ' reading' : ''}`} data-page={current}>
        <div className="meta">
          <span className="crumb">{crumbOf(id, docs)}</span>
          <button type="button" className="frozen-tag" onClick={onText}>text</button>
          {info && canExtract && !reading && (
            <button type="button" className="frozen-tag enrol" onClick={startReading}>start reading <span className="kbd">r</span></button>
          )}
          <span className="right">{right}</span>
        </div>
        <h1>{titleOf(id, docs, root)}</h1>
        {(find || goto) && (
          <div className="pdf-bar">
            {find && (
              <>
                <span className="pb-k">/</span>
                <input
                  ref={findRef}
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
                  min={1}
                  max={sizes.length || 1}
                  placeholder={`1–${sizes.length}`}
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
              <div className="read-rule" style={{ top: 0, height: ruleHeight }} />
              <div className="read-edge" style={{ top: ruleHeight }}><span className="read-knob" /></div>
            </>
          )}
          <div className="pdf-pages" ref={pagesRef} style={{ height: tops.total || undefined }}>
            {status === 'loading' && <div className="empty">opening</div>}
            {sizes.map((s, i) => (
              <div
                key={i + 1}
                className="pdf-page"
                data-page={i + 1}
                ref={(el) => { if (el) pageEls.current.set(i + 1, el); else pageEls.current.delete(i + 1); }}
                style={{ width: s.w * scale, height: s.h * scale, top: tops.at[i + 1] }}
              />
            ))}
          </div>
          <div className="pdf-rail">
            {[...pagesWithRail].sort((a, b) => a - b).map((p) => (
              <div key={p} className="rail-page" style={{ top: tops.at[p] }}>
                <h6>p. {p}</h6>
                {(extractsByPage.get(p) ?? []).map((e) => (
                  <div key={e.path} className="rail-item" data-t="extract" onClick={(ev) => openNode(e.path, { cmdClick: ev.metaKey || ev.ctrlKey, shiftClick: ev.shiftKey })}>
                    <span className="g" data-el="read">{GLYPH.extract}</span>
                    <span className="t">{titleOf(e.path, docs, null)}</span>
                  </div>
                ))}
                {(cardsByPage.get(p) ?? []).map(({ card, index }) => (
                  <div
                    key={card.id ?? index}
                    className={`rail-item${selected?.path === id && selected.index === index ? ' selected' : ''}`}
                    data-t="card"
                    onClick={() => useApp.setState({ selectedCard: { path: id, index } })}
                  >
                    <span className="g" data-el="card">{EL_GLYPH.card}</span>
                    <span className="t">{cardLabel(card.text)}</span>
                  </div>
                ))}
              </div>
            ))}
          </div>
          {sel && !composer && (
            <div className="sel-cue" style={{ top: sel.rect.bottom + 8, left: sel.rect.left }}>
              {canExtract && (
                <button type="button" className="cue-act" onMouseDown={(e) => { e.preventDefault(); doExtract(); }}>
                  extract <span className="kbd">e</span>
                </button>
              )}
              <button type="button" className="cue-act" onMouseDown={(e) => { e.preventDefault(); openComposer(); }}>
                make a card <span className="kbd">m</span>
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
          {composer && (
            <div className="card-pop" style={{ top: Math.min(composer.rect.bottom + 8, window.innerHeight - 280), left: Math.min(composer.rect.left, window.innerWidth - 440) }}>
              <Composer seed={composer.seed} pri={info?.pri ?? PRI_DEFAULT} onSave={saveCard} onClose={() => setComposer(null)} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
