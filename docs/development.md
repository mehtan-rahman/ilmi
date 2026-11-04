# Developing ilmi

The app is Tauri v2 (Rust shell) around a Vite + React + TypeScript renderer.
Markdown files are the model; `src/format/` is the only code that touches
them, held to `FORMAT.md` by round-trip tests over a corpus.

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
npm run plugins        # build the plugins under plugins/ (esbuild) and refresh plugins/ilmi.d.ts
```

`npm run plugins` builds the plugins the repo ships under `plugins/`; how a
plugin is written, installed, and published is in `PLUGINS.md`.

## Dev flags and smoke runs

In a dev build, `ILMI_VAULT=/path/to/vault npm run tauri dev` opens that vault
at launch instead of asking for one. Add `ILMI_SMOKE=1` to run every tree
operation against that vault through the Tauri fs adapter and log the results
to the terminal; use a scratch copy, it creates and deletes files.
`ILMI_SMOKE=welcome` runs before any vault opens and walks the welcome instead,
seeding its rows with `ILMI_VAULT`; the other modes are listed at the top of
`src/app/smoke.ts`. `ILMI_SMOKE=book` (a scratch copy of `samples/double-major`,
with `ILMI_BOOKS=<this repo>/design/books`) walks a book beside its notes on
`design/books/ch3-book.pdf`, the sample's Lindqvist ch. 3 at pp. 41–44 of its
book (`pdflatex ch3-book.tex` after `ch3.tex` rebuilds it). `ILMI_SMOKE=books`
walks the sample's own two books, typeset from the text the sample held before
milestone 49 (`design/books/lindqvist.py` and `reader.py` write the `.tex`
files from `design/books/text/`; `pdflatex lindqvist.tex`, `xelatex reader.tex`
then `xelatex reader-book.tex` rebuild the PDFs, copied beside the sample's
parents): the physics first pass, the derivation written up on a later day
and dismissed when it returns, and the Arabic passage clipped.

`ILMI_SMOKE=sync` (milestone 53) wants two devices: `ILMI_VAULT` is a scratch
copy of the sample and `ILMI_VAULT2` an empty path beside it; the app opens a
second window over it (`ILMI_VAULT2` alone, without the smoke, opens any
vault in a second window), the first makes a bare repository beside its copy
and connects, the second clones, and the two take turns over Tauri events.
To run a smoke beside the installed app (the single-instance plugin would
hand the launch to it), give the dev build its own identifier:
`npm run tauri dev -- --config '{"identifier":"dev.ilmi.check"}'`.
`ILMI_SMOKE=readme` over a copy of the sample walks the screens the README
shows and marks each with a `shot:` line; the README's images were captured
that way, by window id, and scaled to 1600 px wide. Each smoke mode logs `ok:` and `failed:` lines and `shot: <name>` marks
where a screen is worth capturing; the app log is at
`~/Library/Logs/dev.ilmi.app/ilmi.log`. A second launch of the app hands off
to the running one (single instance), so stop the previous run before
starting another.

## Building the installer

`npm run tauri build` makes the macOS app and its installer:
`src-tauri/target/release/bundle/macos/ilmi.app` and, beside it under
`dmg/`, `ilmi_<version>_aarch64.dmg` (the version is `src-tauri/tauri.conf.json`'s).
Drag the app into Applications from the DMG. The build is unsigned unless a
Developer ID certificate is on the keychain, so the first launch is refused
and allowed once under System Settings > Privacy & Security (Open Anyway).

On GitHub, pushing a tag `v<version>` runs `.github/workflows/release.yml`:
tests and the typecheck on Linux, then the app on a macOS runner as a
universal binary (Apple Silicon and Intel), attached to a draft release
named after the tag. Publishing the draft is a click. The Actions tab's
"Run workflow" builds the same DMG as a workflow artifact without a release.
With six repository secrets the workflow signs and notarizes the app so it
opens without the Privacy & Security step: `APPLE_CERTIFICATE` (the
Developer ID Application `.p12`, base64), `APPLE_CERTIFICATE_PASSWORD`,
`APPLE_SIGNING_IDENTITY` (its name, `Developer ID Application: …`),
`APPLE_ID`, `APPLE_PASSWORD` (an app-specific password) and `APPLE_TEAM_ID`.

The Tauri CLI refuses to build when an npm package and its Rust crate differ
in minor version, so bump them together: the crates follow
`rust-version` in `src-tauri/Cargo.toml` (`cargo update -p tauri …` takes
the newest the MSRV allows), and the `@tauri-apps/*` packages go to the
same minors.

## Layout

```
index.html         Vite entry
src/app/           renderer: React, Zustand store, tokens.css
src/format/        parser and serializer, the only code that touches vault files
src/vault/         open, walk, read, write, watch, and reshape a vault; pure over an Fs interface
src/schedule/      ts-fsrs grading, the reading and writing loops, the queue query
src/import/        text from a paste, a page, a list of cards, an Anki package, a book in EPUB, or a SuperMemo collection, on its way to a file
src/pdf/           the PDF lens's pure side: a page's text from pdf.js items, finding a passage again
src/plugins/       the plugin runtime (api.ts is the typed handle, runtime.ts the loader) and its tweaks section
src/sync/          the merge of one file changed on both devices, by the format's rules; src/app/sync.ts is the policy over the Rust commands
plugins/           the plugins the repo ships, built by `npm run plugins`; ilmi.d.ts is the API; see PLUGINS.md
scripts/           command-line tools, run with tsx
src-tauri/         desktop shell (Tauri v2, fs + dialog + http + deep-link + single-instance + opener + log plugins; anki.rs reads a package, epub.rs a book, plugin.rs a plugin zip, sync.rs the vault as a git repository over libgit2)
```

## The documents

- `FORMAT.md` is the on-disk contract: change it only with a corpus file and a
  test that shows why.
- `PLAN.md` is the build order, one milestone per session, with notes under
  each; `BUILD-LOG.md` is the session narrative and carries the handoff prompt.
- `spec/hashiyah/` is the hi-fi prototype, the decided spec for behavior and
  feel; its `BUILD-PROMPT.md` wins on architecture.
- `design/sim/` holds the reading-loop simulation (`irsim.py`, `semester.py`)
  whose constants the schedule tests pin; `design/books/` the typeset sample
  books.
- `docs/` is the user side: `guide.md`, `keys.md`, and the screenshots.
