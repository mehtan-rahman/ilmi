// The in-memory shape of one vault file. See FORMAT.md.
//
// Optional properties are absent, never explicitly undefined, so that two docs
// compare equal with a plain deep-equal.

export type NodeType = 'note' | 'source' | 'deck' | 'draft' | 'extract';
export type CardForm = 'cloze' | 'qa' | 'bidir';
export type SrState = 'new' | 'learning' | 'review' | 'relearning';

/** Unknown attributes, kept in original order. */
export type Extra = [string, string][];

/** One `<!-- sr … -->` line. Maps onto a ts-fsrs Card (FORMAT.md §6.2). */
export interface CardSchedule {
  due?: string;
  state?: SrState;
  stability?: number;
  difficulty?: number;
  reps?: number;
  lapses?: number;
  steps?: number;
  ivl?: number;
  last?: string;
  grade?: number;
  /** The card's own priority, overriding the document's. Only on the bare line. */
  pri?: number;
  /** `sus=1`: left out of the queue, the session, and the counts; the schedule is kept. */
  suspended?: true;
  extra?: Extra;
}

/** The `read:` front-matter field. */
export interface ReadSchedule {
  due?: string;
  ivl?: number;
  reps?: number;
  pos?: number;
  /** On an extract carved from a page of its parent's PDF: that page, from 1. */
  page?: number;
  /** Growth per pass, ≥ 1.1; absent means `READ_AF`. */
  af?: number;
  /** Read as a fallback when the document has no `pri` field; dropped once it has one. */
  pri?: number;
  extra?: Extra;
}

/** The `write:` front-matter field. */
export interface WriteSchedule {
  due?: string;
  ivl?: number;
  reps?: number;
  /** Growth per pass, ≥ 1.1; absent means `WRITE_AF`. */
  af?: number;
  /** As on `read`. */
  pri?: number;
  done?: boolean;
  extra?: Extra;
}

export interface Heading {
  kind: 'heading';
  level: number;
  text: string;
  setext?: true;
}

export interface Paragraph {
  kind: 'paragraph';
  text: string;
  id?: string;
  extracts?: string[];
}

export interface Card {
  kind: 'card';
  /** Verbatim paragraph text, without the trailing `^id`. */
  text: string;
  id?: string;
  /** The bare `<!-- sr -->` line. */
  sched?: CardSchedule;
  /**
   * `<!-- sr r -->`: a both-ways card's back-to-front direction, scheduled
   * apart from the front-to-back one, which is the bare line (FORMAT.md §6.2).
   */
  reverse?: CardSchedule;
  /** `<!-- sr cN -->` lines, keyed by group number. */
  blanks?: Record<number, CardSchedule>;
  extracts?: string[];
  /**
   * A card that is a list item (FORMAT.md §5.2): the item's first-line
   * prefix as written, its indentation, marker, and the spaces after it
   * (`- `, `  1. `). `text` is the item's text without it, continuation
   * lines without the content column's spaces.
   */
  item?: string;
  /** Written directly under the block before, no blank line: a piece of the same list (§5.2). */
  joined?: true;
}

export interface Raw {
  kind: 'raw';
  text: string;
  /** As on `Card`: the rest of a list a card item split, written directly under it. */
  joined?: true;
}

export type Block = Heading | Paragraph | Card | Raw;

export type Field =
  | { key: 'type'; value: NodeType }
  | { key: 'title'; value: string }
  | { key: 'frozen'; value: boolean }
  | { key: 'imported'; value: string }
  | { key: 'started'; value: string }
  | { key: 'read'; value: ReadSchedule }
  | { key: 'write'; value: WriteSchedule }
  | { key: 'default-card'; value: CardForm }
  | { key: 'pri'; value: number }
  /** The document's pages: a PDF file, relative to the document. */
  | { key: 'pdf'; value: string }
  /** A clipped page's address. */
  | { key: 'url'; value: string }
  /** Who wrote the clipped page. */
  | { key: 'author'; value: string }
  /** When the clipped page was published: a day or a UTC instant. */
  | { key: 'published'; value: string }
  /** The document's children shown as tabs in a rail beside its page. */
  | { key: 'tabs'; value: boolean }
  /** Study options (§3, *options*): inherited by everything under the document unless set lower. */
  | { key: 'new-per-day'; value: number }
  | { key: 'reviews-per-day'; value: number }
  | { key: 'retention'; value: number }
  | { key: 'leech'; value: number }
  | { key: 'leech-action'; value: LeechAction };

/** What a card does when its lapses reach the leech threshold: suspended, or only marked a leech. */
export type LeechAction = 'suspend' | 'tag';

export type FieldKey = Field['key'];

/** A front-matter line the app does not interpret. */
export interface RawLine {
  raw: string;
}

export type FmEntry = Field | RawLine;

export interface Frontmatter {
  entries: FmEntry[];
}

export interface Doc {
  frontmatter?: Frontmatter;
  blocks: Block[];
}

export interface Diagnostic {
  /** 1-based line in the source text. */
  line: number;
  message: string;
}

export const FIELD_KEYS: readonly FieldKey[] = [
  'type', 'title', 'frozen', 'imported', 'started', 'read', 'write', 'default-card', 'pri', 'pdf', 'url', 'author', 'published', 'tabs',
  'new-per-day', 'reviews-per-day', 'retention', 'leech', 'leech-action',
];

export function isField(e: FmEntry): e is Field {
  return 'key' in e;
}
