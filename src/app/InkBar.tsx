// The writing tools (milestone 82): one row over pages that can be written
// on, an iPad's alone. The four tools, the chosen one's three sizes, its
// colours and the colour wheel's swatch, then what can be taken back and put
// back, and whether a finger draws. What is chosen is the device's
// (`inkTools.ts`), not a document's: every row there is shows the same.

import type { JSX } from 'react';
import { hasCanvas } from './ink.js';
import { CUSTOM, SIZE_NAMES, SWATCHES, TOOLS, isInked, isSized, pickColor, redo, setFinger, setSize, setSwatch, setTool, undo, useInkTools, type Inked, type Sized, type ToolKind } from './inkTools.js';
import { Icon, type InkIconName } from './icons.js';
import { useApp } from './store.js';
import './inkbar.css';

const TOOL_ICON: Record<ToolKind, InkIconName> = { pen: 'pen', highlighter: 'highlighter', eraser: 'eraser', select: 'lasso' };

/** A size as it is drawn: a pen's line, a highlighter's band, an eraser's round. */
function SizeMark({ tool, size }: { tool: Sized; size: number }) {
  return (
    <svg className="ib-size-mark" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeLinecap="round" aria-hidden="true" focusable="false">
      {tool === 'pen' && <path d="M4 14.5C7.5 14 9 6.5 16 5.5" strokeWidth={[1.2, 2.3, 3.8][size]} />}
      {tool === 'highlighter' && <path d="M4.5 10h11" strokeWidth={[3, 5.5, 8.5][size]} strokeLinecap="butt" />}
      {tool === 'eraser' && <circle cx="10" cy="10" r={[2.6, 4.6, 7][size]} strokeWidth="1.4" />}
    </svg>
  );
}

export function InkBar({ id }: { id: string }): JSX.Element | null {
  const pad = useApp((s) => s.mobile && !s.phone);
  const kept = useInkTools((s) => s.kept);
  const canUndo = useInkTools((s) => s.undo);
  const canRedo = useInkTools((s) => s.redo);
  const picking = useInkTools((s) => s.picking);
  if (!pad || !hasCanvas()) return null;

  const tool = kept.tool;
  const custom = isInked(tool) ? kept.custom[tool] : null;
  const wheel = (el: HTMLElement, t: Inked): void => {
    // its own colour, once it has one and another is in use, is chosen first; pressed again it is the wheel
    if (kept.custom[t] && kept.swatch[t] !== CUSTOM) { setSwatch(t, CUSTOM); return; }
    const r = el.getBoundingClientRect();
    void pickColor(t, { x: r.left, y: r.top, w: r.width, h: r.height });
  };

  return (
    // a press on a tool takes the caret from nowhere: a note's keyboard stays as it was
    <div className="inkbar" role="toolbar" aria-label="writing tools" data-for={id} data-tool={tool} onMouseDown={(e) => e.preventDefault()}>
      <div className="ib-group ib-tools">
        {TOOLS.map((t) => (
          <button key={t} type="button" className="ib-btn" data-ink-tool={t} aria-label={t} title={t} aria-pressed={tool === t} onClick={() => setTool(t)}>
            <Icon name={TOOL_ICON[t]} />
          </button>
        ))}
      </div>
      {isSized(tool) && (
        <div className="ib-group ib-sizes" role="group" aria-label="size">
          {SIZE_NAMES.map((name, i) => (
            <button key={name} type="button" className="ib-btn ib-size" data-ink-size={i} aria-label={name} title={name} aria-pressed={kept.size[tool] === i} onClick={() => setSize(tool, i)}>
              <SizeMark tool={tool} size={i} />
            </button>
          ))}
        </div>
      )}
      {isInked(tool) && (
        <div className="ib-group ib-swatches" role="group" aria-label="colour">
          {SWATCHES[tool].map((s, i) => (
            <button key={s.color} type="button" className="ib-btn ib-sw" data-ink-swatch={i} aria-label={s.name} title={s.name} aria-pressed={kept.swatch[tool] === i} onClick={() => setSwatch(tool, i)}>
              <span className="ib-dot" style={{ background: s.color }} />
            </button>
          ))}
          <button type="button" className="ib-btn ib-sw ib-wheel" data-ink-swatch="wheel" data-color={custom ?? undefined} aria-label="colours" title="colours" aria-haspopup="dialog" aria-expanded={picking === tool} aria-pressed={kept.swatch[tool] === CUSTOM} onClick={(e) => wheel(e.currentTarget, tool)}>
            <span className="ib-dot ib-ring"><span className="ib-core" style={custom ? { background: custom } : undefined} /></span>
          </button>
        </div>
      )}
      <span className="ib-grow" />
      <div className="ib-group ib-history">
        <button type="button" className="ib-btn" data-ink-do="undo" aria-label="undo" title="undo" disabled={!canUndo} onClick={() => void undo()}><Icon name="undo" /></button>
        <button type="button" className="ib-btn" data-ink-do="redo" aria-label="redo" title="redo" disabled={!canRedo} onClick={() => void redo()}><Icon name="redo" /></button>
        <button type="button" className="ib-btn" data-ink-do="finger" aria-label="draw with finger" title="draw with finger" aria-pressed={kept.finger} onClick={() => setFinger(!kept.finger)}><Icon name="finger" /></button>
      </div>
    </div>
  );
}
