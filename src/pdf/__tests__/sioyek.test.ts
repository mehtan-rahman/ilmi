// Getting around a book (milestone 76): the trail of places, the hints'
// letters, the PDF's links and outline, a reference under a point. The
// reference is tried on the sample chapter's own text (`design/books/ch3.pdf`,
// read by pdf.js) and on made-up items.

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';
import { describe, expect, it } from 'vitest';
import {
  HINT_KEYS, TRAIL_MAX, actionPage, contentsHere, contentsWithin, downPage, emptyTrail, flatOutline, flipRect, hintLabels, hintStep, jumpTarget, linkAt, lookupUrl,
  pageLinks, pushPlace, refOf, referenceAt, referenceTokens, resolveDest, seekTarget, stepBack, stepForward, textBoxes, type ContentsEntry, type Place, type TextBox,
} from '../index.js';

const at = (page: number, y = 0, x: number | null = null): Place => ({ page, y, x });

describe('back and forth', () => {
  it('a jump is somewhere to go back to; back leaves somewhere to go forward to', () => {
    let t = emptyTrail();
    expect(stepBack(t, at(1))).toBeNull();
    t = pushPlace(t, at(1, 0.2));
    t = pushPlace(t, at(7, 0.5));
    expect(t.back).toEqual([at(1, 0.2), at(7, 0.5)]);
    const b = stepBack(t, at(12, 0.1))!;
    expect(b.to).toEqual(at(7, 0.5));
    expect(b.trail).toEqual({ back: [at(1, 0.2)], forward: [at(12, 0.1)] });
    const f = stepForward(b.trail, at(7, 0.5))!;
    expect(f.to).toEqual(at(12, 0.1));
    expect(f.trail).toEqual({ back: [at(1, 0.2), at(7, 0.5)], forward: [] });
    expect(stepForward(f.trail, at(12))).toBeNull();
  });

  it('going back from a place scrolled to by hand comes forward to that place, and the forward list stays until a jump', () => {
    let t = pushPlace(pushPlace(emptyTrail(), at(1)), at(5));
    const b1 = stepBack(t, at(9))!;
    // scrolled on by hand to page 6, then back again: forward holds both, nearest last
    const b2 = stepBack(b1.trail, at(6, 0.3))!;
    expect(b2.to).toEqual(at(1));
    expect(b2.trail.forward).toEqual([at(9), at(6, 0.3)]);
    expect(stepForward(b2.trail, at(1))!.to).toEqual(at(6, 0.3));
    // a new jump: nothing to go forward to
    t = pushPlace(b2.trail, at(1));
    expect(t.forward).toEqual([]);
    expect(t.back).toEqual([at(1)]);
  });

  it('keeps the place exact, the same place twice once, and no more than its length', () => {
    let t = pushPlace(emptyTrail(), at(3, 0.4321, 0.25));
    t = pushPlace(t, at(3, 0.4321, 0.25));
    expect(t.back).toEqual([at(3, 0.4321, 0.25)]);
    for (let i = 0; i < TRAIL_MAX + 20; i++) t = pushPlace(t, at(i + 10));
    expect(t.back).toHaveLength(TRAIL_MAX);
    expect(t.back[t.back.length - 1]).toEqual(at(TRAIL_MAX + 29));
  });
});

