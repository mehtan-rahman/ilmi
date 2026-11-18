# ilmi on-disk format

A vault is a directory of Markdown files. Since milestone 59 the app keeps a
collection in a database of its own, and a vault is what it reads in (`import
folder`) and what it writes out (`export collection`, as a folder or a zip): a
document's text in the database is the text this document describes, byte for
byte, and an export is a vault that any text editor, and any earlier ilmi,
reads. A file changed in a text editor comes back by importing its folder.
Since milestone 60 the database keeps what is state apart from the text: a
card's `sr` lines, a section's `read` line, the attributes of `read` and
`write` are rows keyed by the card's `^id`, the heading, or the field, and
the order, the review log and the pairs said not the same (§1, `.ilmi/`) are
tables; a grade writes a row and leaves the document's text alone. None of
that changes this document: what the app reads of a document, and what an
export writes, is the file below with its lines in their places, put
together through the same parser and serializer; a file never touched since
it was imported comes out byte for byte, one written by hand included.
This document is the contract for both: a document's text, and what a vault
holds. `src/format/` implements it; the round-trip
tests in `src/format/__tests__/` hold it to the fixed point
`parse(serialize(parse(x))) = parse(x)` for every file in the corpus, including
hand-mangled ones, and `src/vault/__tests__/store.test.ts` holds a vault
imported and exported to the same bytes it went in with.

Three rules run through everything:

1. **Only annotations are ours.** Prose is stored verbatim. The app interprets
   headings, paragraphs, card syntax, front-matter keys it knows, and comment
   lines that start with `<!-- sr` or `<!-- extract`. Everything else, including
   front-matter keys it does not know, passes through byte for byte.
2. **One review touches one line.** A card's schedule is one comment line
   directly under the card. Grading rewrites that line and nothing else
   (a linked card's grade writes the other card's line too, one line each,
   §6.2 *links*).
3. **Damage is local.** A malformed annotation degrades to literal text with a
   diagnostic. It never takes prose with it, and it is never silently deleted.

## 1. Vault layout

```
notes/
  papers/
    wozniak-1990.md          a document
    wozniak-1990/            its children (extracts carved from it)
      woz-ex1.md
    crick-1995.md
    crick-1995.pdf           its pages, read in place (§3 `pdf`)
  books/
    alone.pdf                a PDF on its own: a document of its pages, no `.md` of its name
    notes-on-alone.md        a note attached to it (§3 `pdf: alone.pdf`)
    worked-problems.md       written notes (§3 `written`): a note whose pages are paper
  german.md                  a deck (type: deck in front-matter)
  fleeting/
    lecture-9.md             a note: no type, your own writing
  essays/
    spaced-composition.md    a draft (type: draft)
  courses/
    linear-algebra.md        a document whose children are anything:
    linear-algebra/
      problem-set-1.md       a deck,
      vectors.md             a draft,
      unit-2/                and a folder
        eigenvalues.md
  .ilmi/                     app-private state, never required
    order.json               the order chosen for a directory's children
    reading.json             the reading state of the PDFs on their own
    ink/<sha256>/<page>.pkdrawing   what is written on a PDF's pages
    ink/<id>/<sheet>.pkdrawing      what is written on a written notebook's sheets
    marks/<sha256>.json      what is left on a PDF's pages: bookmarks, marks, highlights, portals, passages
    marks/<id>.json          the passages kept on a written notebook's sheets
    reviews/                 the review log, one file a month
      2026-10.jsonl
    same.json                pairs of cards said not to be the same fact
```

- A directory is a folder. A `.md` file is a document. Anything else is ignored.
- Directories whose name starts with `.` are ignored (`.ilmi`, `.git`,
  `.obsidian`).
- `name.md` next to a directory `name/` means the directory holds that
  document's children. A children directory holds any node: documents of
  every type (notes, sources, extracts, decks, drafts) and folders, to any depth,
  each walked as it would be anywhere else. Moving or renaming a document
  takes its children directory and its pages with it. An extract's backref
  (§6.3) is unchanged by where its file sits.
- `name.pdf` next to `name.md` is that document's pages. The Markdown is
  the document: its type, schedule, priority, cards, and extract backrefs
  live there; the PDF is read in place and never written. The pairing is by
  stem whether or not the document names the file; a `pdf` field (§3) that
  names another file wins.
- **A `.pdf` with no `.md` of its name beside it is a document of its own**
  (since milestone 70): its pages, and nothing else. It is in the tree by
  its file name without the extension, a source, and opens as its pages. It
  is never written. Its reading state (a `read` line as §3 has it for a
  document with pages, and a `pri`) is kept apart, since there is no front
  matter to hold it, in `.ilmi/reading.json`:

  ```
  {
    "books/alone.pdf": { "read": "due=2026-06-02 ivl=2 reps=1 pos=2 y=0.250", "pri": 30 }
  }
  ```

  keyed by the file's vault-relative path, the keys sorted, `read` the
  attributes exactly as the front matter would write them, `pri` an int
  0–100; either may be absent, a key with neither is not written, and the
  file goes when nothing is left to hold. Without the file no PDF on its own
  is enrolled. A rename or a move of the file takes its entry with it; a
  PDF that gains an `.md` of its name becomes that document's pages (the
  document's own `read` line is its state from then; the entry is left and
  means nothing). A note is attached to a PDF on its own by naming it in its
  `pdf` field (§3, *Pages*): that note is one of the PDF's notes (any
  number may name it), and need not be named after it. Before milestone 70 such a file was ignored like any
  other; a vault from then opens with its unpaired PDFs as documents.
- **What is written on a book's pages** is in `.ilmi/ink/<sha256>/<page>.pkdrawing`:
  a folder named by the SHA-256 of the PDF's bytes (lower case), and in it a
  PencilKit `PKDrawing` a page, named by the page's number in the PDF, from 1.
  Nothing is ever written into the PDF, and the writing follows the file's
  bytes, not its name: a renamed book keeps it, and writing on a book deleted
  stays until the same bytes come back. An export, the mirror and a dated
  export write these; an import takes each drawing apart into its strokes.
  Coordinates are the page's points from its top left. PencilKit gives a
  drawing new ids on every save, so two exports of one page hold the same
  strokes in different bytes. A page with nothing written has no file. Without
  these files a book is unwritten; an older export has none and imports as it
  did. Added by milestone 71.
- **A written notebook** (§3, *Written notes*; milestone 82) is an `.md`
  whose front-matter carries `written`, its own id: 32 lower-case hex
  digits, where a PDF is known by the 64 of its SHA-256. The id stands
  wherever a PDF's hash does. What is written on its sheets is in
  `.ilmi/ink/<id>/<sheet>.pkdrawing`, a `PKDrawing` a sheet, named by the
  sheet's own number (§3 `sheets`), in the sheet's points from its top left
  (612 by 792, unless the notebook's page setup says another size, §3); the passages kept on its sheets are entries of
  `.ilmi/marks/<id>.json`, in the shape below, their `page` and the page of
  each box the sheet's number. Both follow the id, not the file's name or
  place: a notebook renamed or moved keeps them. A notebook deleted leaves
  them, as a deleted PDF's are left, and they are its again if the file
  comes back with that id. Two files that carry one id (a notebook copied by
  hand outside the app) are two documents over one set of strokes and
  passages: what is written in one shows in the other. The format does not
  prevent it; the app's own `duplicate` gives the copy a new id and a copy of
  the strokes. A sheet with nothing written has no file, and a notebook with
  no passages has no marks file.
- **What is left on a book's pages** (bookmarks, marks by a letter,
  highlights, portals; milestone 77; passages, milestone 81) is in
  `.ilmi/marks/<sha256>.json`: one
  file a PDF, named by the SHA-256 of the PDF's bytes (lower case), as its
  ink's folder is. So the marks follow the file's bytes, not its name: a
  renamed book keeps them, a chapter cut from a book (§3 `pages`) and the
  book share them, and the marks of a book deleted stay until the same bytes
  come back. Nothing is written into the PDF. The file is one JSON object,
  an entry a key:

  ```
  {
    "b-41c07e9a52d3": {
      "at": 1794787200000,
      "kind": "bookmark",
      "name": "3.3 · average values",
      "page": 2,
      "y": 0.3142
    },
    "h-0d9b6f3e1a77": {
      "at": 1794787260000,
      "ink": 2,
      "kind": "highlight",
      "page": 1,
      "quads": [[1, 0.1176, 0.2203, 0.7647, 0.0152], [1, 0.1176, 0.2386, 0.4118, 0.0152]],
      "text": "the entropy of an isolated system never decreases",
      "y": 0.2203
    },
    "m-a": { "at": 1794787300000, "kind": "mark", "letter": "a", "page": 1, "y": 0.0417 },
    "p-7e2c15b8a904": {
      "at": 1794787380000,
      "kind": "portal",
      "page": 1,
      "to": { "page": 2, "y": 0.25 },
      "y": 0.6
    }
  }
  ```

  (shown here with some entries on one line; the file is written with every
  key and every array element on a line of its own.) Every entry has `kind`,
  its place (`page`, the page's number in the PDF from 1, and `y`, how far
  down that page, 0 the top and 1 the bottom: never pixels, so it holds at
  any size the page is drawn), and `at`, when it was made, in milliseconds
  since 1970. By kind:

  | kind        | key             | and                                                                 |
  |-------------|-----------------|---------------------------------------------------------------------|
  | `bookmark`  | `b-` + 12 hex   | `name`, a string                                                    |
  | `mark`      | `m-` + letter   | `letter`, one of `a`–`z` (the book's) or `A`–`Z` (the collection's)  |
  | `highlight` | `h-` + 12 hex   | `quads`, `text` (the words, whitespace collapsed), `ink` 1–4        |
  | `portal`    | `p-` + 12 hex   | `to`: `{ "page", "y" }`, and `"pdf"` when it is in another PDF       |
  | `passage`   | `s-` + its boxes | `boxes`, and a section's line: `made` `due` `ivl` `reps` `af` `pri` (§6.5) |

  A highlight's `quads` are its lines, each `[page, x, y, w, h]`: the
  page's number, then a rectangle as fractions of that page from its top
  left, as a section's boxes are (§6.5); its own `page` and `y` are its
  first quad's. Its `ink` is how it is drawn: 1 a band, 2 a rule under the
  line, 3 a dashed rule, 4 a dotted one; absent or out of range reads as 1.
  A mark's key is its letter, so setting a letter again moves the mark. A
  capital is the collection's: when two PDFs' files each hold `m-A`, the one
  with the later `at` is the collection's `A`. A portal's `to.pdf` is the
  other PDF's SHA-256; without it the destination is in the same PDF.

  A **passage** is boxes on the pages that come back on the reading loop
  until dismissed (§6.5, *A passage*). It is kept here and in no note:

  ```
  "s-41:0.120:0.860:0.770:0.075,42:0.100:0.097:0.770:0.040": {
    "at": 1794787500000,
    "boxes": "41:0.120:0.860:0.770:0.075,42:0.100:0.097:0.770:0.040",
    "due": "2026-11-02",
    "ivl": 3,
    "kind": "passage",
    "made": "2026-10-30",
    "page": 41,
    "y": 0.86
  }
  ```

  `boxes` is one or more boxes in the grammar of §6.5, `,` between, and is
  what the passage is: its key is `s-` and that string as written, so the
  same boxes are one passage on every device, and boxing them again writes
  the same entry anew. Its `page` and `y` are its first box's. `made` is a
  day; `due` a day or an instant; `ivl` and `reps` integers ≥ 0; `af` a
  number ≥ 1.1; `pri` an integer 0–100: each means what it means on a
  section's line, and an absent one what its absence means there. An entry
  with no `due` is a passage dismissed: kept, drawn dashed, out of the
  queue. `boxes` written otherwise (`41:0.12:…`) is read canonically; an
  entry whose `boxes` is missing or not in the grammar does not read (below).
  A value of the others that does not read is left out and the rest stands.
  A passage has no name: where one is shown it is its pages (`p. 41`,
  `pp. 41–42`).

  The file is written with its keys sorted (by code unit) at every level,
  two spaces of indent, fractions to four decimals, and a newline at the
  end: the same marks are the same bytes. An entry that does not read (an
  unknown `kind`, a field missing or of the wrong type) is in no list, and
  is written back as it was, so a file from a later version loses nothing.
  A file that is not a JSON object of objects holds no marks and is left
  alone. Without the file a PDF has no marks; an emptied one is `{}`.

  An export, the mirror and a dated export write these files as any other
  under `.ilmi/`; an import reads them in. Between devices each entry
  merges on its own (two devices that each add a bookmark end with both; an
  entry removed on one is gone on both; an entry changed on two is the later
  change), so what a sync leaves is the union, in the bytes above.
