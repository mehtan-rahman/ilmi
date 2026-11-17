// The writing tools (milestones 82, 85): one row over pages that can be
// written on, an iPad's alone. The four tools, the chosen one's three sizes,
// its colours and the colour wheel's swatch, then what can be taken back and
// put back, whether a finger draws, and the row tucked away. What is chosen
// is the device's (`inkTools.ts`), not a document's: every row there is shows
// the same.
//
// The tool in use, pressed again, opens its settings under itself: a pen's
// ink, the size in use made thinner or thicker with a stroke that shows it, a
// highlighter's opacity, the eraser's way, the colours (one pressed while in
// use, or held, is replaced from the wheel) and the last few taken from the
// wheel, and whether a stroke ended resting becomes a shape. Nothing in it
// is a step: each press acts, and the Pencil writing closes it.
//
// The row never scrolls sideways. In a pane too narrow for all of it the
// sizes go first, then the colours but for the one in use; both are in the
// tool's settings, so nothing is lost with them.

import { useEffect, useLayoutEffect, useRef, useState, type JSX } from 'react';
import { createPortal } from 'react-dom';
import { hasCanvas, sceneSoon } from './ink.js';
import {
  CUSTOM, OPACITY_MIN, SIZE_NAMES, SWATCHES, TOOLS, colorOf, inksHere, isInked, isSized, pickColor, rangeOf, redo, setEraser, setFinger, setInk, setOpacity,
  setOpen, setRecent, setShown, setSize, setSnap, setSwatch, setTool, setWidth, swatchName, undo, useInkTools, widthOf,
  type Inked, type Kept, type PenInk, type Sized, type ToolKind,
} from './inkTools.js';
import { Icon, type InkIconName } from './icons.js';
import { useApp } from './store.js';
import './inkbar.css';

const TOOL_ICON: Record<ToolKind, InkIconName> = { pen: 'pen', highlighter: 'highlighter', eraser: 'eraser', select: 'lasso' };

/** How wide the row is with everything on it, and with the sizes gone: under the first the sizes go, under the second the colours too. */
export const ROW_FULL = 748;
export const ROW_MID = 626;
/** How the row is drawn in `w` px. */
/** What the colours take of the row: a tool with none (the eraser) keeps its sizes in that much less. */
export const ROW_COLOURS = 214;
/** How the row is drawn in `w` px, for the tool held: a pen's and a highlighter's unless said. */
export const rowFit = (w: number, tool: ToolKind = 'pen'): 'full' | 'mid' | 'compact' => {
  const full = isInked(tool) ? ROW_FULL : ROW_FULL - ROW_COLOURS;
  return w <= 0 || w >= full || tool === 'select' ? 'full' : w >= ROW_MID || !isInked(tool) ? 'mid' : 'compact';
};

/** A size as it is drawn: a pen's line, a highlighter's band, an eraser's round, as heavy as the size is among what the tool can be. */
function SizeMark({ tool, width }: { tool: Sized; width: number }) {
  const span = tool === 'pen' ? [0.5, 8] : tool === 'highlighter' ? [6, 40] : [4, 48];
  const t = Math.min(1, Math.max(0, (width - span[0]!) / (span[1]! - span[0]!)));
  return (
    <svg className="ib-size-mark" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeLinecap="round" aria-hidden="true" focusable="false">
      {tool === 'pen' && <path d="M4 14.5C7.5 14 9 6.5 16 5.5" strokeWidth={0.9 + Math.sqrt(t) * 4.2} />}
      {tool === 'highlighter' && <path d="M4.5 10h11" strokeWidth={2.5 + t * 8.5} strokeLinecap="butt" />}
      {tool === 'eraser' && <circle cx="10" cy="10" r={2.2 + t * 5.6} strokeWidth="1.4" />}
    </svg>
  );
}

const rectOf = (el: HTMLElement) => { const r = el.getBoundingClientRect(); return { x: r.left, y: r.top, w: r.width, h: r.height }; };

/** How long a swatch is held for the wheel to replace it, ms. */
const HOLD = 420;