describe('the hints\' letters', () => {
  it('one letter each while there are letters, the home row first', () => {
    expect(hintLabels(0)).toEqual([]);
    expect(hintLabels(4)).toEqual(['a', 's', 'd', 'f']);
    expect(hintLabels(26).join('')).toBe(HINT_KEYS);
    expect(new Set(HINT_KEYS).size).toBe(26);
  });

  it('two letters each past 26, every label of a length and no two the same', () => {
    const l = hintLabels(27);
    expect(l.every((s) => s.length === 2)).toBe(true);
    expect(l.slice(0, 3)).toEqual(['aa', 'as', 'ad']);
    expect(l[26]).toBe('sa');
    const many = hintLabels(700);
    expect(many.every((s) => s.length === 3)).toBe(true);
    expect(new Set(many).size).toBe(700);
    expect(new Set(hintLabels(676)).size).toBe(676);
    expect(hintLabels(676)[0]).toHaveLength(2);
  });

  it('the letters typed narrow to one, whatever their case, or to none', () => {
    const l = hintLabels(30);
    expect(hintStep(l, 'a')).toEqual({ left: l.map((_, i) => i).filter((i) => l[i]!.startsWith('a')) });
    expect(hintStep(l, 'aS')).toEqual({ hit: 1 });
    expect(hintStep(l, 'x')).toBeNull();
    expect(hintStep(hintLabels(3), 'd')).toEqual({ hit: 2 });
    expect(hintStep(hintLabels(3), 'f')).toBeNull();
  });
});

describe('look it up', () => {
  it('the selection, its spaces one each, encoded into the address', () => {
    expect(lookupUrl('web', 'canonical  ensemble\n& heat')).toBe('https://duckduckgo.com/?q=canonical%20ensemble%20%26%20heat');
    expect(lookupUrl('scholar', 'Z = Σ e^{-βE}')).toBe(`https://scholar.google.com/scholar?q=${encodeURIComponent('Z = Σ e^{-βE}')}`);
  });
});

describe('the PDF\'s own links', () => {
  const view = [0, 0, 600, 800];
  const annots = [
    { subtype: 'Link', rect: [60, 700, 180, 720], dest: 'eq.3.12' },
    { subtype: 'Link', rect: [300, 400, 420, 412], url: 'https://example.org/paper' },
    { subtype: 'Link', rect: [10, 10, 30, 20], action: 'NextPage' },
    { subtype: 'Link', rect: [10, 40, 30, 50], url: 'javascript:alert(1)' },
    { subtype: 'Link', rect: [10, 60, 10, 60], dest: 'nowhere' },
    { subtype: 'Text', rect: [0, 0, 20, 20] },
    { subtype: 'Link', rect: [70, 702, 100, 716], dest: [{ num: 9, gen: 0 }, { name: 'XYZ' }, 0, 500, null] },
  ];

  it('are hit areas in fractions of the page from its top left; only what can be followed', () => {
    const links = pageLinks(annots, flipRect(view), 600, 800);
    expect(links).toHaveLength(4);
    expect(links[0]).toEqual({ x: 0.1, y: 0.1, w: 0.2, h: 0.025, dest: 'eq.3.12' });
    expect(links[1]!.url).toBe('https://example.org/paper');
    expect(links[1]!.y).toBeCloseTo(1 - 412 / 800);
    expect(links[2]!.action).toBe('NextPage');
  });

  it('the link under a point is the smallest there', () => {
    const links = pageLinks(annots, flipRect(view), 600, 800);
    expect(linkAt(links, 0.25, 0.11)!.dest).toBe('eq.3.12');
    expect(Array.isArray(linkAt(links, 0.14, 0.11)!.dest)).toBe(true);
    expect(linkAt(links, 0.5, 0.9)).toBeNull();
  });

  const pdf = {
    getDestination: async (id: string) => (id === 'eq.3.12' ? [{ num: 4, gen: 0 }, { name: 'XYZ' }, 72, 600, null] : id === 'ch2' ? [{ num: 7, gen: 0 }, { name: 'Fit' }] : null),
    getPageIndex: async (ref: { num: number }) => ref.num,
  };

  it('a destination is a page and a height on it', async () => {
    expect(await resolveDest(pdf as never, 'eq.3.12')).toEqual({ page: 5, top: 600 });
    expect(await resolveDest(pdf as never, 'ch2')).toEqual({ page: 8, top: null });
    expect(await resolveDest(pdf as never, [2, { name: 'FitH' }, 300])).toEqual({ page: 3, top: 300 });
    expect(await resolveDest(pdf as never, [{ num: 1 }, { name: 'FitR' }, 0, 100, 200, 450])).toEqual({ page: 2, top: 450 });
    expect(await resolveDest(pdf as never, 'gone')).toBeNull();
    expect(await resolveDest(pdf as never, undefined)).toBeNull();
    expect(downPage(600, 800)).toBeCloseTo(0.25);
    expect(downPage(null, 800)).toBe(0);
    expect(downPage(900, 800)).toBe(0);
  });

  it('a named action steps pages inside the book\'s own', () => {
    expect(actionPage('NextPage', 28, 23, 28)).toBe(28);
    expect(actionPage('PrevPage', 25, 23, 28)).toBe(24);
    expect(actionPage('FirstPage', 25, 23, 28)).toBe(23);
    expect(actionPage('LastPage', 25, 23, 28)).toBe(28);
    expect(actionPage('GoBack', 25, 23, 28)).toBeNull();
  });
});

