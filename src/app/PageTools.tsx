// What stands over pages that are written on, besides the row of tools
// (milestone 85): the lasso's menu, the pages' overview, and the pages passed
// on as a PDF. Each is a part of the pages' own lens (`Pdf.tsx` mounts them),
// drawn by the page and marked `data-ink-over`, so the canvases know the
// Pencil does not write through them (`ink.ts`).
//
// The lasso's menu lies in the scroller's own content, beside what the lasso
// holds (the canvases say where: `useLasso`), so it scrolls with the page as
// the selection's outline does. `cut`, `copy`, `duplicate`, `delete` and a
// colour act at once on what is held; where the Pencil rests under the lasso
// with something cut or copied, `paste` puts it down there.
//
// The overview is every page small, with what is written on it: a press goes
// to a page; a notebook's can be added after any page, made again, deleted,
// and moved by dragging (held first under a finger), and its paper chosen
// from four small sheets.

import { useEffect, useLayoutEffect, useMemo, useRef, useState, type JSX } from 'react';
import { createPortal } from 'react-dom';
import { invoke } from '@tauri-apps/api/core';
import { save as pickSave } from '@tauri-apps/plugin-dialog';
import type { PaperKind, WrittenMeta } from '../format/index.js';
import { pageKey, type StoreFs } from '../vault/index.js';
import { lassoDo, lassoPaste, sceneSoon, useLasso } from './ink.js';
import { CUSTOM, useInkTools } from './inkTools.js';
import { Icon } from './icons.js';
import { failed, notify } from './land.js';
import { hapticTick } from './haptics.js';
import { LINE_COLORS, MARGIN_AT, MM, PAPER_COLORS, RULE_TOP, paperHex, paperLook, paperOf, paperPaths, ruleOf, sheetSize, type PaperSpec, ruleWidth } from './paper.js';
import { popMenu, type PopItem } from './popMenu.js';
import type { PDFDocumentProxy } from './pdfjs.js';
import { useApp } from './store.js';
import { currentVault } from './vault.js';
import { PAPERS, addSheet, addSheetAfter, duplicateSheet, keepSetup, moveSheet, setPaper, setSetup, setupOf, type Setup } from './written.js';

/** A sheet's paper, small or large: the sheet in points, whatever size it is drawn at. */
export function PaperSheet({ kind, spec, px }: { kind?: PaperKind; /** The paper with its page setup; a kind alone is a Letter sheet as a new notebook has it. */ spec?: PaperSpec; /** The pixels of the screen it is drawn with to the point, where its rules are to lie on them (a page; 86). */ px?: number }) {
  const of = spec ?? kind ?? 'blank';
  const key = typeof of === 'string' ? of : `${of.kind} ${of.w} ${of.h} ${of.rule} ${of.margin} ${of.top} ${of.run} ${of.at}`;
  const wide = px && px > 0 ? ruleWidth(px) : 0;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const p = useMemo(() => paperPaths(of, wide ? { px: px!, w: wide } : undefined), [key, px]);
  // a rule a whole number of the screen's pixels wide, on whole pixels: drawn as it is, nothing to round
  const line = wide ? { strokeWidth: wide / (typeof window === 'undefined' ? 1 : window.devicePixelRatio || 1), shapeRendering: 'auto' as const } : undefined;
  // its colours as they are in the theme, final: nothing turns them afterwards (87)
  const theme = useApp((s) => s.theme);
  const look = paperLook(typeof of === 'string' ? null : of, theme);
  return (
    <svg className="paper" data-paper={typeof of === 'string' ? of : of.kind} data-rule={typeof of === 'string' ? undefined : of.rule} data-ink-dark={look.dark ? '1' : undefined} viewBox={`0 0 ${p.w} ${p.h}`} preserveAspectRatio="none" aria-hidden="true">
      <rect className="paper-sheet" width={p.w} height={p.h} fill={look.paper} />
      {p.rules && <path className="paper-rule" d={p.rules} stroke={look.rule} vectorEffect="non-scaling-stroke" style={line} />}
      {p.margin && <path className="paper-rule paper-margin" d={p.margin} stroke={look.margin} vectorEffect="non-scaling-stroke" style={line} />}
      {p.dots && <path className="paper-dot" d={p.dots} stroke={look.dot} strokeWidth={p.width} strokeDasharray={`0 ${p.pitch}`} />}
    </svg>
  );
}

// ── the lasso's menu ──