- Any other file in a document's children directory is ignored by the walk.
  A clipped page's images land there (`name/img-01.png` …, §3 `url`) and the
  document refers to them relatively, `![alt](name/img-01.png)`. A page of
  ink lands there the same way, with its drawing beside it (§4).
- A document's display name is its filename without `.md`, unless front-matter
  sets `title`.
- Folder open/closed state, window layout, and other view state live in
  `.ilmi/`, not in the files. Reading position does live in the file (§3).
- The order of a directory's children is view state too, in
  `.ilmi/order.json`: `{ "<dir>": ["name.md", "sub/", …] }`, where `<dir>`
  is vault-relative (`""` the root, `courses/linear-algebra` a document's
  children directory), a document is listed by its file name and a folder by
  its name and a slash. Names not listed follow the listed ones in the
  default order (folders first, then documents, by name); listed names that
  no longer exist are ignored and dropped the next time the file is written.
  Without the file every directory is in the default order.
- **The review log** is app-private too: `.ilmi/reviews/<yyyy-mm>.jsonl`,
  one JSON object a line, one line a grade, in the month of its `at`.
  A card's `sr` line holds its latest state; the log holds how it got
  there, for the numbers a lens shows. Nothing reads it to schedule a card,
  so a vault without it loses only history (what needs it says since when it
  was kept). A line:

  ```
  {"at":"2026-10-30T08:15:02Z","doc":"arabic/vocabulary.md","card":"voc-karam","key":"r","g":3,"st":"review","elapsed":12,"ivl":10,"next":26,"s":25.31,"d":4.2,"ms":6400}
  ```

  `at` a UTC instant to the second; `doc` the card's document, vault-relative,
  when graded; `card` its `^id` (a card is given one when first graded, §6.1);
  `key` the line graded, `cN` or `r` (§6.2), absent for the bare line; `g`
  1–4; `st` the state before (`new` `learning` `review` `relearning`);
  `elapsed` whole days since the review before, 0 for a new card; `ivl` and
  `next` the interval before and after, in days (0 in learning steps); `s`,
  `d` stability and difficulty after; `ms` the time on the card, at most a
  minute, when known; `src` where the line came from when not a session in
  the app (`anki` for an imported revlog); `over` on a grade given again in
  the session it was first given in (‹ back to a card already graded), the
  `at` of the line it replaces, of the same `card` and `key`. Keys are
  written in that order; unknown keys are ignored on read. It is built for
  sync: lines are only appended, never rewritten, so two devices add theirs
  to the same month;
  every `.jsonl` in the directory is read (a sync tool's conflict copy
  too); a line seen twice (the same `at`, `card`, `key`, and `g`) counts
  once; a line that does not read as one (torn by a crash, junk) is
  skipped. A line some `over` names is replaced: it does not count, the
  replacing line does, so a card graded again counts once, with its last
  grade (the card's `sr` line went back to before the grade replaced and
  was graded from there). A replacing line's `at` is always after the
  line's it replaces, a second after when the grade came within the same
  second, so no two lines replace each other; an `over` not before its
  line's `at` is ignored. An app without `over` counts both. A card moved to
  another document is found again by its id when its old document is gone.
