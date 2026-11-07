# Developing ilmi

The app is Tauri v2 (Rust shell) around a Vite + React + TypeScript renderer.
A collection is an SQLite database under the app's data directory
(`src-tauri/src/store.rs`; `collections/<name>/collection.db`, PDFs and
images beside it under `blobs/` by their SHA-256). A document's text in it
is Markdown; `src/format/` is the only code that reads or writes that text,
held to `FORMAT.md` by round-trip tests over a corpus, and a folder of files
goes in and comes out through `src/vault/transfer.ts`, held to the same
bytes by `src/vault/__tests__/store.test.ts`. The vault layer above is pure
over an `Fs`: `src/vault/store.ts` gives it the database as one (a path is
made from rows' names and parents), and the vault's own tests run over both
a directory and a store in memory.

The search index (`search` and `search_grams`, FTS5's trigram tokenizer, in
the same database) is folded in TypeScript and only there: `src/format/fold.ts`
is the one rule, for the deck search, find in the page, and the index, and
Rust stores what it is given. `src/vault/search.ts` makes a document's rows from
its parsed text, in `decompose`, so they go with every write and every merge
in that write's transaction. Rust skips them when the text did not change,
which is what keeps a grade cheap. They are keyed by the row's id, so a rename
touches nothing, and a delete cascades. They are each device's own: nothing of
them reaches the engine. To change what is indexed for existing collections,
clear `search` and `search_meta`, and the walk (`searchBuild` in
`src/vault/store.ts`, started by `openVault`) makes them again.

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
npm run fixture:pdf    # regenerate the corpus's PDFs (two-pages.pdf, and alone.pdf, a PDF on its own)
npm run fixture:anki   # regenerate the two-deck Anki package and its JSON (cargo)
npm run fixture:epub   # regenerate the three-chapter EPUB and its JSON (cargo)
npm run plugins        # build the plugins under plugins/ (esbuild) and refresh plugins/ilmi.d.ts
```

`npm run plugins` builds the plugins the repo ships under `plugins/`; how a
plugin is written, installed, and published is in `PLUGINS.md`.

## Dev flags and smoke runs

In a dev build, `ILMI_VAULT=/path/to/folder npm run tauri dev` imports that
folder as a collection of its name at launch (the last import of that name
is replaced, so every run starts from the files; the folder is only read)
and opens it instead of asking for one. Add `ILMI_SMOKE=1` to run every tree
operation against that collection through the real store and log the
results to the terminal. `ILMI_SMOKE=store` (a scratch copy of
`samples/double-major`) is milestone 59's own check: the folder imported a
second time and exported as `<folder>-export` and `<folder>-export.zip`,
each file compared with the folder's (`diff -r` from a shell says the same),
then writes, an image, a rename and a move read back from the database, and
the collection closed and reopened from the welcome; since milestone 60 it
also grades a card and reads the database to see that only a schedule's row
and the log changed, mirrors the collection to `<folder>-mirror/` and
watches a write follow, and makes the day's dated export. `ILMI_SMOKE=search` is
the palette over the sample on whichever shape it runs (the Mac, or
`smoke.json` on a simulated iPad or iPhone): the five files that hold كرم,
a word, a phrase, under three letters, light and dark; a result opened at its
place; a write, a rename and a delete followed in the database. `ILMI_SMOKE=size`
(over the same copy, with `ILMI_SIZE=15,152` by default) imports the folder
that many times over into collections `size-15` and `size-152` (about
11,000 and 115,000 cards), opens each, grades a card, times fifteen kinds of
query through the palette (it fails if a word, an unvoweled Arabic word or a
phrase takes a tenth of a second), and prints the open, the grade, and the
memory of the window's web content process (a dev-only
command reads its footprint, after posting WebKit's own low-memory
notification so that garbage is collected first, in every WebKit process of
the session; the page cannot weigh itself in WebKit). It
says so when the window was covered during the run: the system slows a
covered window's page several times over, and those times are not the
app's. Delete the collections afterwards. Give a dev run its own
identifier (below) and its collections are under
`~/Library/Application Support/<identifier>/collections/`, apart from the
installed app's.
`ILMI_SMOKE=finish` (a scratch copy of the sample) sets a finish day on the
merchant passage from the inspector, reads the row's words, makes a pass on the
pacing's day, reads `behind`, clears it, and counts a chapter's pages.
`ILMI_SMOKE=welcome` runs before any vault opens and walks the welcome instead,
seeding its rows with `ILMI_VAULT`; the other modes are listed at the top of
`src/app/smoke.ts`. `ILMI_SMOKE=book` (a scratch copy of `samples/double-major`,
with `ILMI_BOOKS=<this repo>/design/books`) walks a book and its notes on
`design/books/ch3-book.pdf`, the sample's Lindqvist ch. 3 at pp. 41–44 of its
book (`pdflatex ch3-book.tex` after `ch3.tex` rebuilds it): the pages across
the pane, the note opened beside them by `notes` and closed, and, since
milestone 70, a PDF on its own dropped in (`books/alone.pdf`, the same file),
read in the queue by its own line in `.ilmi/reading.json`, asked for a note
when a passage is kept, the note made in `fleeting` through the palette. `ILMI_SMOKE=books`
walks the sample's own two books, typeset from the text the sample held before
milestone 49 (`design/books/lindqvist.py` and `reader.py` write the `.tex`
files from `design/books/text/`; `pdflatex lindqvist.tex`, `xelatex reader.tex`
then `xelatex reader-book.tex` rebuild the PDFs, copied beside the sample's
parents): the physics first pass, the derivation written up on a later day
and dismissed when it returns, and the Arabic passage clipped.

`ILMI_SMOKE=sync` (milestone 53) wants two devices: `ILMI_VAULT` is a scratch
copy of the sample and `ILMI_VAULT2` a path beside it whose name the second
collection takes; the app opens a second window (`ILMI_VAULT2` alone,
without the smoke, imports that folder and opens it in a second window), the
first makes a bare repository beside its folder and connects, the second
clones it as a collection, and the two take turns over Tauri events.
To run a smoke beside the installed app (the single-instance plugin would
hand the launch to it), give the dev build its own identifier:
`npm run tauri dev -- --config '{"identifier":"dev.ilmi.check"}'`.
`ILMI_SMOKE=nudge` (milestone 54) wants the same two paths: the Rust side
starts an ntfy-shaped server on the loopback (`src-tauri/src/nudge.rs`, dev
builds only), both windows take it as their `nudge` and turn their pull
timers off, and a grade pushed in one is timed until it lands in the other.
`ILMI_STORAGE=<a folder>` (milestone 61) makes a dev run sync its
collection through that folder by the engine (`src/sync/engine.ts`; there
is no setting for it yet): an empty folder takes the collection that opens
(everything it holds becomes its first changes), and with `ILMI_VAULT2`
set the second window makes a collection named as that path's last part
from what the folder holds, so two windows are two devices over one
folder. Git sync does not run for a collection that syncs this way. The
folder holds `format`, `devices/<device>/<n>` (each device's changes, each
file written once) and `blobs/<sha256>`. `ILMI_SMOKE=crdt` runs the two
through 53's checks that way (`ILMI_VAULT` a copy of the sample,
`ILMI_VAULT2` a name, `ILMI_STORAGE` an empty folder; about a minute and a
half), its `shot:` lines worth a capture of each window. Since milestone
62 it ends with the tree: a drag in each window of one directory, a
document renamed in one and edited in the other, a folder moved in one
with a document made in it in the other. How the tree merges is said at
the top of `src/sync/engine.ts`: a row's place in its directory's order is
a number between its neighbours' (so a drag writes one row), a move that
would put a row under itself is undone by a change every device writes
alike, and of two rows with one name in one place the second is shown as
`name 2` without being renamed. `ILMI_SEEDS=1-500 npx vitest run
src/sync/__tests__/engine.test.ts -t "all end the same"` runs the random
test over more seeds than the suite's 24 (a few hundred a process); with
`ILMI_SNAPS=1` every seed folds its change files into snapshots as it goes
and deletes what they cover (one seed in three does without it).
Since milestone 63 the storage is a setting (Tweaks › storage: a folder, an
S3-compatible bucket, a WebDAV folder, since 64 Dropbox and Google Drive;
`src/app/storage.ts`), and
`ILMI_STORAGE` may also be `s3` or `webdav`: a debug build carries a
loopback server shaped like each (`src-tauri/src/devstore.rs`, over
`ILMI_STORAGE_DIR` or a temporary folder; the S3 side checks every
request's Signature Version 4 and every body's hash). The storage also
holds `snapshots/<device>/<n>/` (`ILMI_SNAP=4` writes one after four
change files instead of sixty-four). `ILMI_SMOKE=storage` wants
`ILMI_KIND=s3` or `webdav` and no `ILMI_STORAGE`, `ILMI_VAULT2` a name,
and `ILMI_BIG` a PDF of 200 MB on disk: the first window fills the tweaks'
storage rows and presses `connect`, the second makes a collection that
keeps what it has opened, and the big PDF is taken in, sent, and opened in
the other (about a minute and a half). The Rust side's own tests run the
storage's verbs against both servers; with `ILMI_TEST_S3=endpoint,bucket,key,secret`
or `ILMI_TEST_WEBDAV=address,user,password` in the environment, `cargo test
a_server_the_environment_names` runs them against a bucket or a WebDAV
folder of yours too (an empty one; it removes what it writes).
Since milestone 64 `ILMI_KIND` may also be `dropbox` or `drive`, servers
shaped like each service's own API (`src-tauri/src/devcloud.rs`, behind the
same listener; its head says what they check, and they are written to be
stricter than the guides where they can be). A sign-in in a dev run is what
ships on a desk: `http://localhost:51764/auth` (Google: `127.0.0.1`), a
listener the app opens, since a dev binary owns no `ilmi://`. On a device it
comes back by a link, which `clipper.ts` hands to `oauth_back`. With the
settings' `dev` set (a debug build alone reads it) a plain client plays the
browser (`devcloud::browse`): nothing opens the system's. The smoke's second
window signs in by the link, told through the deep-link plugin's own
`deep-link://new-url`, so the path up to the OS is run; the OS's part is
not. Tokens last 30 requests there, and one request in 97 is rate-limited, a
session's third reply is lost, so a smoke goes through all of that;
`dev_cloud_stats` says what the servers saw and `dev_cloud_revoke` lets a
client's sign-ins go. `ILMI_TEST_DROPBOX=app key,refresh token,folder` or
`ILMI_TEST_DRIVE=client id,client secret,refresh token,folder` and `cargo test
a_service_the_environment_names` run the verbs and 20 MB up and down against
the real thing; a refresh token is in `oauth.json` in the app's data folder
after a sign-in in the app. The smoke weighs each web process
(`dev_web_processes`), since two windows are two of them, and reads each while
the big file comes: a lifetime peak shows nothing below an earlier high.
`ILMI_SMOKE=readme` over a copy of the sample walks the screens the README
shows and marks each with a `shot:` line; the README's images were captured
that way, by window id, and scaled to 1600 px wide. Each smoke mode logs `ok:` and `failed:` lines and `shot: <name>` marks
where a screen is worth capturing; the app log is at
`~/Library/Logs/dev.ilmi.app/ilmi.log`. A second launch of the app hands off
to the running one (single instance), so stop the previous run before
starting another.

## The iPad

The same app builds for iOS (milestone 55). It needs Xcode with an iOS
simulator runtime (Xcode > Settings > Components), the Rust targets
(`rustup target add aarch64-apple-ios aarch64-apple-ios-sim`), and from
Homebrew `xcodegen`, `libimobiledevice`, and `cocoapods`. The Xcode project
is `src-tauri/gen/apple`, written by `npm run tauri ios init` and kept in
the repository; `src-tauri/Info.ios.plist` is merged into its `Info.plist`
(the two keys that show the app's Documents in the Files app), and the
`ilmi://` scheme comes from `plugins.deep-link.mobile` in `tauri.conf.json`.
`project.yml` there carries two lines added by hand, `libz.tbd` and
`libiconv.tbd` (libgit2 links the system's zlib and iconv, and the app's
link has to name them); after an edit, or if `tauri ios init` rewrites the
file, put them back and run `xcodegen generate` in that folder. On iOS git2
also builds OpenSSL in (`Cargo.toml`, the `target_os = "ios"` section): it
names openssl-sys for every unix but macOS, though libgit2 speaks TLS
through the system there.

```
npm run tauri ios dev "iPad Air 11-inch (M3)"   # a simulator, by its name in `xcrun simctl list devices`
npm run tauri ios dev -- --open                  # Xcode, for a device: choose a team under Signing & Capabilities
```

A free team installs on a device for seven days; `bundle.iOS.developmentTeam`
or `APPLE_DEVELOPMENT_TEAM` names it for the command line. What is the
desktop's alone sits under `cfg(desktop)` in `src-tauri/src/lib.rs`: the
single-instance plugin, the menu bar, the second window. The renderer asks
the Rust side where it runs once (`platform`, `src/app/platform.ts`): on iOS
the welcome is `connect` and the collections there are (databases under the
app's data directory, as on the Mac), and the shell is one pane.

An app on iOS has no environment to set, so a dev build reads the smoke's
variables from `smoke.json` in its Documents: `{"mode": "tour", "vault":
"double-major"}` is `ILMI_SMOKE=tour` over the folder of that name there
(imported as a collection, as `ILMI_VAULT` is on the Mac; not run on the
simulator since milestone 59), and
any other key is the variable of its name in capitals (`"remote"` is
`ILMI_REMOTE`). A simulator's Documents is a folder on the Mac:

```
DOCS=$(xcrun simctl get_app_container booted dev.ilmi.app data)/Documents
echo '{"mode": "ipad", "remote": "/path/to/double-major.git"}' > $DOCS/smoke.json
xcrun simctl io booted screenshot shot.png
```

`ILMI_SMOKE=ipad` starts at the welcome: `connect` clones the remote (a
simulator reads the Mac's disk, so a bare repository there serves), the
shell's shape is checked, the queue is walked by its buttons, and a card
graded there is pushed; its `graded:` line names the file and the lines
that changed, for the Mac's copy to be compared with. The app's log is
`Library/Application Support/dev.ilmi.app/logs/ilmi.log` under the same
container. The app is started again over a new `smoke.json` with
`xcrun simctl terminate booted dev.ilmi.app` and `xcrun simctl launch booted
dev.ilmi.app` while `tauri ios dev` keeps serving the renderer (once the
app is installed and the Rust side has not changed, `npm run dev` alone on
1420 serves it as well). The iPad's
side also draws in the Mac's window, without Xcode:
`ILMI_MOBILE=1 ILMI_DOCUMENTS=/some/empty/dir npm run tauri dev`.

`ILMI_SMOKE=touch` (milestone 57) is three runs over one storage folder.
On the Mac, `ILMI_VAULT=<a copy of the sample> ILMI_STORAGE=<an empty
folder>`: the collection makes the storage. On the simulator, `{"mode":
"touch", "storage": "<that folder>"}`: a collection is made from the
storage (a simulator reads the Mac's disk), the chapter is opened and read,
a passage boxed and made a section, and the section synced; its `section:`
line names it. Since milestone 70 the Mac's first run also puts a PDF on
its own in the storage (`library/alone.pdf`), which the iPad opens, boxes,
and makes a note for in `fleeting` (its `alone note:` line names it). On
the Mac again, `ILMI_VAULT=<the collection's own folder under
collections/> ILMI_STORAGE=<the folder> ILMI_EXPECT=<the section's name>
ILMI_ALONE_NOTE=<that note's path>`: the section and the note are there
after a sync. The simulator's run is under
real touches, which neither `simctl` nor the page can make: the smoke logs
`do: tap x y`, `do: press x y seconds`, `do: drag x1 y1 x2 y2 hold`, `do:
flick x1 y1 x2 y2` and `do: turn landscape` (places as fractions of the
window) and waits for what each does, and an XCUITest bundle reads the
app's log and makes them (`scripts/touch-rig`: `xcodegen generate` there
once, then, with the simulator booted, the app installed, a dev server on
1420, `smoke.json` written and the log emptied,

```
C=$(xcrun simctl get_app_container booted dev.ilmi.app data)
TEST_RUNNER_LOG="$C/Library/Application Support/dev.ilmi.app/logs/ilmi.log" TEST_RUNNER_MODE=touch \
  xcodebuild test -project scripts/touch-rig/TouchRig.xcodeproj -scheme TouchRig \
  -destination 'id=<the simulator's udid>' -derivedDataPath scripts/touch-rig/dd
```

which starts the app and ends at the smoke's `done` or `failed` line; about
two and a half minutes). That runner makes fingers only: Xcode 27.2's
XCUIAutomation has no stylus among its pointer paths, so the Pencil's path
never reaches the page; a dev run says a finger stands in for it
(`dev_ink_pen`) and the `touch` smoke's one `pen` press is an event it
makes itself, which boxes nothing. `src/app/touch.ts` holds the three timings (a finger's hold before
a box, the long press, how long a touch rests before the system's own
selection is kept off).

Ink lies over the web view (milestone 69; `src-tauri/ink`: `ios/` is the
Swift package Tauri builds into the app, `native/ink.m` what reads a drawing
as strokes and draws them, on the Mac too). Nothing opens: a layer above the
web view takes no touch and holds a PencilKit canvas per sheet (an ink area
or a book's page near the screen), each canvas's drawing recogniser moved
onto the web view and taking the Pencil only. The layer's `hitTest` hears of
every touch first and enables the one canvas under it, and takes the Pencil
from the web view's own recognisers there. `src/app/ink.ts` says where
things lie (`ink_scene`, in each scroller's content, only when the layout
changes); the layer finds the scroller's own `UIScrollView` inside the web
view by its frame and follows its `contentOffset`, so a scroll crosses no
bridge. `src/app/noteInk.ts` is a note's side, `Pdf.tsx` a book's;
`src/reader/inkArea.ts` draws an area in the flow. A simulator has no Pencil,
and `dev_ink_pen` makes a finger one until told otherwise: the same
canvases and recognisers, with `.direct` among the Pencil's touch types
(`dev_ink_state` says how everything stands).

An iPhone is the same build on another simulator (`npm run tauri ios dev
"iPhone 18 Pro"`), and everything of a phone is the renderer's: `shapeOf`
says `phone` when the shorter side is under 600 (`PHONE_MAX`), App sets
`phone` in the store and `data-shape="phone"` on the page, and `phone.css` is
all its styles. `PhoneBar.tsx` is the foot; `QuickCard.tsx` and `quick.ts` the
composer; `lastDeck` is in `.ilmi/state.json`, which never syncs. `book.ts`
puts a note in the pages' place there instead of beside them.

`ILMI_SMOKE=phone` is three runs over one storage folder, as `touch` is. The
Mac (`ILMI_VAULT`, `ILMI_STORAGE`) makes the storage. The simulator, with
`{"mode": "phone", "storage": "<that folder>", "clip": "<a page's address>"}`
and `TEST_RUNNER_MODE=phone`: a day folded to 24, a topic's row, the session
walked by its buttons, quick cards, the page clipped, the tree, a chapter,
the palette, dark, on its side. The page is any server on the Mac's loopback
(a simulator shares it) holding prose with `page's second paragraph`
in it. The rig has two verbs more for this, `do: type <text>` into what has
the caret and `do: open <link>`, which is `XCUIDevice.shared.system.open`, the
way a Shortcut's "open URL" arrives. Its `reached:` line is the Mac's third
run's `ILMI_EXPECT`, with `ILMI_VAULT=<the collection's own folder>`: every
document it names has the same digest there, and the reviews are in the log.

`ILMI_SMOKE=ink` is three runs over one storage folder in the same way. The
Mac first (`ILMI_VAULT`, `ILMI_STORAGE`), then the simulator with
`{"mode": "ink", "storage": "<that folder>"}` and `TEST_RUNNER_MODE=ink`: a
stroke between two paragraphs of a long note, the area opening and growing,
kept when quiet; a finger scrolling it; a tap, the tools gone; a stroke in
the area and one in the text elsewhere. Its `touch:` and `touches:` lines say
what a touch cost, `page:` what the page weighs, and `ink:` the two
paragraphs and the count. Then the Mac again with `ILMI_VAULT=<the
collection's own folder> ILMI_EXPECT=<the paragraphs> ILMI_STROKES=<the
count>`: the page is between them as a picture the Mac made from the
strokes. `npm run fixture:ink` writes the corpus's page again (PencilKit on
the Mac), and `cargo test -p tauri-plugin-ink` in `src-tauri` runs what reads
a drawing; `-- --ignored --nocapture a_page_weighed` prints a made-up page's
bytes as strokes and as a PNG.

`ILMI_SMOKE=pageink` (ink on a book's page) is four runs over one storage
folder. The Mac (`ILMI_VAULT`, `ILMI_STORAGE`): the storage made, then six
strokes kept on p. 23 of the sample's book and not sent (a Mac has no canvas:
the strokes are a made-up drawing of PencilKit's, `dev_ink_sample`, kept
through `keepPage` in `src/app/ink.ts`). The simulator, `{"mode": "pageink",
"storage": "<that folder>"}` with `TEST_RUNNER_MODE=pageink`: a collection
made from the storage, strokes on p. 23 from the first touch, the writing on
the page where the finger went, the pages scrolled with it; then a note of
two pages of ink, each opened where the stand-in landed; its `pageink:` line
says the count, where the strokes lie in the page's points, and the note.
The Mac again with `ILMI_VAULT=<the collection's own folder> ILMI_EXPECT=<the
count> ILMI_BOX=<where> ILMI_NOTE=<the note>`: both writings on the page,
shown as a picture. The simulator again with `"again": "1", "expect": "<the
count>"` added: the collection it made, opened as it was left, holds both
too. A stroke written on a book's page is a row of `ink` under `p.<the PDF's
SHA-256>.<page>` (`pageKey`, `src/vault/store.ts`), no row of the tree.

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
src/format/        parser and serializer, the only code that reads or writes a document's text
src/vault/         open, walk, read, write, watch, and reshape a vault; pure over an Fs interface. store.ts is a collection's rows as an Fs (tauri-store.ts over the Rust side, mem-store.ts for tests), transfer.ts a folder in and out
src/schedule/      ts-fsrs grading, the reading and writing loops, the queue query
src/import/        text from a paste, a page, a list of cards, an Anki package, a book in EPUB, or a SuperMemo collection, on its way to a file
src/pdf/           the PDF lens's pure side: a page's text from pdf.js items, finding a passage again
src/plugins/       the plugin runtime (api.ts is the typed handle, runtime.ts the loader) and its tweaks section
src/sync/          engine.ts merges a collection's changes by CRDT (registers by a clock, a document's text through Loro, the tree and each directory's order from the registers, change files and snapshots in a storage, the PDFs fetched when asked for; src/app/crdt.ts runs it, src/app/storage.ts makes the storages); merge.ts is git sync's merge of one file changed on both devices, src/app/sync.ts its policy over the Rust commands
plugins/           the plugins the repo ships, built by `npm run plugins`; ilmi.d.ts is the API; see PLUGINS.md
scripts/           command-line tools, run with tsx
src-tauri/         the shell (Tauri v2, fs + dialog + http + deep-link + single-instance + opener + log plugins, and ink/, its own: the PencilKit canvases on iOS and a drawing read as strokes; store.rs is a collection's SQLite and blobs, storage.rs an S3 bucket or a WebDAV folder as a storage (and a blob sent or fetched as a stream), cloud.rs Dropbox and Google Drive as storages, oauth.rs the sign-in to them and its tokens, devstore.rs and devcloud.rs the debug build's loopback servers shaped like each, anki.rs reads a package, epub.rs a book, plugin.rs a plugin zip, sync.rs a folder as a git repository over libgit2); gen/apple is the iOS project
```

## The documents

- `FORMAT.md` is the contract for a document's text and for the folder an
  import reads and an export writes: change it only with a corpus file and a
  test that shows why.
- `PLAN.md` is the build order, one milestone per session, with notes under
  each; `BUILD-LOG.md` is the session narrative and carries the handoff prompt.
- `spec/hashiyah/` is the hi-fi prototype, the decided spec for behavior and
  feel; its `BUILD-PROMPT.md` wins on architecture.
- `design/sim/` holds the reading-loop simulation (`irsim.py`, `semester.py`)
  whose constants the schedule tests pin; `design/books/` the typeset sample
  books.
- `docs/` is the user side: `guide.md`, `keys.md`, and the screenshots.