const OPS = ['cut', 'copy', 'duplicate', 'delete'] as const;

/** Beside what the lasso holds on the pages of `host`, in `scroller`'s content: what can be done with it; and `paste` where the Pencil rested. */
export function InkMenu({ host, scroller }: { host: string; scroller: HTMLElement | null }): JSX.Element | null {
  const picked = useLasso((s) => (s.picked?.host === host ? s.picked : null));
  const rest = useLasso((s) => (s.rest?.host === host ? s.rest : null));
  const kept = useInkTools((s) => s.kept);
  const [colours, setColours] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => { if (!picked) setColours(false); }, [picked]);
  // the canvases are told where it lies
  useEffect(() => { sceneSoon(); return () => sceneSoon(); }, [picked, rest, colours]);
  // a press anywhere else lets go of a place to paste
  useEffect(() => {
    if (!rest) return;
    const out = (e: Event) => { if (!ref.current?.contains(e.target as Node)) useLasso.setState({ rest: null }); };
    document.addEventListener('pointerdown', out, true);
    return () => document.removeEventListener('pointerdown', out, true);
  }, [rest]);
  if (!scroller || (!picked && !rest)) return null;
  // above what is held, or under it when that is at the top of the view
  const top = scroller.scrollTop + 120;
  const style = picked
    ? { left: picked.box.x + picked.box.w / 2, top: picked.box.y - 14 < top ? picked.box.y + picked.box.h + 14 : picked.box.y - 14 }
    : { left: rest!.x, top: rest!.y - 14 < top ? rest!.y + 30 : rest!.y - 14 };
  const below = picked ? picked.box.y - 14 < top : rest!.y - 14 < top;
  const pens = [...kept.colors.pen, ...(kept.custom.pen ? [kept.custom.pen] : [])];
  return createPortal(
    <div ref={ref} className="ink-menu" role="menu" aria-label={picked ? 'selection' : 'paste'} data-ink-over="" data-place={below ? 'below' : 'above'} data-count={picked?.count} style={style} onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); }} onPointerDown={(e) => e.stopPropagation()}>
      {picked && !colours && OPS.map((op) => (
        <button key={op} type="button" role="menuitem" className={op === 'delete' ? 'im-b danger' : 'im-b'} data-ink-op={op} onClick={() => void lassoDo(op)}>{op}</button>
      ))}
      {picked && !colours && <button type="button" role="menuitem" className="im-b" data-ink-op="colour" aria-haspopup="true" onClick={() => setColours(true)}>colour</button>}
      {picked && colours && pens.map((c, i) => (
        <button key={`${c}:${i}`} type="button" role="menuitem" className="im-c" data-ink-colour={c} aria-label={i === CUSTOM ? 'your colour' : `colour ${i + 1}`} onClick={() => { setColours(false); void lassoDo('color', c); }}><span style={{ background: c }} /></button>
      ))}
      {!picked && rest && <button type="button" role="menuitem" className="im-b" data-ink-op="paste" onClick={() => void lassoPaste()}>paste</button>}
    </div>,
    scroller,
  );
}

// ── the pages as a PDF ──

/** What `sharePages` is told of the pages: a notebook's sheets, or a PDF's own pages with their sizes in points. */
export interface PagesOf {
  name: string;
  /** The notebook's id, or the PDF's hash: what the ink is kept under. */
  hash: string;
  written?: WrittenMeta;
  /** A PDF's pages: each its number in the file and its size. */
  pages?: readonly { page: number; w: number; h: number }[];
  /** The pages written on (as the store knows them). */
  inked: ReadonlySet<number>;
}

/** The PDF last made to be passed on: for the checks. */
export let lastShared: string | null = null;

/**
 * The pages and what is written on them as one PDF: on a device, through
 * the system's share sheet from `at`; on a Mac, saved where its dialog says.
 * A notebook's paper and a PDF's own pages are drawn as they are, the ink
 * over them (`pages_pdf`).
 */
