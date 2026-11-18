// What is written on a PDF's page, as the page draws it where there are canvases (milestone 89; `pageInk.ts`):
// an SVG lying where the page lies, in the pages' own column, a path a stroke.

import { useEffect, useLayoutEffect, useReducer, useRef, useState } from 'react';
import type { StoreFs } from '../vault/index.js';
import { askOutlines, carryOf, drawInk, inkNow, learnShapes, liveOf, onLive, shapeOf, shownNames, shownSoon, storeRead } from './pageInk.js';
import { currentVault } from './vault.js';

interface Rect { left: number; top: number; width: number; height: number }

const inkStore = (): StoreFs | null => {
  const vault = currentVault();
  return vault && 'pageInk' in vault.fs ? (vault.fs as StoreFs) : null;
};

/**
 * The strokes of page `page` of the PDF `hash`, drawn over `rect` of the pages' column: `w` by `h` are the page's
 * points, which are the strokes' own. `rev` moves when the store's strokes do; `sheet` is the name the canvases'
 * side knows the page by, and what it says the page holds is shown at once, before it is kept.
 */
export function PageInkSvg({ hash, page, at, w, h, rev, rect, sheet, onShown }: { hash: string; page: number; /** Its place in the column. */ at: number; w: number; h: number; rev: number; rect: Rect; sheet: string; onShown(page: number): void }) {
  const ref = useRef<SVGSVGElement>(null);
  const [store, setStore] = useState<readonly string[] | null>(null);
  const [, again] = useReducer((n: number) => n + 1, 0);
  useEffect(() => {
    const fs = inkStore();
    if (!fs) return;
    let live = true;
    const began = inkNow();
    fs.pageInk(hash, page).then(async (strokes) => {
      await learnShapes(strokes);
      if (!live) return;
      setStore(strokes.map((s) => s.stroke));
      storeRead(sheet, began);
    }, console.error);
    return () => { live = false; };
  }, [hash, page, rev, sheet]);
  useEffect(() => onLive(sheet, again), [sheet]);
  useLayoutEffect(() => {
    const svg = ref.current;
    if (!svg) return;
    const live = liveOf(sheet);
    // (told of strokes whose outlines are not here: they are asked for, and what is drawn stays as it is until they come)
    if (live && live.names.some((n) => !shapeOf(n))) { askOutlines(sheet, live.names); return; }
    const missing = drawInk(svg, shownNames(live, store), carryOf(sheet), live?.hide);
    // drawn: PencilKit's own copy of what was just written can leave the glass
    if (live && !live.kept && !missing) shownSoon(sheet, live.seq);
    if (!missing && (live || store)) onShown(page);
  });
  return <svg ref={ref} className="page-ink" data-vector="1" data-page={at} data-sheet={page} data-rev={rev} viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" style={{ left: rect.left, top: rect.top, width: rect.width, height: rect.height }} />;
}
