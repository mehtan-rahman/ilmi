// A book's notes (milestone 48): the note attached to a document's pages,
// open in the pane beside them (milestone 70, `book.ts`). What the reader
// draws under each section heading that comes back. The chip: `show in
// book` (the pages, opened beside the note if they are not, scroll to its
// boxes and flash them), `show boxes here` (its crops drawn under the
// heading, page breaks marked), and when it is next (`due today`, `back in
// 4d`, `dismissed`).

import { formatBox, parseBoxes, sectionDismissed, type SectionSchedule } from '../format/index.js';
import type { BookOptions } from '../reader/index.js';
import { dayOf, dayStart, whenToDate } from '../schedule/index.js';
import { appNow } from './clock.js';
import { openPagesBeside } from './book.js';
import { useApp } from './store.js';

/** When a section is next, in the chip's words: `due today`, `back in 4d`, `dismissed`. */
export function chipWhen(read: SectionSchedule, now: Date): string {
  if (sectionDismissed(read)) return 'dismissed';
  if (read.due === undefined) return 'due today';
  const d = Math.round((dayStart(dayOf(whenToDate(read.due))).getTime() - dayStart(dayOf(now)).getTime()) / 86400000);
  return d <= 0 ? 'due today' : d === 1 ? 'back tomorrow' : `back in ${d}d`;
}

/** The sections whose crops are drawn in `path`'s notes. */
export const shownIn = (path: string): readonly string[] => useApp.getState().inlineBoxes[path] ?? [];

/** `show boxes here` / `hide boxes` on one section. */
export function toggleShown(path: string, text: string): void {
  useApp.setState((s) => {
    const cur = s.inlineBoxes[path] ?? [];
    const next = cur.includes(text) ? cur.filter((t) => t !== text) : [...cur, text];
    return { inlineBoxes: { ...s.inlineBoxes, [path]: next } };
  });
}

let focusSeq = 0;
/** `show in book` from the note at `path`: its pages, opened beside it if they are not, scroll to the section's boxes and flash them. */
export function showInBook(path: string, text: string): void {
  const pages = openPagesBeside(path);
  if (pages !== null) useApp.setState({ bookFocus: { path: pages, text, seq: ++focusSeq } });
}

function button(label: string, act: string, run: () => void): HTMLButtonElement {
  const b = document.createElement('button');
  b.type = 'button';
  b.className = 'bc-btn';
  b.dataset.act = act;
  b.textContent = label;
  b.addEventListener('mousedown', (e) => { e.preventDefault(); e.stopPropagation(); run(); });
  return b;
}

/** The chips and crops for `path`'s notes. */
export function bookOptions(path: string): BookOptions {
  return {
    chipKey: (read, text) => `${chipWhen(read, appNow())}|${read.boxes ?? ''}|${shownIn(path).includes(text) ? 1 : 0}`,
    shown: (text) => shownIn(path).includes(text),
    chip(read, text) {
      const el = document.createElement('span');
      el.className = 'book-chip';
      el.setAttribute('contenteditable', 'false');
      if (read.boxes !== undefined && parseBoxes(read.boxes)) {
        el.append(
          button('show in book', 'show-in-book', () => showInBook(path, text)),
          button(shownIn(path).includes(text) ? 'hide boxes' : 'show boxes here', 'show-here', () => toggleShown(path, text)),
        );
      }
      const when = document.createElement('span');
      const w = chipWhen(read, appNow());
      when.className = 'bc-when';
      when.dataset.when = w === 'dismissed' ? 'dismissed' : w === 'due today' ? 'due' : 'later';
      when.textContent = w;
      el.append(when);
      return el;
    },
    crops(read, text) {
      const el = document.createElement('div');
      el.className = 'inline-boxes';
      el.setAttribute('contenteditable', 'false');
      el.dataset.for = text;
      const boxes = parseBoxes(read.boxes ?? '') ?? [];
      boxes.forEach((b, i) => {
        if (i > 0 && b.page !== boxes[i - 1]!.page) {
          const br = document.createElement('div');
          br.className = 'pbreak';
          br.textContent = `p. ${b.page}`;
          el.append(br);
        }
        const c = document.createElement('div');
        c.className = 'crop';
        c.dataset.box = formatBox(b);
        c.title = `p. ${b.page}: show in book`;
        c.addEventListener('mousedown', (e) => { e.preventDefault(); showInBook(path, text); });
        el.append(c);
      });
      return el;
    },
  };
}
