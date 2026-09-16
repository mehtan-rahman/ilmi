// fit.jsx — pretext-style adaptive measurement for tree rows.
//
// Cheng Lou's Pretext measures text once with the canvas font engine, caches the
// widths, and lays out by pure arithmetic — no DOM reflow. We borrow that exact
// primitive. For every tree row we know the live width; we measure the node name
// and a ladder of candidate "card-info" strings (richest → leanest) and render
// the full name plus the richest info that still fits. The name is identity — it
// only ever truncates if it alone overflows the row.

const _fitCanvas = document.createElement('canvas');
const _fitCtx = _fitCanvas.getContext('2d');
const _fitCache = new Map();
function measureText(text, font) {
  if (!text) return 0;
  const k = font + '\x00' + text;
  let w = _fitCache.get(k);
  if (w === undefined) { _fitCtx.font = font; w = _fitCtx.measureText(text).width; _fitCache.set(k, w); }
  return w;
}

const FALLBACK_FONTS = {
  name: '500 12.5px ui-sans-serif, system-ui, sans-serif',
  serif: '500 12.5px Georgia, serif',
  meta: '10px ui-monospace, SFMono-Regular, monospace',
};

// observe the tree container's content width (pure read, no layout thrash)
function useWidth(ref) {
  const [w, setW] = React.useState(0);
  React.useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const update = () => setW(el.clientWidth);
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return w;
}

// resolve the real rendered fonts once after first paint, so measurement matches
function useResolvedFonts(ref) {
  const [fonts, setFonts] = React.useState(FALLBACK_FONTS);
  React.useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const nameEl = el.querySelector('.trow:not([data-kind="card"]) .name');
    const cardEl = el.querySelector('.trow[data-kind="card"] .name');
    const metaEl = el.querySelector('.trow .meta');
    const f = { ...FALLBACK_FONTS };
    const fontOf = (e) => { const c = getComputedStyle(e); return `${c.fontStyle} ${c.fontWeight} ${c.fontSize} ${c.fontFamily}`; };
    if (nameEl) f.name = fontOf(nameEl);
    if (cardEl) f.serif = fontOf(cardEl);
    if (metaEl) f.meta = `${getComputedStyle(metaEl).fontWeight} ${getComputedStyle(metaEl).fontSize} ${getComputedStyle(metaEl).fontFamily}`;
    setFonts(f);
  }, []);
  return fonts;
}

// pick the richest candidate that fits alongside the full name.
// candidates run richest → leanest; '' means "show nothing".
const FIT_GAP = 8;     // px between name and meta
function fitMeta(candidates, name, avail, fonts, nameFont) {
  if (!candidates || !candidates.length) return '';
  const nameW = measureText(name, nameFont || fonts.name);
  for (const c of candidates) {
    if (!c) return '';
    if (nameW + FIT_GAP + measureText(c, fonts.meta) <= avail) return c;
  }
  return '';
}

// candidate ladders by node kind ────────────────────────────────
function sourceMetaCands(src) {
  const cards = (src.body || []).filter(b => b.kind === 'card');
  const due = cards.filter(c => isDue(c.sched.due)).length;
  const full = src.summary || (cards.length
    ? `${cards.length} card${cards.length > 1 ? 's' : ''}${due ? ` · ${due} due` : ''}` : '');
  const cands = [full];
  if (cards.length) {
    cands.push(due ? `${cards.length}·${due}` : `${cards.length}`);
    if (due) cands.push(`${due}`);
  } else if (full) {
    cands.push(full.split(/\s+/)[0]);
  }
  cands.push('');
  return { cands: [...new Set(cands)], due };
}
