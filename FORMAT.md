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
   directly under the card. Grading rewrites that line and nothing else.
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
  german.md                  a deck (type: deck in front-matter)
  essays/
    spaced-composition.md    a draft (type: draft)
  .ilmi/                     app-private state, never required
```

- A directory is a folder. A `.md` file is a document. Anything else is ignored.
- Directories whose name starts with `.` are ignored (`.ilmi`, `.git`,
  `.obsidian`).
- `name.md` next to a directory `name/` means the directory holds that
  document's children. Today the only children are extracts.
- A document's display name is its filename without `.md`, unless front-matter
  sets `title`.
- Folder open/closed state, window layout, and other view state live in
  `.ilmi/`, not in the files. Reading position does live in the file (§3).

## 2. File shape

```
---
type: source
frozen: true
imported: 2026-04-18
read: due=2026-06-01 ivl=9 reps=4 pos=12 pri=3
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
| `type`         | `source` `deck` `draft` `extract` | `source` | what lens opens the file                                     |
| `title`        | string                      | filename  | display name                                                       |
| `frozen`       | `true` `false`              | `false`   | prose is locked; cards stay editable                               |
| `imported`     | day                         |           | when the source came in                                            |
| `started`      | day                         |           | when the draft began                                               |
| `read`         | attributes (§7)             |           | enrolled in incremental reading                                    |
| `write`        | attributes (§7)             |           | enrolled in incremental writing                                    |
| `default-card` | `cloze` `qa` `bidir`        |           | what the composer opens to, for decks                              |

`read` attributes: `due` (day or instant), `ivl` (days between passes, int),
`reps` (passes made, int), `pos` (prose blocks read, int), `pri` (int). `pos`
counts prose blocks from the top of the body, skipping cards; hand-inserting a
paragraph above the marker shifts it by one, which is the accepted trade for
not tagging every paragraph with an id.

`write` attributes: `due`, `ivl`, `reps`, `pri` as above, plus `done`
(`true`/`false`). A done draft keeps its line so it can be reopened.

A bare `read:` or `write:` with no attributes means enrolled with nothing
recorded yet; the app fills it in on the first pass. YAML block-style nesting
under it (`read:` then indented `due: …` lines) is not read: the indented lines
are kept verbatim, ignored, and reported.

A known key whose value does not parse (`frozen: maybe`, `type:` with nothing
after it) is kept as a raw line with a diagnostic, and the field takes its
default.

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
- **card** — a paragraph whose text has card syntax (§5). Same verbatim rule.
- **raw** — anything else, verbatim: fenced code, indented code, lists, block
  quotes, tables, thematic breaks, HTML blocks, comments that are not ours. A
  raw block ends at a blank line, except fenced code, which ends at its closing
  fence, and multi-line comments, which end at `-->`.

A paragraph is interrupted (ended without a blank line) by an ATX heading, a
fence, a comment line, a thematic break, a block quote, a bullet item, or a
`1.`/`1)` item, matching CommonMark.

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

A bidirectional card is one card with one schedule. Per-direction schedules are
a possible later extension (`<!-- sr fwd … -->`).

Cards live only in paragraphs. `{{c1::x}}` inside a list item, a table, or a
code block is literal text.

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
- Math is opaque to blank scanning. Neither `{{` nor `}}` inside `$…$` or
  `$$…$$` opens or closes a blank, whether the math sits in prose or inside an
  answer. `{{c1::$x^{a^{b}}$}}` is one blank whose answer is `$x^{a^{b}}$`.
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

## 6. Annotations

Annotations are the lines the app owns. They sit directly under the paragraph
they belong to, one per line, no blank line between. A blank line breaks the
attachment on purpose: if someone deletes a card's text and leaves its
schedule, the orphan must not glue itself to the card above.

Canonical order under a card: the `^id` on the last text line, then bare `sr`,
then `sr cN` ascending, then `extract` lines. Any order is read. A line that is
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
```

`sr` then an optional group key `cN` (also read as `N`), then attributes (§7).
A comment without a group key is the card's own schedule; with one, it is the
schedule of that cloze group. A card has at most one of each; a duplicate key
is resolved later-wins with a diagnostic.

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

Every attribute is optional. A card with no `sr` line at all is a new card,
due now. `elapsed_days` is not stored; the scheduler derives it from `last`.
Unknown attributes are kept in order after the known ones. A known attribute
with an unparsable value is dropped with a diagnostic; the rest of the line
survives.

A single-group cloze, a q&a, and a bidirectional card use the bare form. A
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
whose child no longer exists is kept and rendered as nothing. Duplicates are
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
  round-trip decimal (`11.80` becomes `11.8`). The app rounds scheduler output
  to two decimals before storing; the format does not care.
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
  order under the card. Duplicates collapsed.
- Known front-matter fields → canonical `key: value`; trailing comments on
  them dropped; a blank line after the closing `---`.
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

- Cards inside list items or tables.
- Cloze hints.
- Per-direction schedules on bidirectional cards.
- Prose block ids for the reading marker (would make `pos` edit-stable).
- Attachments and images (they are just Markdown; the app renders them).

## 11. Corner cases worth knowing

- A `$$` display-math block on its own lines is one math span, so a `{{…}}`
  inside it is not a blank and the paragraph is prose.
- A tab or four spaces at the start of a block is indented code (raw). The
  same indentation on a paragraph's second line is lazy continuation and stays
  in the paragraph.
- A `---` at the top of a file with no closing `---` is a thematic break, and
  the raw block it starts runs to the next blank line.
- Trailing spaces on a paragraph's last line are preserved (see §6.1) even
  though Markdown gives them no meaning there.
