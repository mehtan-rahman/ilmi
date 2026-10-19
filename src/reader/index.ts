// The reader's document model: a ProseMirror schema over the format's
// blocks, conversion both ways, and the editor's plugins. No DOM here
// beyond what prosemirror-view's decorations need; the view is in src/app.

export { schema } from './schema.js';
export { toDoc, fromDoc, textOf, inline, mathSplit, blocksEqual, cardDue, type MathPart } from './convert.js';
export { editorialRanges, type MarkRange } from './marks.js';
export { proseIndices, cursorIndex, pickPos, setReadPos, isProse, type Band } from './marker.js';
export { makeState, markerKey, markerPos, cardsKey, frozenPlugin, frozenKey, imagesKey, mathEditKey, isMathEdit, openMath, revealKey, revealBackward, revealForward, type Edge, type StateOptions, type ImageLoader, type ImageState, type ImagesMeta } from './plugins.js';
export { inlineRanges, markerRanges, flatRanges, imageOnly, literalSpans, type InlineRange, type InlineKind } from './inline.js';
export { classifyRaw, splitBlocks, type RawShape, type Align } from './blocks.js';
export { cardText, passage, blockAt, insertCard, setCardText, type CardSpec, type Passage } from './cards.js';