/** A tool's colours: its four swatches and the wheel's own. One pressed while in use, or held, is replaced from the wheel. */
function Swatches({ tool, kept, only }: { tool: Inked; kept: Kept; /** The one in use alone: it opens the tool's settings. */ only?: boolean }) {
  const picking = useInkTools((s) => s.picking);
  const hold = useRef<{ timer: ReturnType<typeof setTimeout>; fired: boolean } | null>(null);
  const custom = kept.custom[tool];
  const at = kept.swatch[tool];
  if (only) {
    return (
      <div className="ib-group ib-swatches" role="group" aria-label="colour">
        <button type="button" className="ib-btn ib-sw" data-ink-swatch="current" aria-label="colour" title="colour" aria-haspopup="dialog" aria-pressed="true" onClick={() => setOpen(useInkTools.getState().open === tool ? null : tool)}>
          <span className="ib-dot" style={{ background: colorOf(kept, tool) }} />
        </button>
      </div>
    );
  }
  const press = (el: HTMLElement, i: number) => {
    if (hold.current?.fired) { hold.current = null; return; }
    // the one in use, pressed again, is replaced from the wheel
    if (at === i) void pickColor(tool, rectOf(el), i);
    else setSwatch(tool, i);
  };
  const down = (el: HTMLElement, i: number) => {
    if (hold.current) clearTimeout(hold.current.timer);
    const h = { fired: false, timer: setTimeout(() => { h.fired = true; void pickColor(tool, rectOf(el), i); }, HOLD) };
    hold.current = h;
  };
  const up = () => { if (hold.current && !hold.current.fired) { clearTimeout(hold.current.timer); hold.current = null; } };
  const wheel = (el: HTMLElement): void => {
    // its own colour, once it has one and another is in use, is chosen first; pressed again it is the wheel
    if (custom && at !== CUSTOM) { setSwatch(tool, CUSTOM); return; }
    void pickColor(tool, rectOf(el));
  };
  return (
    <div className="ib-group ib-swatches" role="group" aria-label="colour">
      {kept.colors[tool].map((color, i) => (
        <button key={i} type="button" className="ib-btn ib-sw" data-ink-swatch={i} data-color={color} aria-label={swatchName(kept, tool, i)} title={swatchName(kept, tool, i)} aria-pressed={at === i} aria-expanded={picking?.tool === tool && picking.slot === i ? true : undefined}
          onPointerDown={(e) => down(e.currentTarget, i)} onPointerUp={up} onPointerLeave={up} onPointerCancel={up} onContextMenu={(e) => e.preventDefault()} onClick={(e) => press(e.currentTarget, i)}>
          <span className="ib-dot" style={{ background: color }} />
        </button>
      ))}
      <button type="button" className="ib-btn ib-sw ib-wheel" data-ink-swatch="wheel" data-color={custom ?? undefined} aria-label="colours" title="colours" aria-haspopup="dialog" aria-expanded={picking?.tool === tool && picking.slot === CUSTOM} aria-pressed={at === CUSTOM} onClick={(e) => wheel(e.currentTarget)}>
        <span className="ib-dot ib-ring"><span className="ib-core" style={custom ? { background: custom } : undefined} /></span>
      </button>
    </div>
  );
}

/** A tool's three sizes. */
function Sizes({ tool, kept }: { tool: Sized; kept: Kept }) {
  return (
    <div className="ib-group ib-sizes" role="group" aria-label="size">
      {SIZE_NAMES.map((name, i) => (
        <button key={name} type="button" className="ib-btn ib-size" data-ink-size={i} aria-label={name} title={name} aria-pressed={kept.size[tool] === i} onClick={() => setSize(tool, i)}>
          <SizeMark tool={tool} width={kept.widths[tool][i]!} />
        </button>
      ))}
    </div>
  );
}