describe('the contents', () => {
  const outline = [
    { title: '1  Heat', dest: [0, { name: 'XYZ' }, 0, 800, null], items: [
      { title: '1.1 Work', dest: [0, { name: 'XYZ' }, 0, 400, null], items: [] },
      { title: '1.2 Entropy', dest: [1, { name: 'Fit' }], items: [{ title: 'A note', dest: [1, { name: 'XYZ' }, 0, 200, null] }] },
    ] },
    { title: 'Broken', dest: 'gone', items: [{ title: 'Kept child', dest: [2, { name: 'Fit' }] }] },
    { title: '2 The canonical ensemble', dest: [3, { name: 'XYZ' }, 0, 800, null] },
  ];
  const pdf = { getOutline: async () => outline, getDestination: async () => null, getPageIndex: async () => 0 };
  const flat = () => flatOutline(pdf as never, () => 800);

  it('is the outline flattened, each entry with its depth and its place', async () => {
    expect(await flat()).toEqual<ContentsEntry[]>([
      { title: '1 Heat', depth: 0, page: 1, y: 0 },
      { title: '1.1 Work', depth: 1, page: 1, y: 0.5 },
      { title: '1.2 Entropy', depth: 1, page: 2, y: 0 },
      { title: 'A note', depth: 2, page: 2, y: 0.75 },
      { title: 'Kept child', depth: 1, page: 3, y: 0 },
      { title: '2 The canonical ensemble', depth: 0, page: 4, y: 0 },
    ]);
    expect(await flatOutline({ ...pdf, getOutline: async () => null } as never, () => 800)).toEqual([]);
  });

  it('on a chapter only the entries inside its pages, the shallowest at the margin', async () => {
    expect(contentsWithin(await flat(), 2, 3)).toEqual([
      { title: '1.2 Entropy', depth: 0, page: 2, y: 0 },
      { title: 'A note', depth: 1, page: 2, y: 0.75 },
      { title: 'Kept child', depth: 0, page: 3, y: 0 },
    ]);
    expect(contentsWithin(await flat(), 9, 12)).toEqual([]);
  });

  it('the entry that holds a place is the last that starts at or before it', async () => {
    const e = await flat();
    expect(contentsHere(e, 1, 0.1)).toBe(0);
    expect(contentsHere(e, 1, 0.6)).toBe(1);
    expect(contentsHere(e, 2, 0.5)).toBe(2);
    expect(contentsHere(e, 2, 0.9)).toBe(3);
    expect(contentsHere(e, 9, 0)).toBe(5);
    expect(contentsHere(contentsWithin(e, 2, 3), 1, 0.5)).toBe(-1);
    // gone to, an entry lies a line under the top of the view: it is the one held
    expect(contentsHere(e, 1, 0.48)).toBe(1);
  });
});

// ── a reference under a point ──