export async function sharePages(of: PagesOf, at: { x: number; y: number; w: number; h: number }): Promise<string | null> {
  const vault = currentVault();
  if (!vault) return null;
  const mobile = useApp.getState().mobile;
  const pages = of.written
    ? of.written.sheets.map((s, i, all) => {
      // each sheet as its page setup has it; a pageless notebook is cut into its sheets, and what was written past
      // the foot of the one before is drawn at the head of this one
      const spec = paperOf(of.written!, i);
      const before = of.written!.pageless && i > 0 && of.inked.has(all[i - 1]!) ? pageKey(of.hash, all[i - 1]!) : null;
      // its colours as a light theme shows them: the paper's chosen one (none: white), the ruling's, and whether ink on it is drawn the dark way (87)
      return { w: spec.w, h: spec.h, paper: spec.kind, rule: spec.rule, margin: spec.margin, top: spec.top, at: spec.run ? spec.at : null, ink: of.inked.has(s) ? pageKey(of.hash, s) : null, above: before, color: spec.color, line: spec.line, dark: paperLook(spec, 'light').dark };
    })
    : (of.pages ?? []).map((p) => ({ w: p.w, h: p.h, source: p.page, ink: of.inked.has(p.page) ? pageKey(of.hash, p.page) : null }));
  if (!pages.length) return null;
  let out: string | null = null;
  if (!mobile) {
    out = await pickSave({ defaultPath: `${of.name}.pdf`, filters: [{ name: 'PDF', extensions: ['pdf'] }] });
    if (!out) return null;
  }
  notify(`making a pdf of ${pages.length === 1 ? '1 page' : `${pages.length} pages`}`);
  const path = await invoke<string>('pages_pdf', { root: vault.root, name: of.name, pdf: of.written ? null : of.hash, pages, out });
  lastShared = path;
  if (mobile) {
    useApp.setState({ notice: null });
    await invoke('ink_share', { path, at });
  } else notify(`saved ${path.split('/').pop() ?? 'the pdf'}`);
  return path;
}

// ── the pages' overview ──

interface GridProps {
  id: string;
  /** Where it is drawn: the book, over its pages. */
  into: HTMLElement;
  /** A notebook's: its sheets can be added, made again, deleted and moved. */
  written?: WrittenMeta | undefined;
  hash: string | null;
  /** The pages as the lens counts them: the first's number, and each one's size in points. */
  base: number;
  sizes: readonly { w: number; h: number }[];
  current: number;
  /** The pages written on, each with a count that moves when its strokes do. */
  inked: Readonly<Record<number, number>>;
  pdf: PDFDocumentProxy | null;
  /** Whether a notebook's pages may be changed here: where there is a canvas, or a pointer to do it with. */
  onGo(page: number): void;
  onDelete(page: number, at: { left: number; top: number; bottom: number }): void;
  onClose(): void;
}

const THUMB_W = 148;
/** How long a finger rests on a page before it is lifted to be moved, ms; and how far a mouse drags before it is. */
const LIFT_MS = 340;
const LIFT_PX = 6;

const inkStore = (): StoreFs | null => {
  const vault = currentVault();
  return vault && 'pageInk' in vault.fs ? (vault.fs as StoreFs) : null;
};

/** One page, small: a notebook's sheet as its paper, a PDF's page drawn when it comes near, and what is written on it. */
function Thumb({ hash, page, w, h, rev, paper, pdf, seen }: { hash: string | null; /** As the store knows it. */ page: number; w: number; h: number; rev: number | undefined; paper?: PaperSpec | undefined; pdf: PDFDocumentProxy | null; seen: boolean }) {
  const [ink, setInk] = useState<string | null>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const drawn = useRef(false);
  // a notebook's sheet says whether what is written on it is drawn the dark way; a PDF's page goes by the theme (`pdf.css`)
  const theme = useApp((s) => s.theme);
  const dark = paper ? paperLook(paper, theme).dark : false;
  useEffect(() => {
    const fs = inkStore();
    if (!fs || !hash || rev === undefined || !seen) { if (rev === undefined) setInk(null); return; }
    let live = true;
    let made: string | null = null;
    fs.pageInkFile(hash, page, 'picture', w, h, 1).then((bytes) => {
      if (!live || !bytes.length) return;
      made = URL.createObjectURL(new Blob([bytes as BlobPart], { type: 'image/png' }));
      setInk(made);
    }, console.error);
    return () => { live = false; if (made) URL.revokeObjectURL(made); };
  }, [hash, page, w, h, rev, seen]);
  useEffect(() => {
    const el = canvas.current;
    if (!pdf || !el || !seen || drawn.current) return;
    drawn.current = true;
    let live = true;
    void (async () => {
      try {
        const p = await pdf.getPage(page);
        const dpr = Math.min(2, window.devicePixelRatio || 1);
        const viewport = p.getViewport({ scale: (THUMB_W * dpr) / w });
        el.width = Math.floor(viewport.width);
        el.height = Math.floor(viewport.height);
        if (live) await p.render({ canvas: el, viewport, intent: 'print' }).promise;
      } catch (e) { drawn.current = false; console.error(e); }
    })();
    return () => { live = false; };
  }, [pdf, page, w, seen]);
  return (
    <span className="pg-sheet" style={{ aspectRatio: `${w} / ${h}` }}>
      {paper ? <PaperSheet spec={paper} /> : <canvas ref={canvas} />}
      {ink && <img className="page-ink" data-paper={paper?.kind} data-ink-dark={dark ? '1' : undefined} src={ink} alt="" draggable={false} />}
    </span>
  );
}