/** The stroke a tool makes as it is set: a pen's line in its ink, a highlighter's band over words, the eraser's round on a line. */
function Preview({ tool, kept, width }: { tool: Sized; kept: Kept; width: number }) {
  const path = 'M14 34C40 6 62 52 96 30S150 12 178 28s26 8 34-2';
  // a page's point is about this many of the screen's at the size the pages fit
  const k = 1.6;
  return (
    <svg className="ip-preview" data-ink-preview={tool} data-width={width} viewBox="0 0 228 56" fill="none" aria-hidden="true" focusable="false">
      {tool === 'highlighter' && <>
        <path className="ip-words" d="M16 22h44M68 22h30M106 22h52M166 22h40M16 38h30M54 38h58M120 38h34M162 38h44" />
        <path d="M14 30h200" stroke={colorOf(kept, 'highlighter')} strokeOpacity={0.55 * kept.opacity + 0.1} strokeWidth={width * 0.9} strokeLinecap="butt" />
      </>}
      {tool === 'pen' && (kept.ink === 'fountain'
        ? <><path d={path} stroke={colorOf(kept, 'pen')} strokeWidth={width * k * 0.55} strokeLinecap="round" /><path d="M40 12C52 30 62 44 96 30M150 15c10 2 20 6 28 13" stroke={colorOf(kept, 'pen')} strokeWidth={width * k * 1.15} strokeLinecap="round" /></>
        : <path d={path} stroke={colorOf(kept, 'pen')} strokeWidth={width * k} strokeLinecap="round" strokeOpacity={kept.ink === 'pencil' ? 0.62 : 1} strokeDasharray={kept.ink === 'pencil' ? '0.6 1.1' : undefined} />)}
      {tool === 'eraser' && <>
        <path className="ip-line" d={path} />
        <circle className="ip-reach" cx="114" cy="28" r={Math.min(26, width)} />
      </>}
    </svg>
  );
}

const INK_MARK: Record<PenInk, JSX.Element> = {
  pen: <path d="M3 12C7 4 10 14 17 6" strokeWidth="2" />,
  monoline: <path d="M3 12C7 4 10 14 17 6" strokeWidth="1.1" />,
  fountain: <><path d="M3 12C7 4 10 14 17 6" strokeWidth="1" /><path d="M5.2 8.4C7 6 8.6 8 10.4 10.6" strokeWidth="2.6" /></>,
  pencil: <path d="M3 12C7 4 10 14 17 6" strokeWidth="2" strokeDasharray="0.5 1.4" />,
};

