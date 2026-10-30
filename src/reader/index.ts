// The reader's document model: a ProseMirror schema over the format's
// blocks, conversion both ways, and the editor's plugins. No DOM here
// beyond what prosemirror-view's decorations need; the view is in src/app.

export { schema, langOf, indentWidth } from './schema.js';
export { rawToNode, nodeToRaw, isRawNode, itemLines, markerNumber, numbered, nextMarker, tableOf } from './raw.js';
export { toDoc, fromDoc, textOf, inline, mathSplit, blocksEqual, cardDue, type MathPart } from './convert.js';
export { editorialRanges, type MarkRange } from './marks.js';
export { proseIndices, cursorIndex, pickPos, setReadPos, isProse, type Band } from './marker.js';
export {
  makeState, codeDecorations, codeKey, directionDecorations, directionKey, markerKey, markerPos, cardsKey, frozenPlugin, frozenKey, imagesKey, mathEditKey, isMathEdit, openMath, revealKey, revealBackward, revealForward,
  FORMAT_KEYS, pasteInto, type Edge, type StateOptions, type ImageLoader, type ImageState, type ImagesMeta,
} from './plugins.js';
export {
  continueBlock, leaveBlock, joinBlock, joinIntoList, indentBlock, outdentBlock, moveItem, toggleTask, toggleTasks, renumberList,
  subtreeEnd, prevSibling, nextSibling, parentItem, runAt, runNodes, insertCardItem, entryParts, type ListRun, type RunEntry,
} from './lists.js';
export {
  toggleInline, setHeading, toggleList, toggleQuote, linkTarget, setLink, pasteLink, fenceRule, displayMathRule, flatText, pressed,
  type InlineToggle, type ListKind, type LinkTarget, type KeySpec,
} from './commands.js';
export { inlineRanges, markerRanges, flatRanges, imageOnly, literalSpans, type InlineRange, type InlineKind } from './inline.js';
export { classifyRaw, splitBlocks, readTable, writeTable, cellLines, CELL_BR, type RawShape, type Align, type TableBlock } from './blocks.js';
export { CODE_LANGS, codeLang, codeTokens, codeHTML, tokensOfHtml, withLang, setCodeLang, type CodeToken } from './highlight.js';
export { foldKey, foldPlugin, foldedKeys, foldsHiding, isFoldedAway, ruleEndIndex, sections, allSections, itemSections, type FoldMeta, type FoldState, type Section } from './fold.js';
export { cellAt, cellStart, nextCell, prevCell, cellDown, cellBreak, rowBelow, addRow, addColumn, deleteRow, deleteColumn, alignColumn, tableKey, tablePlugin, type CellAt } from './table.js';
export { cardText, passage, blockAt, insertCard, setCardText, type CardSpec, type Passage } from './cards.js';
export { SLASH_ITEMS, slashItems, slashContext, slashKey, slashPlugin, pickSlash, litItem, opensAt, askImageKey, TABLE_SKELETON, type SlashItem, type SlashState, type SlashMeta, type SlashContext } from './slash.js';
export { findKey, findPlugin, findMatches, findIn, foldText, foldMap, currentMatch, replaceMatch, replaceAll, closeAtMatch, atomFind, markFinds, type AtomFind, type FindState, type FindMeta, type Match } from './find.js';
export { insertBlocks, insertImages, imageParagraph, caretInto, markdownBlocks, pasteMarkdown, clipboardText, htmlPasteImages } from './insert.js';
export { strongDir, textDir, blockDirs, dirAttr, charDir, isolatedSpans, markupSpans, marksOnly, baseSplit, withBases, type Dir, type Span, type BasedSeg, type BasedBlank } from './direction.js';
