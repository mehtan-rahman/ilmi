// What is written on a page, as the page draws it (milestone 89; `pageInk.ts`): an SVG lying where the page lies,
// in the pages' own column, a path a stroke. A PDF's page on every device, and a notebook's sheet where it is read
// (a Mac, a phone).

import { useEffect, useLayoutEffect, useReducer, useRef, useState } from 'react';
import type { StoreFs } from '../vault/index.js';
import { askOutlines, carryOf, drawInk, inkNow, learnShapes, liveOf, onLive, shapeOf, shownNames, shownSoon, signalDrawn, signalReady, storeRead } from './pageInk.js';
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
export function PageInkSvg({ hash, page, at, w, h, rev, rect, sheet, paper, dark, run, onShown }: { hash: string; page: number; /** Its place in the column. */ at: number; w: number; h: number; rev: number; rect: Rect; sheet: string; /** A notebook's sheet: its paper, and whether that is dark, so its ink is turned as the sheet is (87); a PDF's page goes by the theme. */ paper?: string | undefined; dark?: boolean | undefined; /** A pageless notebook's sheet: a stroke kept on it is drawn however far past its foot it runs. */ run?: boolean; onShown(page: number): void }) {
  const ref = useRef<SVGSVGElement>(null);
  const under = useRef<SVGSVGElement>(null);
  const [store, setStore] = useState<readonly string[] | null>(null);
  const [, again] = useReducer((n: number) => n + 1, 0);
  /** How far down the sheet's own points its ink reaches: past `h` only on a pageless sheet. */
  const [reach, setReach] = useState(h);
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
  useEffect(() => signalReady(), []);
  useLayoutEffect(() => {
    const svg = ref.current;
    if (!svg) return;
    const live = liveOf(sheet);
    // (told of strokes whose outlines are not here: they are asked for, and what is drawn stays as it is until they come)
    if (live && live.names.some((n) => !shapeOf(n))) { askOutlines(sheet, live.names); return; }
    const missing = drawInk(svg, shownNames(live, store), carryOf(sheet), live?.hide, under.current);
    // drawn: PencilKit's own copy of what was just written can leave the glass
    // (first in the page's own commit, which is what takes the canvas's copy off the glass in the same frame; and by
    // a message two frames on, for a web view that hears no commit)
    if (live && !live.kept && !missing && live.stamp !== undefined) signalDrawn(live.stamp);
    if (live && !live.kept && !missing) shownSoon(sheet, live.seq);
    if (!missing && (live || store)) onShown(page);
    // a pageless sheet's drawing is as tall as its ink reaches (a stroke is kept on the sheet its top lies on, however
    // far down it runs): the drawing's own box, since what overflows a box far off the screen is not painted
    if (run) {
      let low = h;
      for (const el of [svg, under.current]) {
        try { const b = el && typeof el.getBBox === 'function' ? el.getBBox() : null; if (b && b.height > 0) low = Math.max(low, Math.ceil(b.y + b.height) + 4); } catch { /* not laid out */ }
      }
      if (Math.abs(low - reach) > 0.5) setReach(low);
    }
  });
  const tall = run ? Math.max(h, reach) : h;
  // two drawings a page: a pen's strokes lie over the print as they are, a highlighter's are multiplied onto it (`pdf.css`)
  const place = { left: rect.left, top: rect.top, width: rect.width, height: rect.height * (tall / h) };
  return (
    <>
      <svg ref={ref} className="page-ink" data-vector="1" data-page={at} data-sheet={page} data-rev={rev} data-paper={paper} data-ink-dark={dark ? '1' : undefined} data-run={run ? '1' : undefined} viewBox={`0 0 ${w} ${tall}`} preserveAspectRatio="none" style={place} />
      <svg ref={under} className="page-ink page-ink-under" data-page={at} data-under={at} data-paper={paper} data-ink-dark={dark ? '1' : undefined} data-run={run ? '1' : undefined} viewBox={`0 0 ${w} ${tall}`} preserveAspectRatio="none" style={place} />
    </>
  );
}
