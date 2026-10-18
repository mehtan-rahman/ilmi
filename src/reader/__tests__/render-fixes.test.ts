// What the first clipped page showed: an image path with a space is not a
// destination Markdown reads, and `[^1]` is a footnote reference, not a note.
import { describe, expect, it } from 'vitest';
import { inlineRanges } from '../inline.js';
import { editorialRanges } from '../marks.js';

describe('render fixes from the clipped page', () => {
  it('reads an image with an empty alt and a percent-encoded path', () => {
    const r = inlineRanges('![](Spaced%20repetition/img-01.png)');
    expect(r.map((x) => [x.kind, x.href])).toEqual([['image', 'Spaced%20repetition/img-01.png']]);
  });

  it('does not read a bare space in a destination as an image', () => {
    expect(inlineRanges('![](Spaced repetition/img-01.png)').filter((x) => x.kind === 'image')).toEqual([]);
  });

  it('leaves a footnote reference alone and still lights a note', () => {
    expect(editorialRanges('learning.[^1] and [a note] here')).toEqual([{ from: 18, to: 26, kind: 'note' }]);
  });
});