export function PageGrid({ id, into, written, hash, base, sizes, current, inked, pdf, onGo, onDelete, onClose }: GridProps): JSX.Element {
  const ref = useRef<HTMLDivElement>(null);
  const [seen, setSeen] = useState<ReadonlySet<number>>(new Set());
  /** A page lifted to be moved: its place, where the pointer is against where it took it, and the place it would be put down before. */
  const [lift, setLift] = useState<{ place: number; dx: number; dy: number; before: number } | null>(null);
  const liftRef = useRef(lift);
  liftRef.current = lift;
  const sheets = written?.sheets;
  const count = sizes.length;

  // the page in view is in view here too, and the canvases know the overview lies over the pages
  useLayoutEffect(() => {
    ref.current?.querySelector(`[data-pg="${current}"]`)?.scrollIntoView({ block: 'center' });
    sceneSoon();
    return () => sceneSoon();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  // a page is drawn when it comes near
  useEffect(() => {
    const root = ref.current;
    if (!root) return;
    if (typeof IntersectionObserver === 'undefined') { setSeen(new Set(sizes.map((_, i) => base + i + 1))); return; }
    const io = new IntersectionObserver((entries) => {
      const got = entries.filter((e) => e.isIntersecting).map((e) => Number((e.target as HTMLElement).dataset.pg));
      if (got.length) setSeen((was) => { const next = new Set(was); for (const n of got) next.add(n); return next; });
    }, { root, rootMargin: '300px 0px' });
    for (const el of root.querySelectorAll('[data-pg]')) io.observe(el);
    return () => io.disconnect();
  }, [count, base, sheets?.join(' ')]);
  useEffect(() => {
    const key = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.stopPropagation(); onClose(); } };
    window.addEventListener('keydown', key, true);
    return () => window.removeEventListener('keydown', key, true);
  }, [onClose]);
  // a page being moved is not the list scrolled
  useEffect(() => {
    const root = ref.current;
    if (!root) return;
    const hold = (e: TouchEvent) => { if (liftRef.current) e.preventDefault(); };
    root.addEventListener('touchmove', hold, { passive: false });
    return () => root.removeEventListener('touchmove', hold);
  }, []);

  /** The place a page let go at `x`, `y` would be put down before: among the others, as they lie in their rows; one past the last after them all. */
  const placeAt = (x: number, y: number, not: number): number => {
    const els = Array.from(ref.current?.querySelectorAll<HTMLElement>('[data-pg]') ?? []).filter((el) => Number(el.dataset.pg) !== not);
    for (const el of els) {
      const r = el.getBoundingClientRect();
      if (y < r.top || (y <= r.bottom && x < r.left + r.width / 2)) return Number(el.dataset.pg);
    }
    return count + 1;
  };
  const drag = useRef<{ id: number; place: number; x: number; y: number; timer: ReturnType<typeof setTimeout> | null; lifted: boolean; el: HTMLElement } | null>(null);
  const liftNow = (x: number, y: number) => {
    const d = drag.current;
    if (!d || d.lifted) return;
    d.lifted = true;
    hapticTick();
    try { d.el.setPointerCapture(d.id); } catch { /* the pointer is gone */ }
    setLift({ place: d.place, dx: x - d.x, dy: y - d.y, before: placeAt(x, y, d.place) });
  };
  const down = (e: React.PointerEvent<HTMLElement>, place: number) => {
    if (!sheets || sheets.length < 2 || (e.target as Element).closest('.pg-more')) return;
    const el = e.currentTarget;
    const x = e.clientX, y = e.clientY;
    drag.current = { id: e.pointerId, place, x, y, lifted: false, el, timer: e.pointerType === 'mouse' ? null : setTimeout(() => liftNow(x, y), LIFT_MS) };
  };
  const move = (e: React.PointerEvent<HTMLElement>) => {
    const d = drag.current;
    if (!d || d.id !== e.pointerId) return;
    const far = Math.hypot(e.clientX - d.x, e.clientY - d.y);
    if (!d.lifted) {
      if (d.timer === null && far > LIFT_PX) liftNow(e.clientX, e.clientY);
      // a finger that moves before it has rested is scrolling
      else if (d.timer !== null && far > 10) { clearTimeout(d.timer); drag.current = null; }
      return;
    }
    setLift({ place: d.place, dx: e.clientX - d.x, dy: e.clientY - d.y, before: placeAt(e.clientX, e.clientY, d.place) });
  };
  /** Set when a page was just moved: the press that ends the drag goes nowhere. */
  const moved = useRef(false);
  const up = (e: React.PointerEvent<HTMLElement>) => {
    const d = drag.current;
    if (!d || d.id !== e.pointerId) return;
    if (d.timer !== null) clearTimeout(d.timer);
    drag.current = null;
    const was = liftRef.current;
    setLift(null);
    if (!d.lifted || !was || !sheets) return;
    moved.current = true;
    setTimeout(() => { moved.current = false; }, 400);
    if (e.type === 'pointercancel') return;
    const sheet = sheets[d.place - 1];
    // before a page that lies after it, it lands one place earlier than that page has now
    const to = was.before > d.place ? was.before - 1 : was.before;
    if (sheet !== undefined && to !== d.place) void moveSheet(id, sheet, to).catch(failed('move page'));
  };
  const more = (el: HTMLElement, place: number) => {
    if (!sheets) return;
    const sheet = sheets[place - 1];
    if (sheet === undefined) return;
    const r = el.getBoundingClientRect();
    const at = { left: r.left, top: r.bottom + 4, bottom: r.bottom + 4 };
    const items: PopItem[] = [
      { label: 'add page after', act: 'pg-add-after', run: () => void addSheetAfter(id, sheet).catch(failed('add page')) },
      { label: 'duplicate', act: 'pg-duplicate', run: () => void duplicateSheet(id, sheet).catch(failed('duplicate page')) },
      { label: '-' },
      { label: 'delete', act: 'pg-delete', danger: true, run: () => onDelete(place, at) },
    ];
    popMenu(at, items, 'book-menu');
  };

  return createPortal(
    <div ref={ref} className="page-grid" role="dialog" aria-label="pages" data-ink-over="" data-written={written ? '1' : undefined} data-lifting={lift ? '1' : undefined}>
      <div className="pg-head">
        <span className="pg-title">pages</span>
        <span className="pg-count">{count}</span>
        {written && (
          <span className="pg-papers" role="group" aria-label="paper">
            {PAPERS.map((k) => (
              <button key={k} type="button" className="pg-paper" data-pg-paper={k} aria-label={`${k} paper`} title={`${k} paper`} aria-pressed={written.paper === k} onClick={() => { if (written.paper !== k) void setPaper(id, k).catch(failed('paper')); }}>
                <PaperSheet spec={{ kind: k, w: 96, h: 124, rule: k === 'ruled' ? 14 : 12, margin: null, top: 22, run: false, at: 0, color: written.color ?? null, line: written.line ?? null }} />
              </button>
            ))}
          </span>
        )}
        <span className="pg-grow" />
        <button type="button" className="pg-done" data-pg-do="close" aria-label="close" title="close" onClick={onClose}><Icon name="close" /></button>
      </div>
      <div className="pg-list">
        {sizes.map((s, i) => {
          const place = base + i + 1;
          const page = sheets ? sheets[i]! : place;
          const lifted = lift?.place === place;
          return (
            <div key={sheets ? `s${page}` : place} className="pg-item" data-pg={place} data-sheet={sheets ? page : undefined} data-current={place === current ? '1' : undefined} data-lifted={lifted ? '1' : undefined} data-drop={lift && !lifted && lift.before === place ? '1' : undefined}
              style={lifted && lift ? { transform: `translate(${lift.dx}px, ${lift.dy}px) scale(1.04)` } : undefined}
              onPointerDown={(e) => down(e, place)} onPointerMove={move} onPointerUp={up} onPointerCancel={up} onContextMenu={(e) => e.preventDefault()}>
              <button type="button" className="pg-go" aria-label={`page ${place}`} aria-current={place === current ? 'page' : undefined} onClick={() => { if (!moved.current) onGo(place); }}>
                <Thumb hash={hash} page={page} w={s.w} h={s.h} rev={inked[page]} paper={written ? paperOf(written, i) : undefined} pdf={written ? null : pdf} seen={seen.has(place)} />
              </button>
              <span className="pg-foot">
                <span className="pg-n">{place}</span>
                {written && <button type="button" className="pg-more" data-pg-do="more" aria-label={`page ${place}: more`} aria-haspopup="menu" onClick={(e) => more(e.currentTarget, place)}><Icon name="more" /></button>}
              </span>
            </div>
          );
        })}
        {written && (
          <div className="pg-item pg-add" data-drop={lift && lift.before === count + 1 ? '1' : undefined}>
            <button type="button" className="pg-go" data-pg-do="add" aria-label="add page" onClick={() => void addSheet(id).catch(failed('add page'))}>
              <span className="pg-sheet pg-plus" style={{ aspectRatio: `${sheetSize(written).w} / ${sheetSize(written).h}` }}><Icon name="add" /></span>
            </button>
            <span className="pg-foot"><span className="pg-n">add page</span></span>
          </div>
        )}
      </div>
    </div>,
    into,
  );
}

