// The pure side of a selection's context: the sentence around a selected
// span of a block's text, else its line, else the selection itself. Used by
// the reader and the PDF lens when they hand a selection to a plugin.

/** Sentence ends: Latin, Arabic, and Urdu stops, and a newline. */
const END = /[.!?؟۔\n]/;

/**
 * The sentence of `text` that holds `sel`: from the sentence end before it
 * to the one after it, trimmed. When `sel` is not in `text`, or `text` is
 * empty, the result is `sel` itself. A selection spanning sentences gets
 * them all.
 */
export function contextOf(text: string, sel: string): string {
  const needle = sel.trim();
  if (!needle) return '';
  const at = text.indexOf(needle);
  if (at < 0) return needle;
  let start = at;
  while (start > 0 && !END.test(text[start - 1]!)) start--;
  let end = at + needle.length;
  while (end < text.length && !END.test(text[end]!)) end++;
  if (end < text.length && text[end] !== '\n') end++;
  return text.slice(start, end).trim() || needle;
}

/** Parsed `key` of a command or action: `h`, `shift+h`, `mod+shift+h`, `alt+h`. */
export interface KeySpec {
  key: string;
  mod: boolean;
  shift: boolean;
  alt: boolean;
}

export function parseKey(spec: string): KeySpec | null {
  const parts = spec.toLowerCase().split('+').map((s) => s.trim()).filter(Boolean);
  const key = parts.pop();
  if (!key) return null;
  const out: KeySpec = { key, mod: false, shift: false, alt: false };
  for (const p of parts) {
    if (p === 'mod' || p === 'cmd' || p === 'ctrl' || p === 'meta') out.mod = true;
    else if (p === 'shift') out.shift = true;
    else if (p === 'alt' || p === 'option') out.alt = true;
    else return null;
  }
  return out;
}

/** True when a keyboard event is the key `spec` names. */
export function keyMatches(spec: KeySpec, e: { key: string; metaKey: boolean; ctrlKey: boolean; shiftKey: boolean; altKey: boolean }): boolean {
  const key = e.key.toLowerCase();
  return (key === spec.key || (spec.key === 'space' && key === ' ')) && (e.metaKey || e.ctrlKey) === spec.mod && e.shiftKey === spec.shift && e.altKey === spec.alt;
}