/** A tool's settings, under the row from the tool. */
function Settings({ tool, kept, anchor, onClose }: { tool: Sized; kept: Kept; anchor: HTMLElement; onClose(): void }) {
  const caps = useInkTools((s) => s.caps);
  const ref = useRef<HTMLDivElement>(null);
  const [at, setAt] = useState<{ left: number; top: number } | null>(null);
  useLayoutEffect(() => {
    const place = () => {
      const r = anchor.getBoundingClientRect();
      const bar = anchor.closest('.inkbar')?.getBoundingClientRect() ?? r;
      const w = ref.current?.offsetWidth ?? 296;
      setAt({ left: Math.max(8, Math.min(window.innerWidth - w - 8, r.left - 6)), top: bar.bottom + 6 });
    };
    place();
    window.addEventListener('resize', place);
    return () => window.removeEventListener('resize', place);
  }, [anchor]);
  // a press anywhere else closes it; the Pencil writing does too (`ink.ts`)
  useEffect(() => {
    const out = (e: Event) => {
      const t = e.target as Node | null;
      if (t && (ref.current?.contains(t) || anchor.closest('.inkbar')?.contains(t))) return;
      onClose();
    };
    const key = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('pointerdown', out, true);
    document.addEventListener('keydown', key);
    return () => { document.removeEventListener('pointerdown', out, true); document.removeEventListener('keydown', key); };
  }, [anchor, onClose]);
  // the canvases are told where it lies: the Pencil does not write through it
  useEffect(() => { sceneSoon(); return () => sceneSoon(); }, [at, tool]);

  const [lo, hi] = rangeOf(kept, tool, caps?.inks);
  const width = widthOf(kept, tool, caps?.inks);
  const inks = inksHere(caps);
  return createPortal(
    <div ref={ref} className="ink-pop" role="dialog" aria-label={`${tool} settings`} data-ink-over="" data-ink-pop={tool} style={at ? { left: at.left, top: at.top } : { visibility: 'hidden' }} onMouseDown={(e) => { e.stopPropagation(); if ((e.target as HTMLElement).tagName !== 'INPUT') e.preventDefault(); }}>
      {tool === 'pen' && inks.length > 1 && (
        <div className="ip-seg" role="group" aria-label="pen">
          {inks.map(({ ink, name }) => (
            <button key={ink} type="button" className="ip-opt" data-ink-ink={ink} aria-pressed={kept.ink === ink} onClick={() => setInk(ink)}>
              <svg viewBox="0 0 20 18" fill="none" stroke="currentColor" strokeLinecap="round" aria-hidden="true" focusable="false">{INK_MARK[ink]}</svg>
              <span>{name}</span>
            </button>
          ))}
        </div>
      )}
      {tool === 'eraser' && (
        <div className="ip-seg" role="group" aria-label="erases">
          <button type="button" className="ip-opt ip-wide" data-ink-eraser="stroke" aria-pressed={kept.eraser === 'stroke'} onClick={() => setEraser('stroke')}><span>whole stroke</span></button>
          <button type="button" className="ip-opt ip-wide" data-ink-eraser="part" aria-pressed={kept.eraser === 'part'} onClick={() => setEraser('part')}><span>part of a stroke</span></button>
        </div>
      )}
      <Preview tool={tool} kept={kept} width={width} />
      <label className="ip-row">
        <span className="ip-l">size</span>
        <input type="range" data-ink-range="width" min={lo} max={hi} step={0.1} value={width} aria-label="size" onChange={(e) => setWidth(tool, Number(e.currentTarget.value))} />
        <span className="ip-v">{width.toFixed(1)}</span>
      </label>
      {tool === 'highlighter' && (
        <label className="ip-row">
          <span className="ip-l">opacity</span>
          <input type="range" data-ink-range="opacity" min={OPACITY_MIN} max={1} step={0.05} value={kept.opacity} aria-label="opacity" onChange={(e) => setOpacity(Number(e.currentTarget.value))} />
          <span className="ip-v">{Math.round(kept.opacity * 100)}%</span>
        </label>
      )}
      <div className="ip-line"><Sizes tool={tool} kept={kept} /></div>
      {isInked(tool) && <>
        <div className="ip-line"><Swatches tool={tool} kept={kept} /></div>
        {kept.recent[tool].length > 0 && (
          <div className="ip-recent" role="group" aria-label="recent colours">
            <span className="ip-l">recent</span>
            {kept.recent[tool].map((c) => (
              <button key={c} type="button" className="ip-rc" data-ink-recent={c} aria-label={`recent colour ${c}`} aria-pressed={colorOf(kept, tool) === c} onClick={() => setRecent(tool, c)}><span style={{ background: c }} /></button>
            ))}
          </div>
        )}
        <button type="button" className="ip-check" role="switch" data-ink-snap="" aria-checked={kept.snap} onClick={() => setSnap(!kept.snap)}>
          <Icon name="shapes" />
          <span className="ip-ct">{tool === 'pen' ? 'hold to make a shape' : 'hold for a straight line'}</span>
          <span className="ip-sw" aria-hidden="true" />
        </button>
      </>}
    </div>,
    document.body,
  );
}