// ── page setup ──

/** The spacings offered by name, in points: a ruled sheet's by the names paper is sold under, a grid's and a dotted sheet's by their size. */
export const STOPS: Record<Exclude<PaperKind, 'blank'>, readonly { name: string; rule: number }[]> = {
  ruled: [{ name: 'narrow', rule: 18 }, { name: 'college', rule: 20.25 }, { name: 'wide', rule: 24 }],
  grid: [{ name: '5 mm', rule: 5 * MM }, { name: '7 mm', rule: 20 }, { name: '10 mm', rule: 10 * MM }],
  dotted: [{ name: '5 mm', rule: 5 * MM }, { name: '7 mm', rule: 20 }, { name: '10 mm', rule: 10 * MM }],
};
const mm = (points: number): string => `${(points / MM).toFixed(1)} mm`;
const round2 = (v: number): number => Math.round(v * 100) / 100;

/**
 * A row of colours in `page setup` (milestone 87): the first swatch is none
 * chosen (the paper follows the theme, the ruling is the paper's own), then
 * the ones offered by name, then one taken from the colour wheel: the
 * system's on a device (`ink_color`, as the writing tools' is), the
 * browser's on a Mac. The one chosen has a ring round it and is named at the
 * row's end; a named one pressed again is none chosen.
 */
