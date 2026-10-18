// The PDF lens's pure side: a page's text from pdf.js's items, and finding a
// passage in a text layer again. The lens itself is src/app/Pdf.tsx; the
// pairing on disk is src/vault/pages.ts.

export { findAll, findText, countIn, type Found, type TextPos } from './find.js';
export { linesOf, pageText, documentText, wordCount, type TextBit } from './text.js';