/** Items on a 600 × 800 page: each `[str, x, baseline]`, 10pt, half a point a character. */
const items = (rows: [string, number, number][]) => rows.map(([str, x, y]) => ({ str, transform: [10, 0, 0, 10, x, y], width: str.length * 5, height: 10 }));
const boxes = (rows: [string, number, number][]): TextBox[] => textBoxes(items(rows), 600, 800);
const texts = (rows: [string, number, number][]) => referenceTokens(boxes(rows)).map((t) => t.text);

describe('a reference under a point', () => {
  it('reads an item\'s box from pdf.js\'s transform, from the page\'s top left', () => {
    const [b] = boxes([['as (3.12) shows', 60, 700]]);
    expect(b).toEqual({ s: 'as (3.12) shows', x: 0.1, y: (800 - 700 - 10) / 800, w: 75 / 600, h: 10 / 800, em: 10 / 600 });
    expect(textBoxes([{ str: '  ', transform: [1, 0, 0, 1, 0, 0] }, { nothing: 1 }], 600, 800)).toEqual([]);
  });

  it('finds every kind the lens follows, inside one item', () => {
    expect(texts([['By (3.12), Fig. 4, Figure 4, Table 2, Theorem 2, Lemma 3, Section 3.2, §3.2, [17] and Eq. 5 it holds.', 60, 700]]))
      .toEqual(['(3.12)', 'Fig. 4', 'Figure 4', 'Table 2', 'Theorem 2', 'Lemma 3', 'Section 3.2', '§3.2', '[17]', '(5)']);
  });

  it('each is something `refOf` reads', () => {
    for (const t of texts([['By (3.12), Fig. 4, Figure 4, Table 2, Theorem 2, Lemma 3, Section 3.2, §3.2, [17], [3, 5] and Eq. 5 it holds.', 60, 700]])) expect(refOf(t), t).not.toBeNull();
    expect(refOf('Section 3.2')).toEqual({ kind: 'section', n: '3.2' });
    expect(refOf('§3.2')).toEqual({ kind: 'section', n: '3.2' });
    expect(refOf('Chapter 3')).toEqual({ kind: 'section', n: '3' });
    expect(refOf('Theorem 2')).toEqual({ kind: 'figure', type: 'Theorem', n: '2' });
  });

  it('the token under the point, by its share of the item; none beside it', () => {
    // `as (3.12) shows`: the bracket runs from character 3 to 9 of 15, 5pt each from x = 60
    const b = boxes([['as (3.12) shows', 60, 700]]);
    const y = (800 - 705) / 800;
    const t = referenceAt(b, 90 / 600, y)!;
    expect(t.text).toBe('(3.12)');
    expect(t.x).toBeCloseTo(75 / 600);
    expect(t.w).toBeCloseTo(30 / 600);
    expect(t.y).toBeCloseTo(90 / 800);
    expect(referenceAt(b, 65 / 600, y)).toBeNull();
    expect(referenceAt(b, 125 / 600, y)).toBeNull();
    expect(referenceAt(b, 90 / 600, 0.5)).toBeNull();
  });

  it('a reference split over items is one token, its box around both', () => {
    const b = boxes([['see Fig.', 60, 700], ['4', 104, 700], ['and', 114, 700]]);
    const [t] = referenceTokens(b);
    expect(t!.text).toBe('Fig. 4');
    expect(t!.x).toBeCloseTo(80 / 600);
    expect(t!.x + t!.w).toBeCloseTo(109 / 600);
    expect(referenceAt(b, 106 / 600, 95 / 800)!.text).toBe('Fig. 4');
  });

  it('a caption, a heading, an equation\'s own number and a bibliography\'s entry are not references', () => {
    expect(texts([['Figure 4: The partition function', 60, 700]])).toEqual([]);
    expect(texts([['Figure 3.2', 60, 700], ['Heat capacity of a two-level system', 120, 700]])).toEqual([]);
    expect(texts([['Figure 3.2 shows the bump', 60, 700]])).toEqual(['Figure 3.2']);
    expect(texts([['Theorem 2.', 60, 700], ['Let Z be finite.', 120, 700]])).toEqual([]);
    expect(texts([['Chapter 3', 60, 700]])).toEqual([]);
    expect(texts([['S = k ln W', 200, 600], ['(3.12)', 500, 600]])).toEqual([]);
    expect(texts([['(3.12)', 500, 600]])).toEqual([]);
    expect(texts([['[17] Gibbs, J. W. Elementary principles', 60, 500]])).toEqual([]);
    // the same words inside a sentence are
    expect(texts([['as Figure 4 shows, by (3.12).', 60, 700]])).toEqual(['Figure 4', '(3.12)']);
    expect(texts([['and so we recover (3.12)', 60, 700]])).toEqual(['(3.12)']);
  });

  it('a year, an argument, a longer number are left alone', () => {
    expect(texts([['Gibbs (1902) wrote f(2) and x(3); see page 4 and item 3.', 60, 700]])).toEqual([]);
    expect(texts([['in (see Eq. 5) and Eqs. (7)', 60, 700]])).toEqual(['(5)', '(7)']);
    expect(texts([['Sections 3.2.1 and Fig. 12', 60, 700]])).toEqual(['Sections 3.2.1', 'Fig. 12']);
  });

  it('a section\'s heading is found, not its line in the contents nor a sentence that opens with its number', async () => {
    const pages = [
      ['Contents', '3.2 The partition function 45', '3.3 Heat 51'],
      ['3 particles are enough. See Section 3.2.'],
      ['3.2 The partition function', 'The sum over states.', 'Section 3.2 shows it'],
      ['3.2.1 A special case', '3.25 is a number'],
    ];
    expect(jumpTarget(pages, { kind: 'section', n: '3.2' }, 2)).toEqual({ page: 3, line: 0 });
    expect(jumpTarget(pages, { kind: 'section', n: '3' }, 4)).toBeNull();
    expect(jumpTarget([['Chapter 3'], ['see Chapter 3']], { kind: 'section', n: '3' }, 2)).toEqual({ page: 1, line: 0 });
    const read: number[] = [];
    expect(await seekTarget(4, async (p) => { read.push(p); return pages[p - 1]!; }, { kind: 'section', n: '3.2' }, 2)).toEqual({ page: 3, line: 0 });
    expect(read.sort()).toEqual([1, 2, 3]);
  });
});

