// Import: text from a paste, a dropped file, or a fetched page, on its way to
// becoming a frozen source; a list of cards or an Anki package, on its way to
// a deck; a book in EPUB, on its way to a folder of sources. Pure; see
// `Vault.importDoc` and `Vault.importDeck` for the files.

export { cleanText, deriveTitle, titleFromFileName, stats, isUrl, TEXT_EXT, HTML_EXT, type Stats } from './text.js';
export { readable, textOf, type Readable } from './readable.js';
export { clipPage, markdownOf, escapeProse, normalizeWhen, type Clipped, type ClipImage } from './page.js';
export { htmlMarkdown } from './paste.js';
export {
  detect, splitCards, toCards, deckDoc, cardText, reduceCell, ankiHeader, records, chunksOf, droppedLabel, leftoverLines, noDropped,
  SIDE_KINDS, CARD_KINDS, SIDE_LABEL, CARD_LABEL, NOT_CARDS,
  type Delims, type SideDelim, type CardDelim, type SideKind, type CardKind, type Detected, type Split, type Found, type Dropped, type AnkiHeader,
} from './cards.js';
export {
  mapPackage, cardOf, kindOf, seedOf as ankiSeedOf, creationDay, difficultyOf, deckLabel, reviewsOf as ankiReviewsOf, ankiId,
  type AnkiPackage, type AnkiDeck, type AnkiNotetype, type AnkiNote, type AnkiCard, type AnkiDropped, type Mapped, type MappedDeck, type NotetypeKind,
} from './anki.js';
export {
  mapBook, reduceChapter, withoutTitleHeading, position, readingLabel, noBookDropped, MIN_WORDS,
  type Epub, type EpubItem, type Chapter, type BookDropped, type MappedBook, type Reduced,
} from './epub.js';
