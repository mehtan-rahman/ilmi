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
  /**
   * `seen=<instant>`: the card came up answered, to learn, and was got (`got it`), then; it has not been tested.
   * Only on a line with no review: the first grade drops it. Such a card is still new, due now, and is asked
   * as a test, not shown to learn again (FORMAT.md §6.2).
   */
  seen?: string;
  /**
   * `link=<id>`: the card with that `^id` tests the same fact; the two share
   * one schedule, one shown a day (FORMAT.md §6.2, *links*). Only on the bare line.
   */
  link?: string;
  extra?: Extra;
}

/** The `read:` front-matter field. */
export interface ReadSchedule {
  due?: string;
  ivl?: number;
  reps?: number;
  pos?: number;
  /** On a document with pages: how far down page `pos` the read point is, 0–1 (three decimals); absent means its foot. */
  y?: number;
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

/**
 * The `<!-- read … -->` line under a heading (FORMAT.md §6.5): the section,
 * the heading and everything under it to the next heading of its level or
 * higher, comes back on a growing interval until it is dismissed.
 */
export interface SectionSchedule {
  /** The day it was enrolled. */
  made?: string;
  due?: string;
  ivl?: number;
  reps?: number;
  /** Growth per pass, ≥ 1.1; absent means `READ_AF`. */
  af?: number;
  /** Its own priority, over the document's. */
  pri?: number;
  /** Where its passage is on the document's pages: `page:x:y:w:h`, `,` between (`boxes.ts`); kept as written when not in that grammar. */
  boxes?: string;
  extra?: Extra;
}

export interface Heading {
  kind: 'heading';
  level: number;
  text: string;
  setext?: true;
  /** The section under it is enrolled (`<!-- read … -->`, FORMAT.md §6.5). */
  read?: SectionSchedule;
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
  | { key: 'leech-action'; value: LeechAction }
  /** Which pages of its PDF the document is: a chapter of a book whose pages are another document's file. */
  | { key: 'pages'; value: PageRange }
  /** The exams everything under the document is studied toward, in the order written. */
  | { key: 'exam'; value: Exam[] }
  /** The day a source's reading is paced to finish by (§3, *finish*): a source's own, not inherited. */
  | { key: 'finish'; value: string }
  /** A written notebook (§3, *Written notes*): its own id, 32 lowercase hex, which stands where a PDF's SHA-256 does. */
  | { key: 'written'; value: string }
  /** A written notebook's paper. Means nothing without `written`. */
  | { key: 'paper'; value: PaperKind }
  /** A written notebook's pages in order, each named by a whole number from 1. Means nothing without `written`. */
  | { key: 'sheets'; value: number[] }
  /** A notebook's page setup (§3, *Written notes*, milestone 85): how far apart its rules, lines or dots are, in points. */
  | { key: 'paper-rule'; value: number }
  /** 85's margin rule: a line that far from the left edge, in points, the ruling running on under it. Read, and no longer written by the app (milestone 88). */
  | { key: 'paper-margin'; value: number }
  /** Its counterpart from the right edge, read alike. */
  | { key: 'paper-margin-right'; value: number }
  /** Its margins (milestone 88): how far in from the left edge and from the right its ruling begins and ends, in points. */
  | { key: 'paper-left'; value: number }
  | { key: 'paper-right'; value: number }
  /** At which of its margins a line is drawn down the sheet. */
  | { key: 'paper-margin-line'; value: MarginLine }
  /** That line's colour, `#rrggbb` in lowercase. */
  | { key: 'paper-margin-color'; value: string }
  /** How far down a ruled sheet its first rule is, in points; a grid's or dots' room at the head (milestone 88). */
  | { key: 'paper-top'; value: number }
  /** How much room a ruled sheet keeps under its last rule, a grid or dots at the foot, in points (milestone 88). */
  | { key: 'paper-bottom'; value: number }
  /** Its sheets' size, when not Letter. */
  | { key: 'paper-size'; value: 'a4' }
  /** Its sheets on their side. */
  | { key: 'paper-turn'; value: 'landscape' }
  /** Its sheets run on as one, with no gaps between them. */
  | { key: 'pageless'; value: true }
  /** The colour of its paper, `#rrggbb` in lowercase; without it the paper follows the theme (milestone 87). */
  | { key: 'paper-color'; value: string }
  /** The colour of its rules, its grid's lines and its dots, `#rrggbb` in lowercase. */
  | { key: 'paper-line'; value: string };

/** What a written notebook's pages are ruled with. */
export type PaperKind = 'blank' | 'ruled' | 'grid' | 'dotted';
export const PAPERS: readonly PaperKind[] = ['blank', 'ruled', 'grid', 'dotted'];

/** What a notebook's page setup may say, in points: each from its least to its most. */
/** Where a notebook's margin line is drawn. */
export type MarginLine = 'left' | 'right' | 'both';
export const MARGIN_LINES: readonly MarginLine[] = ['left', 'right', 'both'];
/** A margin's width, in points: none to 300. */
export const PAPER_INSET_RANGE: readonly [number, number] = [0, 300];
export const PAPER_RULE_RANGE: readonly [number, number] = [8, 72];
export const PAPER_MARGIN_RANGE: readonly [number, number] = [18, 300];
export const PAPER_TOP_RANGE: readonly [number, number] = [0, 300];

/** One exam (§3, *exams*): its day, and what it is called (`midterm 2`), when it says. */
export interface Exam {
  day: string;
  label?: string;
}

/** What a card does when its lapses reach the leech threshold: suspended, or only marked a leech. */
export type LeechAction = 'suspend' | 'tag';

/** A run of a PDF's pages, counted from 1, both ends in it. */
export interface PageRange {
  first: number;
  last: number;
}

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
  'new-per-day', 'reviews-per-day', 'retention', 'leech', 'leech-action', 'pages', 'exam', 'finish',
  'written', 'paper', 'sheets', 'paper-rule', 'paper-margin', 'paper-margin-right', 'paper-left', 'paper-right', 'paper-margin-line', 'paper-margin-color', 'paper-top', 'paper-bottom', 'paper-size', 'paper-turn', 'pageless', 'paper-color', 'paper-line',
];

export function isField(e: FmEntry): e is Field {
  return 'key' in e;
}

/**
 * A section's line that keeps it out of the queue: no `due`, and `boxes`,
 * which is what dismissing leaves (FORMAT.md §6.5). A line with neither,
 * written by hand, is enrolled and due now, as a bare `read:` is.
 */
export function sectionDismissed(s: SectionSchedule): boolean {
  return s.due === undefined && s.boxes !== undefined;
}