function Colours({ name, label, none, presets, value, shown, pick }: { name: 'color' | 'line'; label: string; /** What the row says with none chosen. */ none: string; presets: readonly { name: string; value: string }[]; value: string | null; /** The colour drawn with none chosen: where the wheel starts. */ shown: string; pick(color: string | null): void }) {
  const mobile = useApp((s) => s.mobile);
  const named = presets.find((c) => c.value === value);
  /** The colour last taken from the wheel: its swatch keeps it while another is chosen. */
  const [own, setOwn] = useState<string | null>(value !== null && !named ? value : null);
  useEffect(() => { if (value !== null && !presets.some((c) => c.value === value)) setOwn(value); }, [value, presets]);
  const [busy, setBusy] = useState(false);
  const field = useRef<HTMLInputElement>(null);
  const wheel = async (el: HTMLElement) => {
    // its own colour, once it has one and another is chosen, is chosen first; pressed again it is the wheel
    if (own && value !== own) { pick(own); return; }
    if (!mobile) {
      const input = field.current;
      if (!input) return;
      // (where the browser has no way to show it, a press on the field itself does)
      try { if (typeof input.showPicker === 'function') input.showPicker(); else input.click(); } catch { input.click(); }
      return;
    }
    if (busy) return;
    setBusy(true);
    try {
      const r = el.getBoundingClientRect();
      const got = await invoke<{ color: string | null }>('ink_color', { color: own ?? value ?? shown, at: { x: r.left, y: r.top, w: r.width, h: r.height } });
      const c = paperHex(got?.color);
      if (c) { setOwn(c); pick(c); }
    } catch (e) { console.error(e); } finally { setBusy(false); }
  };
  const mine = value !== null && !named;
  return (
    <div className="ps-colours" data-ps-row={name}>
      <div className="ps-row ps-ch">
        <span className="ps-l">{label}</span>
        <span className="ps-cv" data-ps={`${name}-said`}>{value === null ? none : named ? named.name : value}</span>
      </div>
      <div className="ps-cols" role="group" aria-label={label}>
        <button type="button" className="ps-col" data-ps={`${name}-none`} aria-label={none} title={none} aria-pressed={value === null} onClick={() => pick(null)}>
          <span className="ps-dot ps-none" />
        </button>
        {presets.map((c) => (
          <button key={c.name} type="button" className="ps-col" data-ps={`${name}-${c.name}`} data-color={c.value} aria-label={value === c.value ? `${c.name}, press again for ${none}` : c.name} title={c.name} aria-pressed={value === c.value} onClick={() => pick(value === c.value ? null : c.value)}>
            <span className="ps-dot" style={{ background: c.value }} />
          </button>
        ))}
        <button type="button" className="ps-col ps-wheel" data-ps={`${name}-wheel`} data-color={own ?? undefined} aria-label="colours" title="colours" aria-haspopup="dialog" aria-expanded={mobile ? busy : undefined} aria-pressed={mine} onClick={(e) => void wheel(e.currentTarget)}>
          <span className="ps-dot ps-ring"><span className="ps-core" style={own ? { background: own } : undefined} /></span>
        </button>
        {!mobile && <input ref={field} type="color" className="ps-pick" tabIndex={-1} data-ps={`${name}-input`} aria-label={`${label}: colours`} value={own ?? value ?? shown} onChange={(e) => { const c = paperHex(e.currentTarget.value); if (c) { setOwn(c); pick(c); } }} />}
      </div>
    </div>
  );
}

