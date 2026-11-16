// The PDF lens's pure side: a page's text from pdf.js's items, and finding a
// passage in a text layer again. The lens itself is src/app/Pdf.tsx; the
// pairing on disk is src/vault/pages.ts.

export { findAll, findText, countIn, type Found, type TextPos } from './find.js';
export { linesOf, pageText, documentText, wordCount, type TextBit } from './text.js';
export { refOf, jumpTarget, seekTarget, bibliographyStart, stemShared, type Ref, type Target } from './jump.js';
export { chapterRanges, outlineEntries, type ChapterRange, type OutlineEntry, type OutlinePdf } from './chapters.js';
export { sectionName, headingAbove, equationsIn, boxAround, pageItems, type PageItem } from './name.js';
export { emptyTrail, pushPlace, stepBack, stepForward, hintLabels, hintStep, lookupUrl, HINT_KEYS, TRAIL_MAX, type Place, type Trail } from './around.js';
export { pageLinks, flipRect, linkAt, resolveDest, downPage, actionPage, flatOutline, contentsWithin, contentsHere, type PageLink, type Dest, type DestPdf, type ContentsEntry, type ContentsPdf } from './links.js';
export { textBoxes, referenceTokens, referenceAt, tokenAt, type TextBox, type RefToken } from './refs.js';
export { placeOf, newMarkId, letterId, isCollectionMark, bookmarksOf, highlightsOf, portalsOf, lettersOf, collectionMark, collectionMarks, lineQuads, highlightAt, highlightHolding, quadBoxes, highlightOf, portalAbove, lineBands, bandNear, stepLine, type LineBand } from './marks.js';
