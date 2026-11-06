// Ink (milestone 58), the pure side: a page's name among a note's files,
// the line the note gets and where it goes, the drawing an image names,
// and `draw` among the insert menu's rows only where there is a canvas.
// The canvas itself is an iPad's (`ILMI_SMOKE=ink`).

import { afterEach, describe, expect, it } from 'vitest';
import { parse, serialize } from '../../format/index.js';
import { setCanvas, slashItems } from '../../reader/slash.js';
import { inkLine, inkSrc, insertUnder, nextPage, pageOf } from '../ink.js';

afterEach(() => setCanvas(false));

describe('a page of ink in a note', () => {
  it('is named one past the pages there are', () => {
    expect(nextPage([])).toBe('ink-01');
    expect(nextPage(['img-01.png', 'notes.md'])).toBe('ink-01');
    expect(nextPage(['ink-01.pkdrawing', 'ink-01.png'])).toBe('ink-02');
    // a page thrown away leaves its number: the next is past the highest, whichever file is left of it
    expect(nextPage(['ink-01.png', 'ink-07.pkdrawing'])).toBe('ink-08');
    expect(nextPage(['ink-99.png'])).toBe('ink-100');
  });

  it('is written as an image through the directory of the note\'s name', () => {
    expect(inkSrc('library/book/ch-3.md', 'ink-01')).toBe('ch-3/ink-01.png');
    expect(inkLine('fleeting/office hours.md', 'ink-02')).toBe('![working](office%20hours/ink-02.png)');
    // and the drawing is found again from what the note wrote
    expect(pageOf('library/book/ch-3.md', 'ch-3/ink-01.png')).toBe('library/book/ch-3/ink-01.pkdrawing');
    expect(pageOf('fleeting/office hours.md', 'office%20hours/ink-02.png')).toBe('fleeting/office hours/ink-02.pkdrawing');
    expect(pageOf('a.md', 'https://example.com/x.png')).toBeNull();
    expect(pageOf('a.md', 'a/figure.jpg')).toBeNull();
  });

  it('goes under the section\'s heading, after what the section holds', () => {
    const { doc } = parse('# ch\n\n## one\n\nfirst\n\na :: b\n\n### deeper\n\ninside\n\n## two\n\nsecond\n');
    insertUnder(doc, { nth: 1, text: 'one' }, '![working](ch/ink-01.png)');
    expect(serialize(doc)).toBe('# ch\n\n## one\n\nfirst\n\na :: b\n\n### deeper\n\ninside\n\n![working](ch/ink-01.png)\n\n## two\n\nsecond\n');
    // the last section, and a page with no heading above the caret: at the end
    insertUnder(doc, { nth: 3, text: 'two' }, '![working](ch/ink-02.png)');
    insertUnder(doc, null, '![working](ch/ink-03.png)');
    expect(serialize(doc).endsWith('second\n\n![working](ch/ink-02.png)\n\n![working](ch/ink-03.png)\n')).toBe(true);
    // what is written reads back as it was written
    expect(serialize(parse(serialize(doc)).doc)).toBe(serialize(doc));
  });
});

describe('draw in the insert menu', () => {
  it('is a row only where there is a canvas', () => {
    expect(slashItems('', 'paragraph').some((i) => i.id === 'draw')).toBe(false);
    expect(slashItems('draw', 'paragraph')).toEqual([]);
    setCanvas(true);
    expect(slashItems('draw', 'paragraph')[0]?.id).toBe('draw');
    expect(slashItems('ink', 'heading')[0]?.id).toBe('draw');
    // after `image`, where a picture goes in
    const ids = slashItems('', 'paragraph').map((i) => i.id);
    expect(ids.indexOf('draw')).toBe(ids.indexOf('image') + 1);
  });
});