describe('on the sample chapter\'s own text', () => {
  const BOOKS = join(import.meta.dirname, '../../../design/books');
  const load = async (file: string) => {
    const doc = await getDocument({ data: new Uint8Array(readFileSync(join(BOOKS, file))), verbosity: 0 }).promise;
    const pages: TextBox[][] = [];
    for (let n = 1; n <= doc.numPages; n++) {
      const page = await doc.getPage(n);
      const v = page.getViewport({ scale: 1 });
      pages.push(textBoxes((await page.getTextContent()).items, v.width, v.height));
    }
    return pages;
  };

  it('every reference found reads as one, lies on the page, and is the one under its own middle', async () => {
    const pages = await load('ch3.pdf');
    const all = pages.flatMap((b) => referenceTokens(b));
    expect(all.length).toBeGreaterThan(0);
    for (const b of pages) {
      for (const t of referenceTokens(b)) {
        expect(refOf(t.text), t.text).not.toBeNull();
        expect(t.x).toBeGreaterThanOrEqual(0);
        expect(t.x + t.w).toBeLessThanOrEqual(1);
        expect(t.y).toBeGreaterThanOrEqual(0);
        expect(t.y + t.h).toBeLessThanOrEqual(1);
        expect(referenceAt(b, t.x + t.w / 2, t.y + t.h / 2)!.text).toBe(t.text);
      }
    }
    // the chapter's one reference is to its figure: the caption itself and the equations' own numbers are not references
    expect(pages.map((b) => referenceTokens(b).map((t) => t.text))).toEqual([[], [], ['Fig. 3.2'], []]);
  });
});
