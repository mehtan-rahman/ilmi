// The PDF lens's pure side: a page's text from pdf.js's items, and finding a
// passage in a text layer again. The lens itself is src/app/Pdf.tsx; the
// pairing on disk is src/vault/pages.ts.

export { findAll, findText, countIn, type Found, type TextPos } from './find.js';
export { linesOf, pageText, documentText, wordCount, type TextBit } from './text.js';
export { refOf, jumpTarget, bibliographyStart, stemShared, type Ref, type Target } from './jump.js';
export { chapterRanges, outlineEntries, type ChapterRange, type OutlineEntry, type OutlinePdf } from './chapters.js';
export { sectionName, equationsIn, boxAround, pageItems, type PageItem } from './name.js';
