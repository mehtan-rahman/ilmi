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
```

The import reads a SuperMemo collection's data files (`src/import/supermemo/LAYOUT.md`
says which bytes, and on whose word) and lands its tree as folders, topics as
sources and extracts, items as cards, tasks as drafts, with their schedules
and priorities; what the layout notes do not cover is printed, never written.

In a dev build, `ILMI_VAULT=/path/to/vault npm run tauri dev` opens that vault
at launch instead of asking for one. Add `ILMI_SMOKE=1` to run every tree
operation against that vault through the Tauri fs adapter and log the results
to the terminal; use a scratch copy, it creates and deletes files.

## Keys

```
⌘K               palette: open anything by name, or run a command
click            open a folder or document in the active tab
⌘-click          open in a new tab      ⌘⇧-click   open in the next pane
F2 / dbl-click   rename                 right-click  new, rename, move to, delete
⌘W               close tab              ⌘\           split pane
⌘⇧E              sidebar                ⌘⇧I          inspector
⌘,               tweaks: theme, accent, density (kept outside the vault);
                 the day's budget (kept in the vault's .ilmi)

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

The inspector sets a priority, 0 first and 100 last, on a document or on the
selected card; what is due sorts by it. It also sets a topic's growth, the
factor each pass multiplies the interval by (1.6 reading, 1.5 writing), and
shows the next three intervals; postpone grows the interval by 1.2. A budget
folds the day at that many elements: the top strip counts what is above the
fold, a session walks it, and `postpone the rest`, a row under the fold or a
palette command, postpones the reading and writing below it; cards stay
where they are. The bottom strip shows the keys that work where you are. `ilmi.theme('dark')`
and friends still work from the devtools console.

## Layout

```
index.html         Vite entry
src/app/           renderer: React, Zustand store, tokens.css
src/format/        parser and serializer, the only code that touches vault files
src/vault/         open, walk, read, write, watch, and reshape a vault; pure over an Fs interface
src/schedule/      ts-fsrs grading, the reading and writing loops, the queue query
src/import/        text from a paste, a page, a list of cards, or a SuperMemo collection, on its way to a file
src/pdf/           the PDF lens's pure side: a page's text from pdf.js items, finding a passage again
scripts/           command-line tools, run with tsx
src-tauri/         desktop shell (Tauri v2, fs + dialog + log plugins)
```