- **A reading line** is a line of the same month files that says something
  was read, not graded: a pass on a source, a section or a draft leaves its
  `read` line where the last one was, so nothing else says a document was
  read on, or when an extract was made of it. One line each time:

  ```
  {"at":"2026-12-01T08:05:00Z","doc":"papers/wozniak-1990.md","read":"pass","to":14,"ms":412000}
  {"at":"2026-12-01T08:07:00Z","doc":"books/notes-on-alone.md","read":"section","sec":"the first night"}
  {"at":"2026-12-01T08:11:05Z","doc":"papers/crick-1995.md","read":"undo","of":"2026-12-01T08:11:00Z"}
  ```

  `at` and `doc` as a grade's (the document read; for a section the
  document its heading is in); `read` what was done: `pass` (read on: ⏎ on
  it in a session or a queue, a book's done for today), `later`
  (postponed), `done` (dismissed, finished), `extract` or `section` (one
  made of it, from a selection or from boxes; a section's `doc` and `sec`
  are where it was made); `sec` the heading's text when it is a section's;
  `to` where it was read to (a block of a text, a page of a book) and `ms`
  the time on it, each when known. A line has no `card` and no `g`: that
  is what tells it from a grade, and why an app that reads only grades
  skips it, as it skips any line it does not know; a reader of reading
  lines skips the grades the same way, and a `read` word it does not know.
  Keys are written in that order, optional ones absent, never null;
  unknown keys are ignored. The rules of the log hold: lines are only
  added, every `.jsonl` is read, a line seen twice (the same `at`, `doc`,
  `read`, and `sec`) counts once. A line taken back (a notice's undo that
  put the document back) is not removed: `"read":"undo"` with `of`, the
  `at` of the line it takes back, of the same `doc` and `sec`, is added,
  and neither counts. A writer gives no two lines of one document and
  section the same second (the later is logged a second after), so an undo
  names one line. Nothing is derived for the days before the first line:
  the reading's history starts when it is first logged. The corpus month
  `reviews/2026-12.jsonl` holds both kinds mixed (`readings.test.ts`).
- **Not the same** is app-private too: `.ilmi/same.json`,
  `{ "not": ["<key>|<key>", …] }`, the pairs of cards the person said do
  not test the same fact, so the app never offers them again (milestone
  45). A card's key is its `^id`, or `<path>#<id>` when two files hold the
  same id, or `<path>#<hash of its text>` when it has none; the two keys of
  a pair are in sorted order, joined by `|`, and the list is written sorted.
  Without the file every pair the app finds is offered.

## 2. File shape

```
---
type: source
frozen: true
imported: 2026-04-18
pri: 80
read: due=2026-06-01 ivl=9 reps=4 pos=12
---

## §1 — the premise

Ordinary prose. Paragraphs are separated by blank lines.

the {{c1::minimum information principle}} is the discipline of breaking
knowledge into the smallest atoms a learner can {{c2::recall}} independently ^cw2-min
<!-- sr c1 due=2026-05-27 st=review s=11.8 d=4.2 r=14 l=2 -->
<!-- sr c2 due=2026-06-01 st=review s=3 d=5.1 r=2 l=0 -->

Atomicity sounds easy and is in fact the hardest discipline in the practice.
<!-- extract woz-ex1 -->
```

A file is: optional front-matter, then a body of blocks. Line endings (`\n`,
`\r\n`, or a lone `\r`) are normalized to `\n` on read and written as `\n`. A
leading byte-order mark is dropped. The serializer always ends the file with
exactly one newline.

## 3. Front-matter

Front-matter is present when the first line of the file is `---`. It ends at
the next line that is exactly `---` or `...`. If there is no closing line, the
file has no front-matter and the opening `---` is body text (a thematic break).

Each line inside is either a **field** the app knows or a **raw line** it does
not. Raw lines (unknown keys, comments, indented YAML, blank lines) are kept
verbatim, in place. Known fields are re-emitted in their original position with
canonical formatting; a field that gains a value is appended at the end; a
field that loses its value is removed. Everything stays valid YAML, so Obsidian
and friends can read the file.

A field is `key: value` with no leading whitespace. A trailing ` # comment` on
a known field is dropped on write. If the same known key appears twice the
later value wins, written at the earlier line's position; the later line is
dropped, with a diagnostic.

| key            | value                       | default   | meaning                                                            |
| -------------- | --------------------------- | --------- | ------------------------------------------------------------------ |
| `type`         | `note` `source` `deck` `draft` `extract` | `note` | what the file is, and the lens that opens it         |
| `title`        | string                      | filename  | display name                                                       |
| `frozen`       | `true` `false`              | `false`   | prose is locked; cards stay editable (a text source's; never a document with pages) |
| `imported`     | day                         |           | when the source came in                                            |
| `started`      | day                         |           | when the draft began                                               |
| `read`         | attributes (§7)             |           | enrolled in incremental reading                                    |
| `write`        | attributes (§7)             |           | enrolled in incremental writing                                    |
| `default-card` | `cloze` `qa` `bidir`        |           | what the composer opens to, for decks                              |
| `pri`          | int 0–100                   | `50`      | priority, lower first: the document's reading, writing, and every card in it |
| `pdf`          | file name                   | `name.pdf` beside the document, when it exists | the document's pages, relative to the document (§1) |
| `url`          | string                      |           | the page a clipping came from                                      |
| `author`       | string                      |           | who wrote it                                                       |
| `published`    | day or instant              |           | when it was published                                              |
| `tabs`         | `true` `false`              | `false`   | the document's children are tabs in a rail beside its page         |
| `new-per-day`  | int 0–9999                  | `20`      | new cards introduced a day (options, below)                        |
| `reviews-per-day` | int 1–9999               | none      | reviews a day, at most                                             |
| `retention`    | number 0.7–0.99             | `0.9`     | the recall FSRS schedules for (its request retention)              |
| `leech`        | int 1–9999                  | `8`       | lapses that make a card a leech                                    |
| `leech-action` | `suspend` `tag`             | `tag`     | what a leech does: suspended (`sus=1`), or only marked             |
| `pages`        | `n` or `n-m`                |           | which pages of its PDF the document is, numbered as the PDF numbers them |
| `exam`         | `day label`, `, ` between   |           | the exams everything under the document is studied toward (exams, below) |
| `finish`       | day                         |           | the day a source's reading is paced to end by (finish, below)      |
| `written`      | 32 lower-case hex digits    |           | the document is a written notebook, and this is its id (written notes, below) |
| `paper`        | `blank` `ruled` `grid` `dotted` | `blank` | what a written notebook's sheets are ruled with                    |
| `sheets`       | whole numbers from 1, a space between | `1` | a written notebook's sheets, in order, each by its own number  |
| `paper-rule`   | points, 8 to 72             | 24 ruled, 20 grid and dotted | how far apart a notebook's rules, grid lines or dots are |
| `paper-left`   | points, 0 to 300            | 0         | a notebook's left margin: how far in from the left edge its ruling begins |
| `paper-right`  | points, 0 to 300            | 0         | its right margin: how far in from the right edge its ruling ends  |
| `paper-top`    | points, 0 to 300            | 72 ruled, 0 grid and dotted | how far down a ruled sheet the first rule is; the room a grid or dots keep at the head |
| `paper-bottom` | points, 0 to 300            | a rule's spacing ruled, 0 grid and dotted | the room a ruled page leaves under its last rule, a grid or dots at the foot |
| `paper-margin-line` | `left` `right` `both`  |           | at which margins a line is drawn down the sheet; none without it |
| `paper-margin-color` | `#rrggbb`             | a pale red | the colour of that line                                          |
| `paper-margin` | points, 18 to 300           |           | before 88: a line down the sheet that far from the left edge, the ruling run on under it; read, no longer written |
| `paper-margin-right` | points, 18 to 300     |           | the same from the right edge; read, no longer written             |
| `paper-size`   | `a4`                        | Letter    | the size of a notebook's sheets                                    |
| `paper-turn`   | `landscape`                 | upright   | a notebook's sheets lie on their side                              |
| `pageless`     | `true`                      |           | a notebook is one long sheet, as long as what is written on it     |
| `paper-color`  | `#rrggbb`                   | the theme's | the colour of a notebook's paper                                 |
| `paper-line`   | `#rrggbb`                   | the theme's | the colour of a notebook's rules, grid lines and dots            |

**Type.** A `note` is the person's own writing: editable, cards anywhere in
it, no schedule unless asked. A `source` is what someone else wrote, read
incrementally: imports, PDFs, EPUB chapters, clippings; every importer
writes `type: source`. `extract`, `draft` (incremental writing), and `deck`
are below. A file with no `type` is a note, so a plain folder of Markdown
opened as a vault is notes; except that a file with no `type` and an
`imported` field is a source, because the importers wrote no `type` before
notes existed and those files stay what they were. The app writes no
`type` for a note it makes.

`read` attributes: `due` (day or instant), `ivl` (days between passes, int),
`reps` (passes made, int), `pos` (prose blocks read, int), `y` (number 0–1,
written to three decimals), `page` (int ≥ 1),
`af` (growth, number ≥ 1.1, default 1.6), `pri` (int 0–100).
`pos` counts prose blocks from the top of the body, skipping cards;
hand-inserting a paragraph above the marker shifts it by one, which is the
accepted trade for not tagging every paragraph with an id. On a document
with pages, `pos` is the page the read point is on instead, counted from 1
as the PDF counts its pages, and `y` how far down that page it is, a
fraction from the page's top (`pos=42 y=0.740`); a `pos` with no `y` is the
page's foot, as before `y` existed. *Done for today* records the point at
the bottom of the view, moved forward only. `y` means nothing on a document
without pages and is kept as written there. On a note, `read` means
*revisited*: the note comes back on the same growing interval, but each pass
starts at the top or at a heading the person picks, since a note's own edits
would shift a position; its line keeps `due`, `ivl`, `reps`, `af` (and the
older `pri=`) and has no `pos`. A `pos` written there by hand is kept as
written and means nothing; the app drops it on the next pass. A single section of any document can come back the same
way, on a line of its own under its heading (§6.5). `page` sits on an extract carved
from a page of its parent's PDF and names that page; it means nothing on
any other line and is kept as written.

**Pages.** `pdf` names a file relative to the document, written plain or
quoted like `title`. What the field means turns on the document's type
(since milestone 70). **A source** (`type: source`) naming a PDF is that
PDF's pages, or a range of them (`pages`, below): it opens as its pages,
and its body is the person's notes on those pages: never frozen, whatever
`frozen` says (`frozen` locks only a text source's text). A passage boxed
on the pages is a section of the notes (§6.5, `boxes`); a box clipped into
the notes is a clip line (§6.6). **A note** (no `type`) naming a PDF that
stands on its own (§1) is attached to it: the note is that PDF's notes, and
opens as the note it is; the PDF opens as its pages, with that note beside
them when asked, and what is kept from the pages (a boxed section, a clip)
goes into the note. A note need not be named after the file, and may sit in
any folder. Several notes may name one PDF: each is one of its notes, the
app shows them in path order (as tabs beside the pages), and a clip goes
into whichever the person has in front. The note's own `read` line, if it has one, is a note's
(revisited); the PDF's reading state is its own (§1, `reading.json`). A
note naming a PDF that is not on its own (one with an `.md` of its name)
is a document with pages as before: it opens as those pages, its body their
notes. Older work kept what
came out of the pages in the body under one heading per page, `## p. <n>`, which the app added the
first time something landed on that page. Since milestone 81 the app adds
no such heading and writes nothing into the notes on a PDF but a clip asked
for (§6.6): a note made for a PDF is empty but for its `pdf` field, and a
passage boxed on the pages is kept with the PDF (§6.5, *A passage*). An
extract carved from a page leaves the passage in the notes as a
paragraph carrying the `<!-- extract NAME -->` backref (§6.3), at their
end, while the
child carries `page=<n>` on its `read` line. A `## p. <n>` heading is ordinary
Markdown; the format gives it no meaning beyond saying the page of what is
under it (§6.6), and a hand-written `## p. 3` is the same heading. A `pdf` that names a missing
file is kept and the document reads as text.

**A page range.** `pages: 12-40` (or `pages: 12`, one page; an en dash is
read too) says the document is only those pages of its PDF: a chapter of a
book, whose pages are another document's file. It is how a PDF with chapters
in its outline lands as a notebook: the book's document `name.md` with
`name.pdf` beside it and `tabs: true`, and a document per chapter in its
children directory, each with `pdf: ../name.pdf` and its `pages`. The file
is never cut or copied; every chapter reads the one PDF. The numbers are the
PDF's own, from 1, so `pos`, an extract's `page=`, and `## p. <n>` on a
chapter all count as the book counts; a range past the file's last page is
cut to it. Both ends are whole numbers from 1 and the first is not after
the last; anything else is kept as a raw line with a diagnostic, and the
document is all its pages. `pages` means nothing on a document with no PDF.
A `pdf` path may climb (`..`) as long as it stays inside the vault; one that
leaves it is not followed. Chosen over a page-range attribute on the `pdf`
value (`pdf: book.pdf#12-40`) because a file name may hold `#`, and over a
sidecar list of chapters in the book's own front-matter because each chapter
is a document of its own, with its own reading schedule, cards and
extracts, and should say what it is in its own file.

**Written notes.** A document whose front-matter carries `written` is a
written notebook (milestone 82): a note whose pages are paper, written on
by hand, with no text of its own.

```
---
written: 5b0c7e1a9d3f4e26b8a1c0d2e4f60718
paper: ruled
sheets: 1 2 3
pdf: ../books/alone.pdf
---
```

`written` is the notebook's id: 32 lower-case hex digits, made when the
notebook is and never changed. It stands where a PDF's SHA-256 stands: the
strokes on its sheets and the passages kept on them are found by it (§1),
so they follow the notebook through a rename or a move. Anything else in
the field is kept as a raw line with a diagnostic, and the document is an
ordinary note. `paper` is what the sheets are ruled with, `blank`, `ruled`,
`grid` or `dotted`; absent it is `blank`, and the app writes `ruled` on a
new notebook. `sheets` is the notebook's pages in order, each a whole
number from 1 that names the sheet for good, a space between, none twice;
absent it is `1`. Strokes and boxes name a sheet by its number, not by
where it lies, so taking a sheet out moves nothing: `sheets: 1 3` after the
second is deleted. A new sheet takes one past the highest number there,
wherever among the others it is put: at the end, after another, or as a
copy after the sheet it copies (its strokes copied under the new number),
so the numbers need not rise along the list (`sheets: 1 4 2 3`). A sheet
moved among the others changes its place in the list and nothing else.
Deleting a sheet takes its number out of `sheets`, its drawing and the
passages with a box on it; a notebook keeps at least one sheet. A `paper`
or `sheets` that is not in its grammar is kept as a raw line with a
diagnostic, and the default stands in. `paper` and `sheets` mean nothing
without `written`.

A notebook's page setup (milestones 85, 87, 88) is fourteen more fields, each optional,
each meaning nothing without `written`, and a notebook with none of them is
what it was before there were any: portrait Letter sheets, 612 by 792
points, a rule every 24 points from 72 down on ruled paper, a grid or dots
every 20.

```
---
written: 5b0c7e1a9d3f4e26b8a1c0d2e4f60718
paper: ruled
sheets: 1 2 3
paper-rule: 20.25
paper-left: 34.02
paper-right: 34.02
paper-top: 56.69
paper-bottom: 48
paper-margin-line: left
paper-margin-color: #b5d2f2
paper-size: a4
paper-turn: landscape
pageless: true
paper-color: #fbf6e9
paper-line: #c9cdd2
---
```

`paper-rule`, `paper-left`, `paper-right`, `paper-top` and `paper-bottom`
are lengths in points (a 72nd of an inch), written with at most two
decimals and no unit. `paper-rule` is how far apart the rules of ruled
paper, the lines of a grid or the dots of dotted paper are, 8 to 72.

The margins (milestone 88) are where the ruling lies on the sheet.
`paper-left` is how far in from the left edge it begins and `paper-right`
how far in from the right edge it ends, each 0 to 300; absent, or 0, there
is no margin at that edge and the ruling runs to it. Two that leave less
than one spacing between them are read as none. On ruled paper every rule
is drawn from the left margin to the right one; `paper-top` is how far
down the sheet the first rule is, 0 to 300 (72 without it), and
`paper-bottom` how much room a page keeps under its last rule, 0 to 300:
no rule is drawn nearer the foot than that (one spacing without it, as
before there was the field). On a grid and on dots `paper-top` and
`paper-bottom` are the room kept at the head and the foot (none without
them), and the ruling is centred in what the four leave: with *a* by *b*
the rectangle inside the margins, lines (or columns and rows of dots)
stand every spacing from half of what *a* leaves over, and from half of
what *b* leaves over. Where a grid has a margin its lines end on its
outermost line that way, so it is closed there; where it has none they
run to the sheet's edge. Dots stand on every crossing, except that at an
edge with no margin the outermost row or column, which a file from before
88 never had, is left out. So a file with none of these fields reads as it
always did: rules edge to edge from an inch down, a grid to the edges, dots
a spacing short of them. On blank paper the margins rule nothing and only
place a margin line. `paper-bottom` means nothing on a pageless notebook,
whose ruling runs on, and there `paper-top` is where the long sheet's
ruling begins. The app writes a new ruled notebook `paper-left: 34.02` and
`paper-right: 34.02` (12 mm); when the paper is changed to a grid or dots
it gives them 22.68 (8 mm) at the head and the foot, and at each side
whose margin was still a new ruled notebook's (and back again); it writes
no field whose value is what its absence means.

`paper-margin-line` draws a line down the sheet, its whole height, at the
left margin (`left`), the right (`right`) or both (`both`): at
`paper-left` from the left edge, at `paper-right` from the right. It draws
none at an edge whose margin is 0 or absent. `paper-margin-color` is that
line's colour, `#` and six hex digits as `paper-color` below; without it
the line is a pale red (`#e7b9b9`; `#653f3f` on dark paper), and it is
drawn by the rule `paper-line` is: as chosen, and turned with the theme on
paper that follows a dark theme. It is kept while there is no line.

`paper-margin` and `paper-margin-right` are what a margin was before 88,
and are still read: a line down the sheet that far from the left edge (the
right edge), 18 to 300, in the margin line's colour, with the ruling not
set in by it. A reader draws them beside whatever the fields above say. The
app no longer writes them; the first time a margin is set in its page
setup it writes `paper-left` (`paper-right`) with that value and
`paper-margin-line` in their place, and from then the ruling begins at the
line.

`paper-size: a4`
makes every sheet 595 by 842 points; `paper-turn: landscape` lays the
sheets on their side (792 by 612, 842 by 595). The only values are `a4`,
`landscape` and `true`: Letter, upright and paged are said by leaving the
field out. A value outside its grammar or its range is kept as a raw line
with a diagnostic, and the default stands in.

`pageless: true` changes how the sheets are shown and nothing about what
they are. They are still the sheets `sheets` lists, each the notebook's
size, each with its own strokes and boxes: the unit of what is kept and
synced. They are drawn one under another with nothing between, as one long
sheet with no mark where one ends, and the ruling of each carries on from
the one before (the long sheet's rules, lines or dots, counted from its
top; the margin rules run down all of it). A stroke is kept on the sheet
its topmost point lies on (milestone 88; before it, the sheet it began
on), in that sheet's points, and may run past that sheet's foot onto the
next: a reader draws a pageless sheet's strokes down to a whole sheet
below it. What is moved or put down together is kept together, on the
sheet the top of all of it lies on.

The long sheet is drawn as long as what is written on it, and a little
more (milestone 88). Its length is not kept anywhere: it follows from the
strokes, the same on every device. With `foot` the lowest point any stroke
covers, in points from the long sheet's top (sheet *i* of the list, from
0, begins *i* sheet-heights down), the sheet is drawn `foot` + 192 points
long, rounded up to the next whole step along its ruling: for ruled paper
a rule's place (`paper-top` and whole spacings), for a grid or dots a
line's place (`paper-top` and whole spacings; with no `paper-top`, whole
spacings from half of what a sheet's height leaves over, and that half
again), for blank paper a multiple of 24. Where `foot` + 192 is no more than one
sheet's height, it is exactly one sheet. The sheets of the list that
begin past that length are not drawn, and the one it ends in is drawn
only down to it; they are kept in the file, with whatever is on them. A
writer adds the next sheet to `sheets` (one past the highest number, at
the end) before the length comes to the end of the last, so two devices
writing at once add the same number and their strokes merge under it;
where a merge leaves a sheet that holds strokes out of the list, a writer
that finds strokes under a number past the highest listed puts that number
back on the end. A
notebook made pageless before 88 grew by whole sheets and may list sheets
past what is written: they read as above. A reader may draw the sheet
longer than this while it is being written on (the app never shortens it
under the hand, only when the notebook is next opened), never shorter.
Shared as a PDF, a pageless notebook is cut into pages of its sheets'
size, as many as `foot` reaches. Taking `pageless` away, or putting it on
a notebook already written in, moves no stroke: every sheet of the list
is a whole page again.

`paper-color` and `paper-line` are colours, each `#` and six hex digits
(red, green, blue in sRGB), written in lowercase; a reader takes capitals
too, and anything else is kept as a raw line with a diagnostic. Without
`paper-color` the paper follows the reader's theme: white where the theme
is light, dark where it is dark. With it the paper is that colour in every
theme, as chosen. `paper-line` is the colour of the rules of ruled paper,
the lines of a grid and the dots of dotted paper; without it they are a
pale blue-grey on light paper and a dim one on dark, and on blank paper it
means nothing. A margin line has its own colour (`paper-margin-color`,
above), whatever `paper-line` says. A `paper-line` on paper that follows a dark theme is
turned as that theme turns the paper, so it still shows; on paper whose
colour is chosen it is drawn as chosen.

Ink is drawn to be read on the paper it lies on. Paper is dark when its
colour's relative luminance (WCAG's, of the sRGB colour) is under 0.4,
whether the colour was chosen or is the theme's. On dark paper what is
written is drawn the dark way: black ink shows white and white black, as
PencilKit's dark appearance has them, and a highlighter lightens what is
under it where on light paper it darkens it. On light paper ink is drawn
as written, in any theme. The strokes kept are the same either way: only
how they are shown changes, and a notebook's PDF is made the same way,
with its paper's chosen colour (white where none is chosen).

