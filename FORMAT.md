# ilmi on-disk format

A vault is a directory of Markdown files. The app is a viewer over them, never
their owner: open any file in a text editor, change it, and the app picks it up.
This document is the contract. `src/format/` implements it; the round-trip
tests in `src/format/__tests__/` hold it to the fixed point
`parse(serialize(parse(x))) = parse(x)` for every file in the corpus, including
hand-mangled ones.

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
  names another file wins. A `.pdf` with no `.md` beside it is ignored like
  any other file.
- Any other file in a document's children directory is ignored by the walk.
  A clipped page's images land there (`name/img-01.png` …, §3 `url`) and the
  document refers to them relatively, `![alt](name/img-01.png)`.
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
  the app (`anki` for an imported revlog). Keys are written in that order;
  unknown keys are ignored on read. It is built for sync: lines are only
  appended, never rewritten, so two devices add theirs to the same month;
  every `.jsonl` in the directory is read (a sync tool's conflict copy
  too); a line seen twice (the same `at`, `card`, `key`, and `g`) counts
  once; a line that does not read as one (torn by a crash, junk) is
  skipped. A card moved to another document is found again by its id when
  its old document is gone.
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
| `frozen`       | `true` `false`              | `false`   | prose is locked; cards stay editable                               |
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
`reps` (passes made, int), `pos` (prose blocks read, int), `page` (int ≥ 1),
`af` (growth, number ≥ 1.1, default 1.6), `pri` (int 0–100).
`pos` counts prose blocks from the top of the body, skipping cards;
hand-inserting a paragraph above the marker shifts it by one, which is the
accepted trade for not tagging every paragraph with an id. On a document
with pages, `pos` is the page the ruler is on instead, counted from 1; the
same attribute, so nothing else changes. On a note, `read` means
*revisited*: the note comes back on the same growing interval, but each pass
starts at the top or at a heading the person picks, since a note's own edits
would shift a position; its line keeps `due`, `ivl`, `reps`, `af` (and the
older `pri=`) and has no `pos`. A `pos` written there by hand is kept as
written and means nothing; the app drops it on the next pass. `page` sits on an extract carved
from a page of its parent's PDF and names that page; it means nothing on
any other line and is kept as written.

**Pages.** `pdf` names a file relative to the document, written plain or
quoted like `title`. A document with pages keeps what came out of them in
its body under one heading per page, `## p. <n>`, which the app adds the
first time something lands on that page: a card made from the page goes
under it, and an extract carved from the page leaves the passage there as a
paragraph carrying the `<!-- extract NAME -->` backref (§6.3), while the
child carries `page=<n>` on its `read` line. The heading is ordinary
Markdown; the format gives it no meaning beyond the convention, and a
hand-written `## p. 3` is the same heading. A `pdf` that names a missing
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

**Clippings.** A page that came in by its address carries `url`, and
`author` and `published` when the page said. `url` and `author` are written
plain or quoted like `title`; `published` is a day or a UTC instant, as the
attributes' value types (§7) have them. Nothing else reads them: they are
what the inspector shows and what a reader of the file wants to know.

`write` attributes: `due`, `ivl`, `reps`, `af` (default 1.5), `pri` as above,
plus `done` (`true`/`false`). A done draft keeps its line so it can be
reopened.

**Growth** is SuperMemo's A-factor: each pass multiplies the interval by
`af`, rounded, never below one day. `af` is written only when it is not the
default; a value below 1.1 is dropped with a diagnostic, and the default
value, if written by hand, goes on the first write (§8).

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

Cards live in paragraphs and in list items (§5.2). `{{c1::x}}` inside a
table, a block quote, a heading, or a code block is literal text.

### 5.1 Cloze blanks

```
{{c1::answer}}      numbered blank, group 1
{{1::answer}}       same
{{answer}}          unnumbered blank
```

- A blank opens at `{{` and closes at the **first** `}}` after it. The text
  between is the inner text; it must contain a non-whitespace character or the
  braces are literal.
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
they belong to, one per line, no blank line between; under a card item, set
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
writes a schedule for it and never changes it; the id is how the tree, the
queue, and extract backrefs refer to a card.

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
only `sus=1` on its bare line is a new card, suspended. `elapsed_days` is not stored; the scheduler derives it from `last`.
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
a blank line, or nothing) is an orphan: kept as a raw block, reported as a
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

## 7. Attributes

The one small grammar shared by `sr` comments and the `read`/`write` fields:

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
- Annotation comments → canonical spacing, key order, value formatting, and
  order under the card. Duplicates collapsed. Under a card item they are
  set in to its content column (§5.2), whatever indentation they had.
- Known front-matter fields → canonical `key: value`; trailing comments on
  them dropped; a blank line after the closing `---`.
- A `pri=` on the `read` or `write` line → dropped, when the file has a `pri`
  field (§3). Without the field it stays.
- An `af=` on the `read` or `write` line equal to that loop's default → dropped.
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
- Attachments and images beyond a clipping's downloads (§1): they are just
  Markdown; the app renders them.
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