export function InkBar({ id, fixed = false }: { id: string; /** Always there, with nothing to tuck it away: over a typed note's ink, which has no bar to bring it back from. */ fixed?: boolean }): JSX.Element | null {
  const pad = useApp((s) => s.mobile && !s.phone);
  const kept = useInkTools((s) => s.kept);
  const canUndo = useInkTools((s) => s.undo);
  const canRedo = useInkTools((s) => s.redo);
  const open = useInkTools((s) => s.open);
  const bar = useRef<HTMLDivElement>(null);
  const [fit, setFit] = useState<'full' | 'mid' | 'compact'>('full');
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const show = pad && hasCanvas() && (fixed || kept.shown);
  useLayoutEffect(() => {
    const el = bar.current;
    if (!el) return;
    const measure = () => setFit(rowFit(el.clientWidth, useInkTools.getState().kept.tool));
    measure();
    if (typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [show, kept.tool]);
  const tool = kept.tool;
  // the settings hang from the tool's own button on this row: several rows may stand (a pane beside), one has them
  useLayoutEffect(() => {
    const el = open && open === tool ? bar.current?.querySelector<HTMLElement>(`[data-ink-tool="${open}"]`) ?? null : null;
    setAnchor(el && el.getClientRects().length && bar.current?.closest('.pane')?.getAttribute('data-active') !== '0' ? el : null);
  }, [open, tool, show, fit]);
  // a tool other than the one whose settings are open: they close
  useEffect(() => { if (open && open !== tool) setOpen(null); }, [open, tool]);
  if (!show) return null;

  const pressTool = (t: ToolKind) => {
    if (t !== tool) { setTool(t); return; }
    // the tool in use, pressed again: its settings, and away again
    if (isSized(t)) setOpen(open === t ? null : t);
  };

  return (
    // a press on a tool takes the caret from nowhere: a note's keyboard stays as it was
    <div ref={bar} className="inkbar" role="toolbar" aria-label="writing tools" data-for={id} data-tool={tool} data-fit={fit} onMouseDown={(e) => e.preventDefault()}>
      <div className="ib-group ib-tools">
        {TOOLS.map((t) => (
          <button key={t} type="button" className="ib-btn ib-tool" data-ink-tool={t} aria-label={t} title={t} aria-pressed={tool === t} aria-haspopup={isSized(t) ? 'dialog' : undefined} aria-expanded={isSized(t) ? open === t && tool === t : undefined} onClick={() => pressTool(t)}>
            <Icon name={TOOL_ICON[t]} />
            {isInked(t) && <span className="ib-ink" style={{ background: colorOf(kept, t) }} />}
          </button>
        ))}
      </div>
      {isSized(tool) && fit === 'full' && <Sizes tool={tool} kept={kept} />}
      {isInked(tool) && <Swatches tool={tool} kept={kept} only={fit === 'compact'} />}
      <span className="ib-grow" />
      <div className="ib-group ib-history">
        <button type="button" className="ib-btn" data-ink-do="undo" aria-label="undo" title="undo" disabled={!canUndo} onClick={() => void undo()}><Icon name="undo" /></button>
        <button type="button" className="ib-btn" data-ink-do="redo" aria-label="redo" title="redo" disabled={!canRedo} onClick={() => void redo()}><Icon name="redo" /></button>
      </div>
      <div className="ib-group ib-ends">
        <button type="button" className="ib-btn" data-ink-do="finger" aria-label="draw with finger" title="draw with finger" aria-pressed={kept.finger} onClick={() => setFinger(!kept.finger)}><Icon name="finger" /></button>
        {!fixed && <button type="button" className="ib-btn" data-ink-do="tuck" aria-label="hide tools" title="hide tools" onClick={() => setShown(false)}><Icon name="tuck" /></button>}
      </div>
      {anchor && isSized(tool) && open === tool && <Settings tool={tool} kept={kept} anchor={anchor} onClose={() => setOpen(null)} />}
    </div>
  );
}

/** The word that brings the row back, in the bar's first row: there while the row is tucked away. */
export function InkToggle(): JSX.Element | null {
  const pad = useApp((s) => s.mobile && !s.phone);
  const shown = useInkTools((s) => s.kept.shown);
  if (!pad || !hasCanvas() || shown) return null;
  return <button type="button" className="pt-btn" data-tool="ink-tools" aria-label="show tools" title="show tools" aria-pressed="false" onClick={() => setShown(true)}><Icon name="pen" /></button>;
}
