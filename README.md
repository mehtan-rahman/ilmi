# ilmi

Incremental reading, spaced-repetition cards, and incremental writing over a
directory of plain Markdown files. The files are the model; the app is a lens.

- `FORMAT.md` is the on-disk contract. `src/format/` implements it.
- `spec/hashiyah/` is the hi-fi prototype: the decided spec for behavior and feel.
- `PLAN.md` is the build order.

## Running

Requires node (Homebrew: `/opt/homebrew/bin`) and a Rust toolchain
(`curl https://sh.rustup.rs | sh`, then `~/.cargo/bin` on `PATH`).

```
npm install
npm run tauri dev      # desktop window; first Rust build takes a few minutes
npm run dev            # renderer only, in a browser at http://localhost:1420
npm test               # format round-trip and vault tests
npm run typecheck
npm run import-sm -- <collection.kno> <vault-dir>   # a SuperMemo collection, once
npm run fixture:pdf    # regenerate the corpus's two-page PDF
npm run fixture:anki   # regenerate the two-deck Anki package and its JSON (cargo)
npm run fixture:epub   # regenerate the three-chapter EPUB and its JSON (cargo)
```

The import reads a SuperMemo collection's data files (`src/import/supermemo/LAYOUT.md`
says which bytes, and on whose word) and lands its tree as folders, topics as
sources and extracts, items as cards, tasks as drafts, with their schedules
and priorities; what the layout notes do not cover is printed, never written.

The app opens on the vault it had open last; the welcome (the wordmark, `open
vault`, `new vault`, and the vaults opened before as rows) shows when there is
none, when that folder is not where it was, or when `reopen the last vault on
start` is off in the tweaks. A new vault starts with `start here.md`, one short
source with a card in it. While a vault is open the palette has `open vault…`,
`new vault…`, `close vault`, and the other recent vaults under `vaults`.

In a dev build, `ILMI_VAULT=/path/to/vault npm run tauri dev` opens that vault
at launch instead of asking for one. Add `ILMI_SMOKE=1` to run every tree
operation against that vault through the Tauri fs adapter and log the results
to the terminal; use a scratch copy, it creates and deletes files.
`ILMI_SMOKE=welcome` runs before any vault opens and walks the welcome instead,
seeding its rows with `ILMI_VAULT`.

## Keys

```
⌘K               palette: open anything by name, or run a command
click            open a folder or document in the active tab
⌘-click          open in a new tab      ⌘⇧-click   open in the next pane
F2 / dbl-click   rename                 right-click  new, rename, move to, delete
⌘W               close tab              ⌘\           split pane
⌘⇧E              sidebar                ⌘⇧I          inspector
⌘,               tweaks: theme, accent, density, reopen the last vault on start
                 (kept outside the vault); the day's budget and where clippings
                 go (kept in the vault's .ilmi)

on the welcome   ⏎ open the selected vault, j k move, o open vault, n new vault;
                 a folder dropped on it opens as a vault

in a source      select, then e extract or m make a card; r start reading
in a PDF         the same on a page; / search, g go to a page, [ ] pages;
                 text in the meta row reads the Markdown instead
in a deck        j k move, ⌫ delete the selected card, m make a card;
                 × on a row, or right-click, also deletes one; right-click moves it to another deck
in the queue     j k move, ⏎ enter, o open one
in a session     [ ] prev / next; space reveal, 1-4 grade; ⏎ read on or
                 worked on it, p postpone, d done
```

A PDF dropped on the intake lands as a pair, `name.pdf` beside `name.md`: the
Markdown is the document (schedule, priority, cards, extracts), the PDF its
pages, read in place through pdf.js and never written. Cards and extracts made
from a page sit under a `## p. <n>` heading in the Markdown and in a rail
beside the page; an extract's passage is drawn on the page as a highlight
when it is found there again. The ruler in the margin marks the page.

Text pasted or dropped on the intake that reads as a list of cards lands as a
deck: a row chooses what separates front from back (`Q:`/`A:` lines, a tab,
` :: `, a dash, a comma, or anything typed) and what separates cards (a blank
line, a newline, a semicolon, or anything typed), detected from the text and
changed with a click; `both directions` writes `:::`. An Anki text export is
read by its header, HTML reduced to text; its hints, sounds, and images are
dropped and counted. Lines that did not split stay at the end of the file
under `## not cards`.

