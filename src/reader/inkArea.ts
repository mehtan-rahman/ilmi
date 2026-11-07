// An ink area in the flow of a note (milestone 69). A paragraph that is
// nothing but a page of ink's line is an area where there is a canvas: as
// tall as what is written and the room left under it, its picture laid
// where its strokes lie rather than centred; `src/app/noteInk.ts` says how
// each one stands. A new area has no line yet: it is a gap in the flow,
// held open at a place between two blocks until its first stroke is kept.

import { Plugin, PluginKey, type EditorState, type Transaction } from 'prosemirror-state';
import { Decoration, DecorationSet } from 'prosemirror-view';
import type { Node as PMNode } from 'prosemirror-model';

/** One area as the page draws it, in px. */
export interface InkBox {
  height: number;
  /** Where its picture lies inside it, and how wide it is drawn. */
  left: number;
  top: number;
  width: number;
  /** A canvas lies over it just now: the picture beneath would be the same strokes twice. */
  live: boolean;
}

/** A new area: `height` px held open before the block at `pos`. */
export interface InkGap {
  id: string;
  pos: number;
  height: number;
}

export type InkBoxes = ReadonlyMap<string, InkBox>;

const LINE = /^!\[[^\]]*\]\(([^)\s]*ink-\d+\.png)\)$/;

/** The image source of a paragraph that is only a page of ink's line. */
export const inkLineSrc = (text: string): string | null => LINE.exec(text.trim())?.[1] ?? null;

/** Every page of ink's line in `doc`, by where its paragraph is: only the top level's, which are areas. */
export function inkLines(doc: PMNode): { src: string; pos: number; size: number }[] {
  const out: { src: string; pos: number; size: number }[] = [];
  doc.forEach((node, pos) => {
    if (node.type.name !== 'paragraph') return;
    const src = inkLineSrc(node.textContent);
    if (src) out.push({ src, pos, size: node.nodeSize });
  });
  return out;
}

interface State {
  gap: InkGap | null;
  decos: DecorationSet;
}

/** `tr.setMeta(inkKey, { gap })`: a gap opened, grown or let go; `'redraw'`: the boxes said anew. */
export const inkKey = new PluginKey<State>('inkAreas');
export type InkMeta = { gap: InkGap | null } | 'redraw';

function build(doc: PMNode, boxes: InkBoxes, gap: InkGap | null): DecorationSet {
  const decos: Decoration[] = [];
  for (const { src, pos, size } of inkLines(doc)) {
    const b = boxes.get(src);
    if (!b) continue;
    decos.push(Decoration.node(pos, pos + size, {
      class: `ink-area${b.live ? ' ink-live' : ''}`,
      style: `height:${b.height}px;--ink-l:${b.left}px;--ink-t:${b.top}px;--ink-w:${b.width}px`,
    }));
  }
  if (gap) {
    decos.push(Decoration.widget(gap.pos, () => {
      const el = document.createElement('div');
      el.className = 'ink-gap';
      el.dataset.sheet = gap.id;
      el.style.height = `${gap.height}px`;
      return el;
    }, { side: -1, key: `ink-gap|${gap.id}|${gap.height}` }));
  }
  return DecorationSet.create(doc, decos);
}

/** The areas of a note, as `boxes()` says they stand. */
export const inkAreas = (boxes: () => InkBoxes): Plugin<State> =>
  new Plugin<State>({
    key: inkKey,
    state: {
      init: (_c, s: EditorState) => ({ gap: null, decos: build(s.doc, boxes(), null) }),
      apply(tr: Transaction, cur: State): State {
        const meta = tr.getMeta(inkKey) as InkMeta | undefined;
        let gap = cur.gap;
        if (gap && tr.docChanged) gap = { ...gap, pos: tr.mapping.map(gap.pos, -1) };
        if (meta !== undefined && meta !== 'redraw') gap = meta.gap;
        if (meta === undefined && !tr.docChanged) return cur;
        return { gap, decos: build(tr.doc, boxes(), gap) };
      },
    },
    props: { decorations: (s) => inkKey.getState(s)?.decos ?? null },
  });