/**
 * `page setup`: one panel over a notebook's pages, which change behind it
 * as it is used. The paper; how far apart its rules, lines or dots are; a
 * ruled sheet's margin rule and the room over its first rule; the paper's
 * colour and the ruling's (`Colours`); whether its
 * sheets are pages or run on as one; a page's size and which way it lies;
 * and `use for new notebooks`, which keeps all of it as what this device's
 * new notebooks start with. Only the paper moves: what is written stays
 * where it is.
 */
export function PageSetup({ id, into, written, onClose }: { id: string; into: HTMLElement; written: WrittenMeta; onClose(): void }): JSX.Element {
  const ref = useRef<HTMLDivElement>(null);
  const [draft, setDraft] = useState<Setup>(() => setupOf(written));
  const [keptNow, setKeptNow] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latest = useRef(draft);
  // what the file says, when it changes under the panel by another hand (a sync), is what the panel says
  const said = JSON.stringify(setupOf(written));
  useEffect(() => { if (timer.current === null) { const now = JSON.parse(said) as Setup; latest.current = now; setDraft(now); } }, [said]);
  const change = (c: Partial<Setup>) => {
    const next = { ...latest.current, ...c };
    latest.current = next;
    setDraft(next);
    setKeptNow(false);
    // a slider dragged writes when it rests a moment, not at every step
    if (timer.current !== null) clearTimeout(timer.current);
    timer.current = setTimeout(() => { timer.current = null; void setSetup(id, latest.current).catch(failed('page setup')); }, 90);
  };
  useEffect(() => () => { if (timer.current !== null) { clearTimeout(timer.current); void setSetup(id, latest.current).catch(console.error); } }, [id]);
  useEffect(() => {
    const out = (e: Event) => { if (!ref.current?.contains(e.target as Node)) onClose(); };
    const key = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.stopPropagation(); onClose(); } };
    document.addEventListener('pointerdown', out, true);
    window.addEventListener('keydown', key, true);
    sceneSoon();
    return () => { document.removeEventListener('pointerdown', out, true); window.removeEventListener('keydown', key, true); sceneSoon(); };
  }, [onClose]);

  const kind = draft.paper;
  const theme = useApp((s) => s.theme);
  const look = paperLook(draft, theme);
  const rule = draft.rule ?? ruleOf(kind);
  const top = draft.top ?? RULE_TOP;
  const seg = <T extends string>(name: string, label: string, value: T, options: readonly { v: T; word: string }[], pick: (v: T) => void) => (
    <div className="ps-row">
      <span className="ps-l">{label}</span>
      <div className="ps-seg" role="group" aria-label={label}>
        {options.map((o) => <button key={o.v} type="button" className="ps-opt" data-ps={`${name}-${o.v}`} aria-pressed={value === o.v} onClick={() => pick(o.v)}>{o.word}</button>)}
      </div>
    </div>
  );
  return createPortal(
    <div ref={ref} className="page-setup" role="dialog" aria-label="page setup" data-ink-over="" onMouseDown={(e) => { e.stopPropagation(); }}>
      <div className="ps-head">
        <span className="ps-title">page setup</span>
        <button type="button" className="ps-done" data-ps="close" aria-label="close" title="close" onClick={onClose}><Icon name="close" /></button>
      </div>
      <div className="ps-papers" role="group" aria-label="paper">
        {PAPERS.map((k) => (
          <button key={k} type="button" className="ps-paper" data-ps={`paper-${k}`} aria-pressed={kind === k} onClick={() => change({ paper: k })}>
            <PaperSheet spec={{ kind: k, w: 96, h: 124, rule: k === 'ruled' ? 14 : 12, margin: null, top: 22, run: false, at: 0, color: draft.color, line: draft.line }} />
            <span>{k}</span>
          </button>
        ))}
      </div>
      {kind !== 'blank' && (
        <div className="ps-block">
          <label className="ps-row">
            <span className="ps-l">spacing</span>
            <input type="range" data-ps="rule" min={4 * MM} max={14 * MM} step={0.01} value={rule} aria-label="spacing" onChange={(e) => change({ rule: round2(Number(e.currentTarget.value)) })} />
            <span className="ps-v">{mm(rule)}</span>
          </label>
          <div className="ps-stops" role="group" aria-label="spacing">
            {STOPS[kind].map((st) => <button key={st.name} type="button" className="ps-stop" data-ps={`stop-${st.name.replace(' ', '')}`} aria-pressed={Math.abs(rule - st.rule) < 0.06} onClick={() => change({ rule: round2(st.rule) })}>{st.name}</button>)}
          </div>
        </div>
      )}
      {kind === 'ruled' && (
        <div className="ps-block">
          <button type="button" className="ps-check" role="switch" data-ps="margin" aria-checked={draft.margin !== null} onClick={() => change({ margin: draft.margin === null ? MARGIN_AT : null })}>
            <span className="ps-ct">margin line</span>
            <span className="ps-sw" aria-hidden="true" />
          </button>
          {draft.margin !== null && (
            <label className="ps-row">
              <span className="ps-l">from the edge</span>
              <input type="range" data-ps="margin-at" min={10 * MM} max={60 * MM} step={0.01} value={draft.margin} aria-label="margin from the edge" onChange={(e) => change({ margin: round2(Number(e.currentTarget.value)) })} />
              <span className="ps-v">{mm(draft.margin)}</span>
            </label>
          )}
          <label className="ps-row">
            <span className="ps-l">top space</span>
            <input type="range" data-ps="top" min={0} max={60 * MM} step={0.01} value={top} aria-label="top space" onChange={(e) => change({ top: round2(Number(e.currentTarget.value)) })} />
            <span className="ps-v">{mm(top)}</span>
          </label>
        </div>
      )}
      <div className="ps-block">
        <Colours name="color" label="paper colour" none="follows the theme" presets={PAPER_COLORS} value={draft.color} shown={look.paper} pick={(color) => change({ color })} />
        {kind !== 'blank' && <Colours name="line" label="line colour" none="default" presets={LINE_COLORS} value={draft.line} shown={look.rule} pick={(line) => change({ line })} />}
      </div>
      <div className="ps-block">
        {seg('layout', 'layout', draft.pageless ? 'pageless' : 'pages', [{ v: 'pages', word: 'pages' }, { v: 'pageless', word: 'pageless' }] as const, (v) => change({ pageless: v === 'pageless' }))}
        {!draft.pageless && seg('size', 'size', draft.size ?? 'letter', [{ v: 'letter', word: 'letter' }, { v: 'a4', word: 'a4' }] as const, (v) => change({ size: v === 'a4' ? 'a4' : null }))}
        {!draft.pageless && seg('turn', 'orientation', draft.turn ?? 'portrait', [{ v: 'portrait', word: 'portrait' }, { v: 'landscape', word: 'landscape' }] as const, (v) => change({ turn: v === 'landscape' ? 'landscape' : null }))}
      </div>
      <button type="button" className="ps-keep" data-ps="keep" aria-pressed={keptNow} onClick={() => { keepSetup(latest.current); setKeptNow(true); }}>{keptNow ? 'new notebooks start like this' : 'use for new notebooks'}</button>
    </div>,
    into,
  );
}