An Anki package (`.apkg`) dropped on the intake is read on the Rust side
(`src-tauri/src/anki.rs`: the zip, the SQLite collection, zstd when it is
compressed) and listed deck by deck; `place` writes one deck file per Anki
deck, `Parent::Child` as `Parent/Child.md`. A basic note is `front :: back`,
a reversed note `:::`, a cloze note its text with the blanks kept; a review
card's progress seeds the card's `sr` line (due, interval, reps, lapses, a
difficulty from the ease). Hints, sounds, images, a reversed note's second
schedule, and empty notes are dropped and counted; media is not copied.

A book in EPUB dropped on the intake is read on the Rust side too
(`src-tauri/src/epub.rs`: the container, the package file, the navigation
document or the NCX) and listed chapter by chapter; `place` makes a folder
named for the book and writes one frozen source per spine item in reading
order, `NN title.md`, the title from the table of contents, else the
chapter's first heading. Headings, emphasis, lists, and quotes are kept,
links become their text; the cover and other pages under thirty words, the
images (a `[figure: alt]` mark stands where one with alt text was), and
footnote back-references are dropped and counted. Nothing is scheduled;
`r` on a chapter starts reading it.

A blank can sit inside a formula: `$y = {{c1::x^{2}}}$`, or a whole line of
an `align` environment. Inside math only the numbered form is a blank and it
closes at the braces that balance, so `\binom{n}{{k}}` stays TeX. The formula
is rendered once with the blank as a box, then with the answer on the accent;
in the composer, `⌘B` on a selection inside a formula writes the numbered form.

The inspector sets a priority, 0 first and 100 last, on a document or on the
selected card; what is due sorts by it. It also sets a topic's growth, the
factor each pass multiplies the interval by (1.6 reading, 1.5 writing), and
shows the next three intervals; postpone grows the interval by 1.2. A budget
folds the day at that many elements: the top strip counts what is above the
fold, a session walks it, and `postpone the rest`, a row under the fold or a
palette command, postpones the reading and writing below it; cards stay
where they are. The bottom strip shows the keys that work where you are. `ilmi.theme('dark')`
and friends still work from the devtools console.

The app owns the `ilmi://` scheme, the same grammar as Obsidian's URI under
its own name, so a browser can hand it a page: `ilmi://new?name=&content=&
folder=&url=` lands a frozen source (the content as the text, else the page
at the address fetched and read as the intake reads one; the name as the
title, else the page's) in the folder named, else the one `clippings go to`
in the tweaks panel (the vault root until set), opens it, and leaves a
notice; `ilmi://open?path=` opens a document, `.md` or not. `vault=` must
name the open vault when it is given; a link that asks for nothing is a
notice. A bookmarklet clips the selection with the page's address:

```
javascript:location.href='ilmi://new?url='+encodeURIComponent(location.href)+'&content='+encodeURIComponent(getSelection().toString())
```

The Obsidian Web Clipper targets `obsidian://` only, so pointing it here
needs its fork, or its clipboard mode and a paste on the intake. A second
launch of the app hands its link to the running window. On macOS the scheme
is registered by the app bundle, so `npm run tauri build` and open the built
app once; a dev binary may not receive links from the OS.

## Layout

```
index.html         Vite entry
src/app/           renderer: React, Zustand store, tokens.css
src/format/        parser and serializer, the only code that touches vault files
src/vault/         open, walk, read, write, watch, and reshape a vault; pure over an Fs interface
src/schedule/      ts-fsrs grading, the reading and writing loops, the queue query
src/import/        text from a paste, a page, a list of cards, an Anki package, a book in EPUB, or a SuperMemo collection, on its way to a file
src/pdf/           the PDF lens's pure side: a page's text from pdf.js items, finding a passage again
scripts/           command-line tools, run with tsx
src-tauri/         desktop shell (Tauri v2, fs + dialog + http + deep-link + single-instance + log plugins; anki.rs reads a package, epub.rs a book)
```
