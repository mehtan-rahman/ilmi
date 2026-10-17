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
```

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
⌘,               tweaks: theme, accent, density (kept outside the vault)

in a source      select, then e extract or m make a card; r start reading
in a deck        j k move, ⌫ delete the selected card, m make a card;
                 × on a row, or right-click, also deletes one; right-click moves it to another deck
in the queue     j k move, ⏎ enter, o open one
in a session     [ ] prev / next; space reveal, 1-4 grade; ⏎ read on or
                 worked on it, p postpone, d done
```

The inspector sets a priority, 0 first and 100 last, on a document or on the
selected card; what is due sorts by it. The bottom strip shows the keys that
work where you are. `ilmi.theme('dark')`
and friends still work from the devtools console.

## Layout

```
index.html         Vite entry
src/app/           renderer: React, Zustand store, tokens.css
src/format/        parser and serializer, the only code that touches vault files
src/vault/         open, walk, read, write, watch, and reshape a vault; pure over an Fs interface
src/schedule/      ts-fsrs grading, the reading and writing loops, the queue query
src-tauri/         desktop shell (Tauri v2, fs + dialog + log plugins)
```
