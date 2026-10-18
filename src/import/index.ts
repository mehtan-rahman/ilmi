// Import: text from a paste, a dropped file, or a fetched page, on its way to
// becoming a frozen source. Pure; see `Vault.importDoc` for the file.

export { cleanText, deriveTitle, titleFromFileName, stats, isUrl, TEXT_EXT, HTML_EXT, type Stats } from './text.js';
export { readable, textOf, type Readable } from './readable.js';
export {
  detect, splitCards, toCards, deckDoc, cardText, reduceCell, ankiHeader, records, chunksOf, droppedLabel, leftoverLines, noDropped,
  SIDE_KINDS, CARD_KINDS, SIDE_LABEL, CARD_LABEL, NOT_CARDS,
  type Delims, type SideDelim, type CardDelim, type SideKind, type CardKind, type Detected, type Split, type Found, type Dropped, type AnkiHeader,
} from './cards.js';
