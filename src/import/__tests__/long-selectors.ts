// jsdom's selector engine (`@asamuzakjp/dom-selector`) refuses a selector
// list longer than 2048 characters, which Defuddle's removal lists are, and
// Defuddle then falls back to the whole body. Browsers have no such limit.
// This splits an over-long list at its top-level commas and unions the
// results in document order, so a test under jsdom runs Defuddle's whole
// pipeline. Test-side only; the webview never needs it.

const LIMIT = 2048;
const CHUNK = 1500;

/** The selector list split at top-level commas, regrouped into lists under `CHUNK` characters. */
export function splitSelector(sel: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let quote: string | null = null;
  let cur = '';
  for (const ch of sel) {
    if (quote) { cur += ch; if (ch === quote) quote = null; continue; }
    if (ch === '"' || ch === "'") { quote = ch; cur += ch; continue; }
    if (ch === '(' || ch === '[') depth++;
    if (ch === ')' || ch === ']') depth--;
    if (ch === ',' && depth === 0) { parts.push(cur); cur = ''; continue; }
    cur += ch;
  }
  if (cur.trim()) parts.push(cur);
  const chunks: string[] = [];
  let buf = '';
  for (const p of parts) {
    if (buf && buf.length + p.length + 1 > CHUNK) { chunks.push(buf); buf = ''; }
    buf = buf ? `${buf},${p}` : p;
  }
  if (buf) chunks.push(buf);
  return chunks;
}

let installed = false;

/** Patch the global DOM's selector methods once. */
export function allowLongSelectors(): void {
  if (installed) return;
  installed = true;
  const byPosition = (a: Element, b: Element) => (a === b ? 0 : a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1);
  for (const proto of [Element.prototype, Document.prototype, DocumentFragment.prototype]) {
    const qsa = proto.querySelectorAll;
    const qs = proto.querySelector;
    proto.querySelectorAll = function (this: ParentNode, sel: string) {
      if (typeof sel !== 'string' || sel.length <= LIMIT) return qsa.call(this, sel);
      const seen = new Set<Element>();
      const out: Element[] = [];
      for (const c of splitSelector(sel)) for (const el of Array.from(qsa.call(this, c))) if (!seen.has(el)) { seen.add(el); out.push(el); }
      out.sort(byPosition);
      return out as unknown as NodeListOf<Element>;
    } as typeof proto.querySelectorAll;
    proto.querySelector = function (this: ParentNode, sel: string) {
      if (typeof sel !== 'string' || sel.length <= LIMIT) return qs.call(this, sel);
      return this.querySelectorAll(sel)[0] ?? null;
    } as typeof proto.querySelector;
  }
  const matches = Element.prototype.matches;
  Element.prototype.matches = function (this: Element, sel: string) {
    if (typeof sel !== 'string' || sel.length <= LIMIT) return matches.call(this, sel);
    return splitSelector(sel).some((c) => matches.call(this, c));
  } as typeof Element.prototype.matches;
  const closest = Element.prototype.closest;
  Element.prototype.closest = function (this: Element, sel: string) {
    if (typeof sel !== 'string' || sel.length <= LIMIT) return closest.call(this, sel);
    for (let e: Element | null = this; e; e = e.parentElement) if (e.matches(sel)) return e;
    return null;
  } as typeof Element.prototype.closest;
}