What is written is kept in a sheet's points from its top left (§1), so no
field of the page setup moves it: another spacing or margin moves the
paper under the ink, and on a sheet made smaller or turned, strokes past
the new edge are kept and not shown.

A notebook has no `type`: it is a note. It opens as its sheets, as a PDF on
its own opens as its pages. Its body is kept as written and not shown; the
app writes none. `pdf` on a notebook means what it means on any note
(*Pages*, above): naming a PDF that stands on its own, the notebook is one
of that PDF's notes, listed with the typed ones in path order and opened
beside the PDF's pages, where it is still its own sheets. And a notebook
may itself have notes: a typed note whose `pdf` names a notebook's `.md`
(`pdf: worked-problems.md`) is attached to it exactly as to a PDF on its
own, opens as the note it is, and takes the clips made from the notebook's
sheets (§6.6). A notebook's `pdf` naming another notebook attaches nothing.
A notebook has no reading state unless it carries a `read` line as any note
may; `.ilmi/reading.json` never names it. An export writes the `.md` as it
is, each written sheet as `.ilmi/ink/<id>/<sheet>.pkdrawing` and the
passages as `.ilmi/marks/<id>.json`; an import of that folder has all three
again.

A notebook may have children as any document may (§1, its children
directory): written notebooks, typed notes, folders. `tabs: true` on it
means what it means on any document (*Tabs*, below): its children are
drawn as tabs beside its sheets, the notebook itself first. A child that is
a notebook is a notebook of its own, with its own id, sheets and page
setup; the app starts one made as a tab with the page setup of the notebook
it was made from, and nothing ties the two after that.

**Clippings.** A page that came in by its address carries `url`, and
`author` and `published` when the page said. `url` and `author` are written
plain or quoted like `title`; `published` is a day or a UTC instant, as the
attributes' value types (§7) have them. Nothing else reads them: they are
what the inspector shows and what a reader of the file wants to know.

`write` attributes: `due`, `ivl`, `reps`, `af` (default 1.5), `pri` as above,
plus `done` (`true`/`false`). A done draft keeps its line so it can be
reopened.

