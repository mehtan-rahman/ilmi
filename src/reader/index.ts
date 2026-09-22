// The reader's document model: a ProseMirror schema over the format's
// blocks, conversion both ways, and the editor's plugins. No DOM here
// beyond what prosemirror-view's decorations need; the view is in src/app.

export { schema } from './schema.js';
export { toDoc, fromDoc, textOf, inline, mathSplit, blocksEqual, cardDue, type MathPart } from './convert.js';
export { editorialRanges, type MarkRange } from './marks.js';
export { proseIndices, cursorIndex, pickPos, setReadPos, isProse, type Band } from './marker.js';
export { makeState, markerKey, markerPos, cardsKey, editMath, frozenPlugin, type StateOptions } from './plugins.js';
export { cardText, passage, blockAt, insertCard, setCardText, type CardSpec, type Passage } from './cards.js';
