// Editorial marks: `[a note]` and `#TODO:` written inline, highlighted where
// they stand and never touched. FORMAT.md §4 leaves them literal; the reader
// only decorates them.

export interface MarkRange {
  from: number;
  to: number;
  kind: 'note' | 'tag';
}

const MARK = /\[[^\]\n]*\]|#[A-Za-z][\w-]*:?/g;

export function editorialRanges(text: string): MarkRange[] {
  const out: MarkRange[] = [];
  for (const m of text.matchAll(MARK)) {
    out.push({ from: m.index, to: m.index + m[0].length, kind: m[0].startsWith('#') ? 'tag' : 'note' });
  }
  return out;
}