**Growth** is SuperMemo's A-factor, re-tuned on 2026-11-03 from a
day-by-day simulation (`design/sim/irsim.py` is the reference; its
constants are the app's). A pass multiplies by `af`, rounded, never below
one day, from the longer of the stored `ivl` and the days since the pass
before (the line's `due` less its `ivl`): on time the two are the same;
sixty days late on `ivl=3` the next interval is 101, not 5. That is the
rule for a note revisited, an extract, a section (§6.5), a draft, and a
source read to its end. **A source with reading
left** (`pos` short of its prose, or any document read by its pages) does
not grow: a pass writes `ivl` as its **cadence** and `due` as today plus
it, `reps` one more. The cadence is `1 + min(2, ⌊3·pri/100⌋)` days of the
priority that applies (the `pri` field, else the line's, else 50): every
day under 34, every other day to 66, every third day above. Postpone, the
person's `p`, grows the stored `ivl` by 1.2 (at least a day) whatever the
document is, and counts no pass. The backlog rule (`postpone the rest`, or
the tweak at the day's start) does the same, except that a source with
reading left is held over to tomorrow with its `ivl` kept: the person did
not choose to skip it, and a missed day should not stretch a book's
cadence. Enrolling writes `ivl` as the cadence and `due` today;
an extract carved out starts the same way, due today on the cadence of its
priority. `af` is written only when it is not the default; a value below
1.1 is dropped with a diagnostic, and the default value, if written by
hand, goes on the first write (§8). The app's interval field writes `ivl`
and `due = today + ivl` and nothing else.

**The day's order.** What is due sorts by a draw, not by `pri` alone: each
due item's key is a Beta draw with mean `pri/100` (clamped to .01–.99)
and pseudo-count 20, seeded by the item (its path and heading, card id,
or kind) and the day, then by stored due (oldest first), then file order.
The same all day, another order the next; ±11 points at 50, ±5 at 95, so
the top holds and the middle mixes. What is not due sorts by due, then
priority. Nothing of this is written. **The backlog** is what was due
before today; *postpone the rest* postpones only it (reading, sections
and drafts, never cards), leaving what is first due today alone; a tweak,
off by default, runs that at the day's first queue build, and the vault's
`.ilmi/state.json` keeps `lastDay` so the day's start is known once.

**Priority** is one scale for everything, as in SuperMemo: `0` comes first,
`100` last, `50` when nothing says otherwise. The `pri` field is the document's
and applies to its reading, its writing, and every card in it. A `pri=` on the
`read` or `write` line is older: it is read as a fallback for that loop while
the document has no `pri` field, and dropped the first time the app writes a
file that has one (§8). A card may carry its own `pri` on its bare `sr` line
(§6.2), overriding the document's.

A bare `read:` or `write:` with no attributes means enrolled with nothing
recorded yet; the app fills it in on the first pass. YAML block-style nesting
under it (`read:` then indented `due: …` lines) is not read: the indented lines
are kept verbatim, ignored, and reported.

A known key whose value does not parse (`frozen: maybe`, `type:` with nothing
after it) is kept as a raw line with a diagnostic, and the field takes its
default.

**Tabs.** `tabs: true` asks the app to draw the document's children (§1,
its children directory, in its order) as tabs beside its page, the
document itself first and a child's own children as subtabs under it. A
tab is a whole document or folder in its own file; nothing about the
children changes with the field, and without it they are the same nodes in
the tree. `tabs: false` is the default and is written only when set by hand.
How the rail draws them is the app's, not the file's: extracts among the
children are not drawn as tabs (a tab's show as one line under it), and it
draws three levels. A book imported from an EPUB lands as a document with
`tabs: true` and its chapters in its children directory.

**Options.** `new-per-day`, `reviews-per-day`, `retention`, `leech`, and
`leech-action` are study options. Set on a document, each applies to its
cards and to everything under it (its children directory, all the way
down, folders included) unless something lower sets it; where nothing
sets one, the default in the table holds. A folder has no front-matter and
takes them from the document above it. The two counts are allowances
counted where they are set: `new-per-day: 10` on a notebook is ten new
cards a day across everything under it that does not set its own, and a
deck under it with `new-per-day: 3` has three of its own; with nothing set
anywhere each document is its own deck of twenty. A new card is one never
graded; what is over the day's allowance waits for the next day, in the
queue's order, and nothing is written for it. `reviews-per-day` caps cards
in review only, never cards in learning steps. `retention` is handed to
FSRS for every grade under it. A leech is a card whose lapses reach
`leech`, and again at every half of it after (eight, then twelve,
sixteen); `leech-action: suspend` writes `sus=1` on the line graded
(§6.2), `tag` writes nothing and the app marks it. A value that does not
parse (`retention: 1.2`, `new-per-day: -3`) is a raw line with a
diagnostic, as any known key's; `retention` is written as the shortest
decimal (§7).

**Exams.** `exam: 2026-11-18 midterm 2, 2026-12-14 final` says the
document and everything under it (its cards, and its children directory
all the way down, as options reach) are studied toward those days. Each
entry is a day, then optionally a label (`midterm 2`; inner runs of
whitespace written as one space), entries separated by commas, so a label
holds no comma. One line holds them all, not one `exam` line per exam,
because a key given twice is not valid YAML (and here, as for any known key,
the later line wins with a diagnostic). Written `day label`, `, ` between,
in the order given, plain or quoted like `title`; an entry that is not a day
(`exam: next friday`, `2026-13-01`, an empty entry) makes the line raw with a
diagnostic. Unlike options, exams add up: a deck that sets its own quiz
under a notebook that sets a final is studied toward both, the nearer first.
What the app does with them, derived and never written except through the
ordinary `sr` and `read` lines: while an exam is ahead, a grade that FSRS
would schedule past the exam's eve, on a card not yet seen in the exam's
last week, is due on a day of that week instead (the interval cut, the
stability and difficulty FSRS's own); the queue brings a line written before
the exam was set into that week the same way, nothing written; a source or
extract with reading left is paced to be finished three days before (its
next pass brought forward, the interval written the shorter of growth and
pacing, so the line's `due` less its `ivl` is still the day of the pass);
new cards under it come in early enough to be reviewed a few times, unless
`new-per-day` is set. The day after the exam none of it applies.

**Finish.** `finish: 2026-11-24` on a source says its reading should end by
that day: a textbook that follows lectures, a reading group, a deadline. A
day, plain or quoted like `title`, written plain; anything else is a raw line
with a diagnostic. It is the document's own and is not inherited. While the
day is ahead a pass is paced as under an exam, to the day itself with no
lead: the passes left (what is left, at what a pass has read so far, as
`pos` over `reps`, four before any) are spread over the days left, and the
interval written is the shorter of that and the cadence, so the line's `due`
less its `ivl` is still the day of the pass. The queue brings a line written
before the day was set forward the same way, nothing written; a clear puts it
back. The backlog holds it over to tomorrow as any book. An exam ahead whose
own target (three days before it) is no later than the day paces it instead.
What is left is counted in prose blocks, or on a chapter in its `pages`
(from the page after `pos` to the range's last). After the day the field
means nothing and is left as written. It means nothing on a note, a draft, a
deck or an extract, on a source with no `read` line, and on a document read
by all of a PDF's pages with no `pages`, since nothing says how long a PDF is
until it is opened. So a PDF on its own (§1) has none: `reading.json` holds no
`finish`, and a `finish` given there is dropped.

**title** is written plain when it can be and as a double-quoted JSON string
otherwise (when it starts with a YAML-significant character, contains `: ` or
` #`, or has leading or trailing whitespace). Single-quoted YAML strings are
read but written back in one of the two forms above.

## 4. Body blocks

The body is a sequence of blocks separated by blank lines. A blank line is one
that is empty or whitespace-only. The parser recognizes four kinds:

- **heading** — ATX (`#` to `######`, a space, text, optional closing `#`s) or
  setext (a paragraph followed by a line of `=` or `-`). Level and text are
  stored; setext style is remembered and written back as setext.
- **paragraph** — consecutive non-blank lines that do not start another block.
  Text is stored verbatim, including internal line breaks and leading or
  trailing spaces on lines (trailing double-space is a Markdown hard break).
- **card** — a paragraph whose text has card syntax (§5), or a list item
  whose text has it (§5.2). Same verbatim rule.
- **raw** — anything else, verbatim: fenced code, indented code, lists (but
  their card items, §5.2), block quotes, tables, thematic breaks, HTML blocks,
  comments that are not ours. A raw block ends at a blank line, except fenced
  code, which ends at its closing fence, and multi-line comments, which end
  at `-->`.

A paragraph is interrupted (ended without a blank line) by an ATX heading, a
fence, a comment line, a thematic break, a block quote, a bullet item, or a
`1.`/`1)` item, matching CommonMark; except that after a line that is
exactly `?` or `??`, item lines are the card's back (§5, *steps*).

Blank lines between blocks are not stored; the serializer writes exactly one.
Whitespace inside a block is verbatim. A file the app has written round-trips
byte for byte. A file written by hand with, say, two blank lines between
paragraphs is normalized the first time the app writes it, once.

An image is Markdown's, `![alt](src)`, in a paragraph of its own or inside
one; a relative `src` is a file in the vault (§1). A page of ink is an
image like any other, `![working](name/ink-01.png)`, with the drawing it
was made from beside the picture under the same name,
`name/ink-01.pkdrawing` (PencilKit's `PKDrawing` data), so the page can be
drawn on again; the PNG is what every other tool reads. There is no syntax
for it: a `.png` with a `.pkdrawing` of its name beside it is a page of
ink, and without the `.pkdrawing` it is a picture. Since milestone 82 the
app makes no new page of ink in a typed note: handwriting has a document of
its own (§3, *Written notes*). The pages of ink a note already holds are
read, drawn, written on and exported as before.

Nothing inside a block is escaped by this format. Math (`$…$`, `$$…$$`),
editorial marks (`[like this]`, `#TODO:`), and Markdown emphasis are literal
text the app renders as it sees fit. The only characters this format gives
meaning to inside a paragraph are listed in §5 and §6.

## 5. Cards

A card is a paragraph. What makes it a card is its text, so a card written by
hand in any editor is a card the moment the app reads the file. Detection runs
in this order:

1. **cloze** — the text contains at least one blank `{{…}}` (§5.1).
2. **q&a, multi-line** — a line that is exactly `?`, with text before and after.
3. **bidirectional, multi-line** — the same with `??`.
4. **bidirectional, inline** — ` ::: ` with non-empty text on both sides.
5. **q&a, inline** — ` :: ` with non-empty text on both sides.

The separators must have whitespace on both sides, so `std::vector` in prose
is prose. Only the first separator splits. Text before it is the front (or left
side), text after is the back (or right side), each trimmed.

```
what does the learn drive reward? :: integration of new patterns into prior knowledge ^cmar-drive

der Vorsatz ::: resolution; intention ^cv-vorsatz

why does a card built from un-integrated material keep failing?
?
the recall has no scaffolding to attach to — every review re-encodes
the fact instead of retrieving it ^cw3-leech
```

A bidirectional card ("both ways") is one card tested in two directions, each
scheduled apart: its bare `sr` line is front to back (left side asked, right
side answered), an `sr r` line back to front (§6.2). The two directions of one
card are siblings: the app shows one of them a day, not both, unless asked.

**Steps.** In a paragraph that has a `?` or `??` line, the item lines after
it (`1.`, `2)`, `- `, at any number) no longer end the paragraph: they are
the back, as written, so a derivation's steps sit under its question. Before
the separator an item line still ends the paragraph, as in CommonMark. A
paragraph with no text after its separator is no card (the line needs text
on both sides), which is why the rule takes nothing from prose: `?` alone on
a line followed by a list was a dangling `?` before.

```
derive ⟨E⟩ for the two-level system
?
1. $\langle E \rangle = -\partial_\beta \ln Z$
2. $= \epsilon / (e^{\beta\epsilon} + 1)$
```

**Tables in a face.** A pipe line does not end a paragraph, so a face on
lines around `?` or `??` can hold a GFM table, written as it is anywhere
else, and the app draws it as one (a conjugation chart, a sarf table).
Nothing new is parsed: the table is the face's text, verbatim. The corpus
file is `faces/sarf.md`.

```
the past of كَتَبَ, third person
?
| | singular | dual | plural |
|---|---|---|---|
| m | كَتَبَ | كَتَبَا | كَتَبُوا |
| f | كَتَبَتْ | كَتَبَتَا | كَتَبْنَ |
```

Cards live in paragraphs and in list items (§5.2). `{{c1::x}}` inside a
table, a block quote, a heading, or a code block is literal text.

### 5.1 Cloze blanks

```
{{c1::answer}}      numbered blank, group 1
{{1::answer}}       same
{{answer}}          unnumbered blank
```

- A blank opens at `{{` and closes at the `}}` that is its own: the first
  `}}` after it that does not close a blank opened inside it. The text
  between is the inner text; it must contain a non-whitespace character or the
  braces are literal.
- A blank may hold blanks: `{{c9::a {{c1::b}} c}}` is the blank 9 over
  `a b c` and, inside it, the blank 1 over `b`. Braces pair from the inside
  out, so with one `}}` for two `{{` the inner pair is the blank and the
  outer `{{` is text. Asked, a blank hides everything in it, the blanks it
  holds included; while a blank inside is asked, the one around it is shown.
  Where blanks are counted (an unnumbered blank's place), one that holds
  others comes before them.
- If the inner text starts with `c` or nothing, then digits, then `::`, the
  digits are the group number and the rest is the answer. Otherwise the whole
  inner text is the answer (so `{{std::vector}}` is an unnumbered blank whose
  answer is `std::vector`).
- Math is a span of its own to blank scanning. Inside `$…$` or `$$…$$` only
  the numbered form opens a blank: `{{cN::` or `{{N::`. The unnumbered `{{x}}`
  is TeX (`\binom{n}{{k}}`, `x^{{a}}`), since `{{` is legitimate there and
  `{{c1::` never is. A blank inside math closes at the `}}` that balances the
  braces opened since `::`, not the first one, so `{{c1::x^{2}}}` has the
  answer `x^{2}` and `{{c1::\frac{a}{b}}}` the answer `\frac{a}{b}`; a
  backslash escapes the brace after it. A blank whose braces never balance
  before the formula ends, or whose answer closes the formula early
  (`$E = {{c1::m$ c^2}}$`), is TeX, not a blank. The answer is TeX too, so a
  blank can span a line of an `align` environment, alignment mark and all.
  Math inside an answer outside math is opaque as before:
  `{{c1::$x^{a^{b}}$}}` is one blank whose answer is `$x^{a^{b}}$`.
  Math delimiters follow Pandoc: an opening `$` is followed by a non-space, a
  closing `$` is preceded by a non-space and not followed by a digit, inline
  math does not span lines. `$5 and $10` is not math.
- Outside math there is no escape for `}}` inside an answer. Write `} }`.
- Blanks with the same number form one group and are tested together. Each
  unnumbered blank is its own group. Groups are scheduled separately (§6.2).
  An unnumbered blank has no key a schedule can name, so the app numbers it
  (`{{x}}` → `{{cN::x}}`, lowest unused N) the first time it writes that
  blank's schedule. The parser never renumbers.
- Anki-style hints (`{{c1::answer::hint}}`) are not recognized; the answer
  would be `answer::hint`. A later extension.

### 5.2 Cards in list items

A list item whose own text is a card (by the detection above) is a card,
so class notes can hold cards where they were typed:

```
- dof :: 3N − k
- holonomic :: constraint is $f(q,t) = 0$ ^cm-holo
  <!-- sr due=2026-11-01 st=review s=4 d=5 r=2 l=0 ivl=4 -->
- not a card, just an item
  - nested :: a card under it
1. Kepler's second law: equal {{c1::areas}} in equal {{c2::times}}
   <!-- sr c1 due=2026-11-04 -->
```

- **The item.** Its first line is spaces (any number; a nested item is set
  in), a marker (`-`, `*`, `+`, or 1–9 digits and `.` or `)`), one to four
  spaces, then text. That prefix is kept as written (`item` in the model)
  and the card's text is the rest. A marker followed by five spaces or
  more starts code inside the item, a tab after the marker or in the
  indentation is not read, and a task item (`- [ ] `, `- [x] `) is never a
  card: each stays raw.
- **Its lines.** The lines after the first that are set in to the item's
  content column (the prefix's width), in spaces, continue its text, that
  many spaces taken off each. The text ends at an annotation line, at
  another item (a nested one too: children are items of their own, not the
  card's), or at a line that would end a paragraph (a heading, a fence, a
  quote, a comment, a rule). After a `?` or `??` line, items set in to the
  content column are the back's steps, as in a paragraph (§5).
- **A lazy line** (a following line that is not set in and would not end a
  paragraph, which CommonMark reads as the item's text) makes the item no
  card: its text could not be written back as it was. The item stays raw
  with the rest of the list.
- **Annotations** (`^id`, `sr`, `extract`, §6) follow the card item as they
  follow a paragraph card: the `^id` at the end of its last line, the
  comment lines directly under it. They are read at any indentation and
  written at the content column, so a renderer keeps them inside the item.
  An annotation line under an item that is no card is an orphan: kept, as
  text of the list, with a diagnostic.
- **Fences.** A fence inside a list item runs to its closing fence and
  nothing inside it is a card, even a line that looks like an item.
- **The list around it.** What is not a card in the list stays raw,
  verbatim, in pieces between the card items; each piece and each card
  after the list's first block is *joined* (`joined` in the model): the
  serializer writes it directly under the block before, no blank line, so
  the list is written back as one. A join the edits around it have broken
  (the list's first item deleted, a paragraph now before it) is written
  with a blank line instead, so a card item is never glued to prose.
- `pos` (§3) counts the raw pieces of a list a card item splits as prose
  blocks of their own, since they are blocks; a list that gained a card
  item above a source's marker shifts it by one, as an inserted paragraph
  does.

## 6. Annotations

Annotations are the lines the app owns. They sit directly under the paragraph
(or, for a section's `read` line, the heading, §6.5) they belong to, one per line, no blank line between; under a card item, set
in to the item's content column (§5.2). A blank line breaks the
attachment on purpose: if someone deletes a card's text and leaves its
schedule, the orphan must not glue itself to the card above.

Canonical order under a card: the `^id` on the last text line, then bare `sr`,
then `sr r`, then `sr cN` ascending, then `extract` lines. Any order is read. A line that is
not an annotation (another comment, junk) ends the run: annotations after it
are orphans.

### 6.1 Block id `^id`

`^` followed by `[A-Za-z0-9_-]+` at the end of a paragraph's last line,
preceded by whitespace, or alone on a line directly after it (Obsidian's two
forms). Stripped from the text and stored as `id`. Written back as ` ^id` on
the last line, or alone on the next line when the last line is empty or ends
in whitespace, so that whitespace survives. Paragraphs and cards may carry ids; headings and raw blocks do
not (their `^…` is literal). The app assigns an id to a card the first time it
writes a schedule line for it (a grade, `got it`, a suspension, a priority of
its own) and never changes it; the id is how the tree, the queue, and extract
backrefs refer to a card. The id is `c` and six characters made from the
document's path, the card's text, and which of the document's cards with
that text it is, so two devices that each write the card's first line before
they sync give it the same id. Ids written before this, at random, stay.

### 6.2 Schedule `<!-- sr … -->`

```
<!-- sr due=2026-05-27 st=review s=11.8 d=4.2 r=14 l=2 ivl=12 last=2026-05-15T09:15:00Z g=3 -->
<!-- sr c2 due=2026-06-01 st=new -->
<!-- sr r due=2026-06-03 st=review s=4.1 d=6 r=3 l=1 ivl=4 last=2026-05-30T08:00:00Z g=3 -->
```

`sr` then an optional key, then attributes (§7). The key is a group key `cN`
(also read as `N`) or the direction key `r`. A comment without a key is the
card's own schedule; with a group key, the schedule of that cloze group; with
`r`, the schedule of a both-ways card's back-to-front direction. A card has at
most one of each; a duplicate key is resolved later-wins with a diagnostic.

| attr    | type                   | ts-fsrs field     | note                                     |
| ------- | ---------------------- | ----------------- | ---------------------------------------- |
| `due`   | day or instant         | `due`             | a day means the start of that local day |
| `st`    | `new` `learning` `review` `relearning` | `state` | default `new`                   |
| `s`     | number ≥ 0             | `stability`       | days                                     |
| `d`     | number ≥ 0             | `difficulty`      | 1–10 in FSRS                             |
| `r`     | int ≥ 0                | `reps`            |                                          |
| `l`     | int ≥ 0                | `lapses`          |                                          |
| `steps` | int ≥ 0                | `learning_steps`  | omitted when 0                           |
| `ivl`   | int ≥ 0                | `scheduled_days`  | last interval                            |
| `last`  | day or instant         | `last_review`     |                                          |
| `g`     | int 1–4                |                   | last grade: again hard good easy         |
| `seen`  | instant                |                   | learnt, not yet tested: shown answered and got (`got it`), then |
| `pri`   | int 0–100              |                   | the card's own priority, over the document's (§3) |
| `sus`   | bool, written `1`      |                   | suspended: out of the queue, the session, and the counts |
| `link`  | id `[A-Za-z0-9_-]+`    |                   | the card with that `^id` tests the same fact: one schedule for both (below) |

Every attribute is optional. A card with no `sr` line at all is a new card,
due now; so is a card whose bare line carries only `pri`. `pri` belongs to the
card, so it sits on the bare line only: on an `sr cN` line it is dropped with
a diagnostic. Grading rewrites the schedule and carries `pri` across.
`sus=1` suspends: on the bare line the whole card, on an `sr cN` line that
group alone. A suspended card or group keeps every other attribute and is
left out of the queue, any session, and the queue's counts until the app
removes the attribute (unsuspend); it is still listed where its document's
cards are. `sus` is read as a bool and written only as `sus=1`; a `sus=0`
says what absence says and is dropped on the first write (§8). A card with
only `sus=1` on its bare line is a new card, suspended.
`seen=<instant>` says the card was shown answered, to learn, and
acknowledged (`got it`) at that instant, and has not been tested. It is
written only on a line with no review, on the line the card asks (bare,
`sr r`, `sr cN`), and the first grade drops it. A card whose line carries it
is still a new card, due now, counted and held as one; the app asks it as a
test and does not show it to learn again, on any device, on any day. On a
line that has a review it means nothing. In a merge a line with a review is
later than one with only `seen`; of two with only `seen`, the later. Two
lines of one card each written on one side of a merge are both kept; a line
one side took away and the other changed stays; a block reworded on one
side with only its schedule lines changed on the other takes the words of
the one and the lines of both.
 `elapsed_days` is not stored; the scheduler derives it from `last`.
Unknown attributes are kept in order after the known ones. A known attribute
with an unparsable value is dropped with a diagnostic; the rest of the line
survives.

**Both ways.** A bidirectional card's bare line is its front-to-back
direction and the card's own line; `sr r` is back to front, with its own
state, `pri`, and `sus`. `f` is read as a key that says the bare line
(`sr f` is `sr`) and written bare (§8). A card with no `sr r` line has a
reverse that is new and due now, whatever its bare line holds: a bare line
written before directions were scheduled apart (one line per both-ways card)
keeps its history as the forward, and nothing is copied to the reverse, since
the app showed only the front-to-back side then and the reverse was never
reviewed. `pri` on the `r` line is the reverse's own, over the card's (the
bare line's), over the document's. `sus=1` on the bare line suspends the card,
both directions; on the `r` line the reverse alone. An `sr r` line on a card
that is not both ways is kept, with a diagnostic, and means nothing until the
card is both ways again. `r` with a group key on one line takes the first
and drops the other with a diagnostic.

**Siblings.** The two directions are not shown on the same day: when both
are due, the one due first (the forward on a tie) is shown and the other is
buried until the next day; once one has been reviewed today, the other is
buried until the next day. Burying is the queue's, derived from `due` and
`last`; nothing is written, so grading one direction rewrites its line alone.
A session asked to include what is not due (cram) shows both.

**Links.** `link=<id>` on a card's bare line says the card with that `^id`
(§6.1, anywhere in the vault) tests the same fact: the person kept both
cards, where they are, and asked for them to be studied as one. The app
writes it on both cards, each naming the other; either side alone is
enough to hold the link, so a sync that brings back one file still has it.
The rules:

- A link joins bare lines. It holds between two cards each scheduled by
  its bare line alone: a q&a, a both-ways card (its front to back; the
  reverse stays its own), a cloze of one blank with no `sr cN` line for
  it. On a card of several blanks, or one whose blank has its own line,
  the attribute is kept and means nothing. On an `sr cN` or `sr r` line it
  is dropped with a diagnostic, as `pri` is on a group line.
- One schedule. Linking writes the stronger of the two schedules (more
  stability; then more reviews; a new card is the weakest) on both lines,
  each keeping its own `pri` and `sus`. Grading either card writes the new
  state to both bare lines, each keeping its own `pri`, `sus`, and `link`:
  the same state, not the same grade applied twice, so the two stay one
  schedule and a grade is counted once (one line in the review log, the
  graded card's). Lines that differ (a hand edit, a sync of one side) are
  made the same by the next grade.
- One a day. The two cards are siblings across files, as a both-ways
  card's directions are within one: when both are due, the one the queue
  shows first (lower priority, then due, then path and place) is shown and
  the other is buried until the next day; once one has been reviewed
  today, the other is buried. Burying is the queue's; nothing is written.
  A suspended card is out of the pair's reckoning; its partner is studied
  alone. A cram shows both.
- A link that names no card in the vault, or names the card itself, means
  nothing and is kept. Ids are the vault's to keep unique; when two files
  hold the named id, the first in path order is the partner.

Why the state is copied and not the grade applied to each: two schedules
graded alike drift apart (each grade lands on a different `last` and
stability) and would each come due on their own day, which is the cost a
link is there to remove.

A single-group cloze and a q&a use the bare form; a bidirectional card the bare
form and, once its reverse has been graded, an `sr r` line. A
multi-group cloze uses one `sr cN` line per group; a bare line on such a card
is allowed and kept, and the app may treat it as a fallback for groups without
their own line. Reviewing one blank rewrites one line.

An `sr` line that does not directly follow a card (it follows prose, a heading,
a blank line, or nothing; a heading carries only its section's `read` line,
§6.5) is an orphan: kept as a raw block, reported as a
diagnostic, never attached.

### 6.3 Extract backref `<!-- extract NAME -->`

The parent side of an extract. `NAME` is the child's filename without `.md`,
inside the parent's child directory. One name per line; several extracts from
one paragraph make several lines. The child carries `type: extract` and its
own `read` schedule in front-matter; nothing else links the two. A backref
whose child no longer exists is kept and rendered as nothing; so is one whose
child was moved out of the children directory: the line is not rewritten by
a move, only by a rename of the child in place. Duplicates are
collapsed with a diagnostic. An `extract` line after a heading or raw block is
an orphan, as in §6.2. Extract lines may follow prose paragraphs or cards.

### 6.4 Other comments

Any other HTML comment is a raw block. In particular the Obsidian
Spaced-Repetition plugin's `<!--SR:!2026-01-01,4,270-->` is not ours: the tag
is case-sensitive `sr` followed by whitespace or `-->`. Annotation comments
must be one line; a multi-line `<!-- sr` comment is raw.

### 6.5 A section that comes back `<!-- read … -->`

```
## pset 4 #5, typed up from paper
<!-- read made=2026-10-30 due=2026-11-02 ivl=3 -->
```

A `read` line directly under a heading (an ATX heading, or a setext
heading's underline) enrolls the **section**: the heading and every block
under it up to the next heading of the same or a higher level (fewer `#`s),
subheadings included. The section comes back on the reading loop's growing
interval, as a note revisited does (§3), until it is dismissed. Nothing
else marks the section: its text, its cards, and their `sr` lines are
ordinary blocks wherever the person writes them.

| attr    | type             | meaning                                                         |
| ------- | ---------------- | --------------------------------------------------------------- |
| `made`  | day              | when it was enrolled                                             |
| `due`   | day or instant   | when it comes back                                               |
| `ivl`   | int ≥ 0          | days between passes                                              |
| `reps`  | int ≥ 0          | passes made                                                      |
| `af`    | number ≥ 1.1     | growth, as on `read` (default 1.6, written only when not)        |
| `pri`   | int 0–100        | its own priority, over the document's `pri` field                |
| `boxes` | boxes, below     | where its passage is on the document's pages                     |

**Boxes.** `boxes` is one or more rectangles on the document's pages,
`,` between, no spaces:

```
boxes   := box ("," box)*
box     := page ":" x ":" y ":" w ":" h
page    := int ≥ 1, the PDF's own page number (as `pages` counts, §3)
x y w h := fractions of the page, 0–1, from its top-left corner
```

`x y` is the box's top-left corner, `w h` its width and height; a box has
some width and height and lies inside its page (to the rounding of three
decimals). Written to three decimals (`41:0.120:0.860:0.770:0.075,42:0.100:0.097:0.770:0.040`);
a value in the grammar written otherwise (`41:0.12:0.86:0.77:0.075`) is
written back canonically. A value not in the grammar is kept as written,
with a diagnostic, and draws nothing. The boxes are in the order they were
drawn; a passage's place in book order is its first box's (page, then `y`).
A section with `boxes` is a **boxed section**: its heading and what is
under it come back, and its boxes are drawn on the pages, tagged with the
heading. The app wrote them until milestone 81 (a `##` heading named from
the page, in book order) and writes none now; a note that holds them reads,
comes back, draws and is written back as it always did, and one may still
be written by hand.

**A passage.** Boxing a passage on the pages (`e`) writes nothing into any
note. The boxes are kept with the PDF, as an entry of its marks (§1,
`.ilmi/marks/<sha256>.json`, kind `passage`): its `boxes`, and the
attributes of the table above as the entry's fields, `made=<today>
due=<today+c> ivl=c` when it is made (`c` the cadence of the priority of
the document whose pages were open). It comes back, is passed, postponed,
dismissed and brought back by the rules below, as a section is, with two
differences that follow from its having no heading and no file: it is
known by its PDF and its boxes, not by a name; and dismissing always keeps
the entry (it has `boxes`), which only `remove` takes away. Its priority is
its own `pri`, else that of the document it is shown as an item of: of the
documents whose pages are that PDF, a chapter whose `pages` (§3) hold the
passage's first page, else the document of the whole PDF, else any chapter;
the first by path among equals. A passage whose PDF is in no document of
the collection waits, kept and out of the queue. The read point (§3) moves
past the last box when a passage is made. A passage boxed on a written
notebook's sheets (§3, *Written notes*) is kept the same way under the
notebook's id, `.ilmi/marks/<id>.json`; the page of each box is the sheet's
own number, and it is an item of the notebook.

Written in that order, unknown keys after. Enrolling writes `made=<today>
due=<today+c> ivl=c`, `c` the cadence of the section's priority (§3,
*Growth*: the line's own `pri`, else the document's, else 50; every other
day at the default). A pass (*next*) grows `ivl` by `af` from the longer
of `ivl` and the days since the pass before (`due − ivl`), so a section
sixty days late on `ivl=3` comes back in 101 days, not 5, and counts in
`reps`; a postpone (*later*) grows the stored `ivl` by the postpone factor
and does not count; neither touches `made`, `pri` or `boxes`.

**Dismissing** drops `due`, `ivl`, `reps` and `af`. The line stays only
when it has `boxes`, so the passage's place on the page is not lost;
otherwise the whole line is removed and the heading is plain again. A line
with no `due` and with `boxes` is therefore a dismissed section: kept, out
of the queue. A line with no `due` and no `boxes` (a bare `<!-- read -->`
written by hand) is enrolled and due now, as a bare `read:` is. *Bring
back* writes a fresh `due` on the cadence (`ivl=c`) and keeps the rest of
the line.

**Priority** is the document's `pri` field unless the line carries its own
`pri`. Unlike `pri=` on the front-matter `read` line (§3), it is not a
fallback and is never dropped.

**The heading** is whatever the person names it. A passage boxed by the
app before milestone 81 is named from the page; a section written by hand, or an extract
document converted into one, keeps its own words (the sample's `why the
Boltzmann factor — count the reservoir`, boxed over the page it came from,
with the extract's schedule on its line and its cards under it). The
sample's Lindqvist chapters and the classical prose reader's passage 12 are
converted this way: the book's text is on the pages (`pdf`, `pages`), the
body is the notes, and no extract document is left under them.

**A passage marked in a text source** (a clipping, an EPUB chapter: `e`
on a selection) is a section of the source's note, `notes.md` in the
source's children directory, made the first time with `title: <the
source's title> — notes`: a `##` heading named from the passage's first
words as an extract would be, its line `made=<today> due=<today+c> ivl=c`
(and the source's `pri`, whose cadence `c` is), a paragraph `from: <the source's title>` directly
under the heading, then the passage as paragraphs. The section owns the
text from then on; nothing goes back to the source but its marker, moved
past the passage. The `from:` line is ordinary prose the app reads back for
the inspector; the format gives it no meaning. A section moves to another
note as its blocks (the heading with its line, everything under it, cards
and `sr` lines with them), appended at the end. An extract document of a
text source (§6.3) can be folded into such a section the same way, its
`read` schedule becoming the heading's line (`made` its `imported` day);
the app offers this, never forces it.

**Rules.** One line per heading; a second is resolved later-wins with a
diagnostic. After anything but a heading (a paragraph, a card, a raw
block, a list item, a blank line, nothing) the line is an orphan: kept as a
raw block, reported, never attached, as in §6.2. A heading carries no
other annotation: an `sr` or `extract` line under a heading is an orphan.
A heading's text is not changed by the line. The front-matter `read`
field (a whole document read, or a whole note revisited) is a separate
thing and unchanged; a document may have both.

### 6.6 A clip `<!-- box … -->`

```
## p. 129

<!-- box 129:0.120:0.368:0.770:0.088 -->

دَكَاكِينُ ::: shops
```

A comment line of its own, `box` then one box in the grammar of §6.5, is a
**clip**: a passage of the document's pages kept in the notes as the crop
of its page, drawn there as the page itself, for what is clipped rather
than named (a passage in Arabic, whose text a PDF reader cannot give back
in order). It is a raw block (§6.4) like any other comment, attached to
nothing. The app writes it (`m` on a box) as a block of its own, under no
heading: after the block the caret is in when the note is open and the
caret was put there, else at the note's end; the card that follows it goes
below. It is the one thing the app writes into the note on a PDF, and
only when asked for a card. Until milestone 81 it was written under a
heading `## p. N`, made per page in page order; such headings are ordinary
headings and stay as they are. The page a block of the notes belongs to is
its own when it is a clip, else that of the nearest clip, boxed section
(§6.5: its first box's) or `## p. N` heading above it, the search ending
at any other heading of the first two levels. Written by hand a clip may sit anywhere; the sample's passage 12
keeps one directly under each boxed section's heading, where the passage's
words would have been, since the page's Arabic cannot be read back in
order, and one before each card made from the commentary under its page's
`## p. N`. A clip whose box is not in the grammar is an ordinary comment.
In a note attached to a written notebook (§3, *Written notes*) a clip is
the crop of the notebook's sheet, and the page of its box is the sheet's
own number: `<!-- box <sheet>:x:y:w:h -->`.

## 7. Attributes

The one small grammar shared by `sr` comments, a section's `read` line
(§6.5), and the `read`/`write` fields:

```
attrs := (token whitespace)* token?
token := key "=" value | bare
key   := [A-Za-z_][A-Za-z0-9_-]*
value := [^ \t]+        (no quoting; values never contain whitespace)
bare  := [^ \t=]+       (only the sr group key is a legal bare token)
```

Written with single spaces, known keys first in the order the tables give,
unknown keys after in their original order. A bare token where none is allowed
is dropped with a diagnostic. `key=` with an empty value is dropped with a
diagnostic.

Value types:

- **day** `YYYY-MM-DD`.
- **instant** `YYYY-MM-DDTHH:MM:SSZ`, always UTC. `HH:MMZ` is read and
  normalized to include seconds.
- **number** `-?\d+(\.\d+)?([eE][-+]?\d+)?`, written as JavaScript's shortest
  round-trip decimal (`11.80` becomes `11.8`). The app stores scheduler output
  at that full precision, so a card read back is exactly the card ts-fsrs
  computed; the format does not care.
- **int** a number with no fractional part.
- **bool** `true`/`false`, also read as `yes`/`no`/`1`/`0`.

## 8. What the serializer normalizes

The first time the app writes a hand-made file, these change, and only these:

- CRLF → LF; BOM dropped; exactly one trailing newline.
- Blank-line runs between blocks → one blank line; whitespace-only lines →
  empty.
- ATX heading spacing and closing `#`s → `## text`. A heading whose text is
  all `#`s or ends in space + `#`s keeps an explicit closing ` #`, since
  without it the text would be read as the closing sequence.
- `^id` on its own line → ` ^id` on the last text line.
- A section's `read` line → directly under its heading, canonical spacing
  and key order (§6.5); its `boxes`, when in the grammar, to three decimals.
- Annotation comments → canonical spacing, key order, value formatting, and
  order under the card. Duplicates collapsed. Under a card item they are
  set in to its content column (§5.2), whatever indentation they had.
- Known front-matter fields → canonical `key: value`; trailing comments on
  them dropped; a blank line after the closing `---`.
- A `pri=` on the `read` or `write` line → dropped, when the file has a `pri`
  field (§3). Without the field it stays.
- An `af=` on the `read` or `write` line, or on a section's `read` line
  (§6.5), equal to that loop's default → dropped.
- A `sus=0` (or `sus=false`) on an `sr` line → dropped; `sus=true` → `sus=1`.
- `sr f` → `sr` (the bare line is the forward).
- A body with no front-matter whose first block is a `---` thematic break, or
  whose first character is a stray U+FEFF, gets one leading blank line, so the
  file is not read back as front-matter or as a byte-order mark.

Nothing else. Prose, raw blocks, unknown front-matter lines, unknown
attributes, and line breaks inside paragraphs are untouched.

## 9. Diagnostics

`parse` returns `{ doc, diagnostics }`. A diagnostic is `{ line, message }`
with a 1-based line number. The doc is always usable; diagnostics say what was
degraded so the UI can show a quiet mark. Since orphans and raw lines are
preserved verbatim, the same diagnostics recur on every parse until the person
fixes the file. That is intended.

## 10. Out of scope, for now

- Cards inside tables or block quotes.
- RemNote's `>>>`, a card whose back is its child items.
- Cloze hints.
- Prose block ids for the reading marker (would make `pos` edit-stable).
- Attachments and images beyond a clipping's downloads and a page of ink
  (§1, §4): they are just Markdown; the app renders them.
- Ink anywhere but a written notebook's sheets, a PDF's pages (both under
  `.ilmi/ink/`, §1) and the pages of ink a typed note already holds (§4):
  in a card's face, or among a typed note's lines.
- A written notebook's sheets in any size but Letter and A4, sheets of two
  sizes in one notebook, and text recognised from what is written: to type
  up what is written, a typed note is attached to the notebook (§3).
- Anything written into a PDF: highlights are the extracts' stored text,
  found again on the page; annotations stay in the Markdown.

## 11. Corner cases worth knowing

- A `$$` display-math block on its own lines is one math span. A numbered
  `{{cN::…}}` inside it is a blank (§5.1) and the paragraph is a cloze card,
  rendered as one formula; an unnumbered `{{…}}` inside it is TeX and the
  paragraph is prose.
- A tab or four spaces at the start of a block is indented code (raw). The
  same indentation on a paragraph's second line is lazy continuation and stays
  in the paragraph.
- A `---` at the top of a file with no closing `---` is a thematic break, and
  the raw block it starts runs to the next blank line.
- Trailing spaces on a paragraph's last line are preserved (see §6.1) even
  though Markdown gives them no meaning there.
