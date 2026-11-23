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

What is left on a book's pages (bookmarks, marks, highlights, portals) is a
JSON file a PDF under `.ilmi/marks/`, named by the PDF's SHA-256
(`src/vault/marks.ts` reads and writes it; `FORMAT.md` §1 has its shape). It
is an ordinary hidden file of the collection: no table and no Rust of its
own. The app reads a PDF's file once and holds it (`src/app/book.ts`), and
every change writes the file whole; the engine (`src/sync/engine.ts`) turns
that write into one register an entry that changed (`~m|<sha256>|<id>`), and
after a merge writes the file as the later write left it with every entry as
its register says, the way `.ilmi/plugins.json` merges. The pure side of the
features is `src/pdf/marks.ts`.

The scheduler slot lets another scheduler than the built in say when a
card is due. `src/schedule/slot.ts` is pure: the `Scheduler` shape (`recall`
or `next`), which queue items it is asked about (`slotted`: a review, out of
its steps), and `applyScores` and `slotKeys`, which lay its scores over the
queue's own copies of the items before the exams, the links and the day's
allowance run as they always do. `src/plugins/scheduler.ts` is the runtime
(`SchedulerSlot`): registrations, the choice read from
`.ilmi/scheduler.json`, the log handed over, and scoring, asked for by
`buildQueue` through `laySlot` (`src/plugins/index.ts`), debounced, guarded
by a clock, with the last scores kept until new ones are in. The queue never
waits: `buildQueue` stays synchronous and reads whatever scores there are;
when new ones land the slot asks for a rebuild. A grade goes through
`grading.ts` untouched, so the `sr` line is always the built in's. With
`built in` chosen none of this runs (`laySlot` returns before it reads an
item).

The built in is FSRS-6 through ts-fsrs 5.4.2 and stays so. ts-fsrs 6.0.0 is
installed beside it under the name `ts-fsrs-6` for one thing, its FSRS-7
model (`ts-fsrs-6/models/fsrs-7`): 6.0.0's own FSRS-6 schedules differently
from 5.4.2 in places (a `hard` in the learning steps is 5m30s, not 6m; some
`good` and `easy` intervals in review are a day or two shorter), so
replacing the one with the other would have moved cards. `src/schedule/fsrs7.ts`
is FSRS-7 as a scheduler in the slot, each card's memory replayed from the
review log; `src/plugins/fsrs7.ts` holds its weights and runs the fit.
`fit to my reviews` sends the log to `fsrs_fit` (`src-tauri/src/fit.rs`, the
`fsrs` crate 7.0.0, on the CPU, no model file), which builds for iOS.
`npm run fixture:fit` fits the sample collection's log and writes
`src/schedule/__tests__/fsrs7-sample-fit.json`, which `fsrs7.test.ts` reads
as the app reads a fit; run it again after changing `fit.rs` or the crate.

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
npm run fixture:fit    # fit FSRS-7 to the sample collection's review log (Rust) and write the weights the tests read
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
`ILMI_SMOKE=join` (a simulated iPad or iPhone, from its welcome) puts a
collection of the sample in Documents into the loopback WebDAV server, deletes
it, and makes it again through the welcome's `join`.
`ILMI_SMOKE=treesel` (a scratch copy of the sample) is the tree's selection of
several: ⇧-click and ⌘-click with nothing opening, ⇧↓, ⌘A, Esc, the menu of
several and of a row outside them, ⌘⌫ on a range as one notice and its undo,
two rows dragged into a folder by the pointer and moved back by `move to…`,
and the finger's `select` with its line (the store told it is a device).
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
`ILMI_THEME=dark` (or `light`, `eink`; `"theme"` in an iPad's or a phone's
`smoke.json`) starts a dev run in that theme, for looking at it.
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
folder of yours too (an empty one; it removes what it writes). With
`ILMI_S3=endpoint,bucket,key,secret` a dev run's s3 row reaches that bucket
instead of the loopback server, so the storage smoke runs against a real
one (a local MinIO passed it, 2026-11-07).

Leaving the app sends what was written at once (`src/app/away.ts`): when
the page is hidden, the storage's sync (if anything was written since its
last) and git's commit and push (if one waits) run now, and on iOS the
app asks the system for background time while they do (the ink plugin's
`hold`, behind `app_hold`; a grace of six seconds starts with the move to
the background). A smoke that stops the timers stops this too, but for
`ILMI_SMOKE=away` on a simulated iPad: smoke.json gives `vault` (a copy of
the sample) and `storage` (an empty folder); a card is graded with the
timers off, the touch rig's `away <seconds>` sends the app home and back,
and the grade must have gone out while it was away. A simulator suspends
nothing (it says no limit to the time in the background), so whether the
hold outlasts a real suspension is a device's check (66).
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
`ILMI_SMOKE=cardview` (milestone 72) over a copy of the sample opens the
physics constants deck in the sidebar's tree to list its cards, opens the
card view from a card's row, types into its back and saves with ⌘⏎ (one
line of the file changes, the id and the `sr` line kept), moves on with
`]`, right-clicks a face for its menu, edits a session's card in place with
`e` and grades it, then right-clicks a cell of the verb forms note's table,
adds a row below, and reads the new row in the file. `ILMI_SMOKE=decks`
(over the corpus vault) edits two cards through the card view since then.
`ILMI_SMOKE=sweep` (milestone 73) over a copy of the sample walks the
fixes only a window shows: a click on a deck's row in the tree and j in the
deck, one card deleted and undone, the deck's search kept across a tab
switch, space held in a session, the session's place kept, `s` suspending
and undone, a chapter's page said and its place kept (the print on the page
in view measured), ⌘W, ⌘⇧T and ⌃Tab, the palette's order, an empty pane,
the tweaks inside the window. `ILMI_SMOKE=numbers` since milestone 74 reads
the year of days: the cells against the log under each lens, a day by the
keyboard and pressed, the days ahead, dark and e-ink, the whole collection,
and a phone's width (the lens narrowed to 343 px with the phone's shape set).
`ILMI_SMOKE=sweepedit` types into the honors-thesis note under WebKit's own
keys and reads the file after each step: a card kept by Backspace and by
typing over it, Delete joining a list's first item, a closing fence, an
empty ⌘B pair across the autosave, undo and redo across the page's own
rebuild, a bare address. `ILMI_SMOKE=insert` wants a small PNG on the disk
beside the sample's copy, `smoke-pick.png` (any picker or drop gives a path
on the disk, and a collection's own files are rows).
`ILMI_SMOKE=sioyek` (milestones 76 and 77, with `ILMI_BOOKS=<this
repo>/design/books`) lands `around.pdf` (a four-page paper typeset with an
outline and links: `pdflatex around.tex`, three times) as a PDF on its own
and walks getting around it (the contents, ⌫ and ⇧⌫, a link, a reference's
peek, the letters of `f`, `n` and `N`) and what is left on it (a bookmark,
a mark, a highlight at fit, zoomed and in e-ink, the ruler, a portal and
the pane beside following it, into a second book and back; a box's
words highlighted from its bar, which is how a touch shape highlights; a
pinch by a wheel and by gesture events; the zoom kept across the
collection closed and opened; `turned.pdf`, the same paper with its second
page laid on its side and turned back by `/Rotate`, for the ruler, a link
and the letters on a turned page), reading `.ilmi/marks/<hash>.json` after
each. `ILMI_SMOKE=collections` makes a scratch collection from the welcome,
renames it, and deletes it; it renames and deletes nothing it did not make.
`deck` and `decks` run over the corpus vault
(`src/format/__tests__/corpus/vault`), not the sample.
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

Any smoke that drives the page itself (no finger needed) runs on a
simulator as it does on the Mac: with the app installed and a dev server on
1420 (`tauri ios dev` left running, or `npm run dev` once the Rust side is
built), copy the sample into the app's Documents, write `smoke.json`
(`{"mode": "sweep", "vault": "double-major"}`; `"books": "<repo>/design/books"`
for `sioyek`), `simctl terminate` and `launch`, and read the app's own log
for `done` or `failed`; `simctl io booted screenshot` after each `shot:`
line. A second simulator takes the same build (`simctl install booted
<DerivedData>/…/debug-iphonesimulator/ilmi.app`). `sweep`, `sweepedit`,
`numbers`, `sioyek`, `collections` and `tour` pass on an iPad Air and an
iPhone 18 Pro (milestone 78); they skip what is the desk's on a touch shape
(a selection on a book's page, a second pane, the inspector on a phone, the
bottom strip) and log that they did.

`ILMI_SMOKE=written` (milestone 82) is written notes. On the Mac, over a
copy of the sample: a notebook made from the sidebar's `+`, its pages and
papers, pages added and deleted, strokes put on its sheets through what a
canvas keeps through (a made-up drawing), a passage and a clip from a
sheet, a notebook made for a PDF, the export. On a simulated iPad, where
the notebook's pages are a surface (milestone 87) and what was asked of the
page is asked of `dev_ink_state`, it is the
row of tools (`InkBar.tsx`) under real touches: a copy of the sample in the
app's Documents, `{"mode": "written", "vault": "double-major"}`,
`TEST_RUNNER_MODE=written`. The rig's finger stands in for the Pencil; each
tool, size and colour is tapped and `dev_ink_state` read for what the
canvases hold; the eraser, undo and redo, the lasso (the rig's `do: loop x1
y1 x2 y2 …`, one finger through every point, which XCUITest's public calls
cannot draw: it builds the runner's own pointer path) and a drag of what it
holds, `draw with finger` on and off, `add page` and the page a low stroke
adds, the colour wheel (opened by a tap, a colour chosen through
`dev_ink_wheel`, closed by a tap beside it), the paper, a box kept as a
passage and one clipped into a typed note, upright and on its side, then a
PDF's page under the same row. A second run with `"again": "1"` and no new
copy of the sample opens the collection as it was left: what was chosen is
on the row and told to the canvases. On a simulated iPhone the same mode
needs no rig: a notebook read as its pages, with no tools.
The same run goes on into what milestone 85 added, in a notebook of its own
(`writtenMore` in `smoke.ts`; alone with `"part": "more"` in `smoke.json`):
the row tucked away and back; each tool's settings from a second tap, the
pen's inks, the width by its slider, the highlighter's opacity, the
eraser's two ways; a stroke kept and at rest still drawn by its canvas
(`dev_ink_state` says each sheet's `pixels`, the canvas's zoom times the
screen's scale, and its `blend`), which is the check that the writing does
not go soft when it is kept, scrolled or zoomed; two fingers tapped (the
rig's `do: taps n x y`) and spread and closed (`do: pinch ax ay bx by ax2
ay2 bx2 by2`, two pointer paths in one record), the zoom where they
stopped and the place between them still there; a stroke ended resting
(`do: rest x1 y1 … seconds`) made a line, and a rectangle, an ellipse, an
arrow and four pieces of handwriting put through the same code by
`dev_ink_stroke`; the eraser cutting a stroke in two; the lasso's menu,
its handle, cut, and `paste` where a finger rests; the Pencil's double tap
and squeeze (`dev_ink_pencil`; `three` there says the three-finger tap,
which this simulator does not take from the rig); the pages' overview, a
page duplicated, added after and dragged to another place; the notebook
and then a PDF's pages shared as a PDF (`dev_pdf_info` reads the file
back, `dev_ink_unshare` closes the sheet); page setup, every control, the
file read after each, pageless and a stroke across the seam, A4 on its
side, `use for new notebooks`; and the row whole at every width it is
given.
Then what milestone 88 added, in a third notebook (`writtenLong`; alone
with `"part": "long"`): a new notebook's margins (its rules 12 mm short of
each side, no line), page setup's `left margin` and `right margin` by
their sliders, `margin line` left and both, `margin colour`, a ruled
page's `bottom space`, `use for new notebooks`, each paper with its lines
and without, the file read after each; a notebook given 85's
`paper-margin` alone, read as it was (rules edge to edge, a line), shown
in the panel as a margin with its line and made one by a slide; then
pageless, where `dev_ink_state` says how long the one sheet is drawn
(`length`, in points) and how many of its sheets that shows (`shown`). Six
strokes by the rig's finger toward the sheet's foot: after each the length
is the lowest ink and 192 points more to a whole rule, it grew by a rule
or two and never a sheet, the first sheet lies on the same pixels and the
pages are scrolled as they were, and the next sheet is in the file before
the foot comes to it, with no notice. A stroke across where two sheets
meet, one begun below it and run up, the eraser put down below it on a
stroke kept above, a lasso round a stroke on each side (held and let go:
each on its own sheet in the store and on the surface, and undo takes back
the stroke written last, the hold being no step) and what it holds
carried down past it (undo, once: each on its own sheet again); a sheet in
the file past what is written not drawn;
the lower strokes taken away (no shorter), another document and back
(shorter); pages and pageless again with every stroke on its sheet; the
PDF cut to the pages the ink reaches; dark, and on its side. Before a
capture a `geo:` line says where the sheet, its margin lines, the two
ends of its rules, the place two sheets meet and the sheet's foot lie in
it, in the screen's pixels: a script reads the captures against them
(each margin line within a pixel of its distance; on rows of the ruling
the first and the last pixel that is not paper within a pixel and a half
of the margins; down a column clear of ink the rules one pitch apart and
one thickness with nothing else where the sheets meet; paper above the
foot and the desk under it). `"part": "grow"` is the six strokes alone,
to record (`xcrun simctl io booted recordVideo`): in every frame the
level stroke written first and the rules over the first foot must be
where they were, the paper's foot may only move down by whole rules, and
no frame may show paper not yet ruled. On the Mac the same mode ends with
its own part (`writtenLongMac`; alone with `ILMI_PART=long`): the margins,
the margin lines and their colour in the page's own paper to a pixel, a
grid closed inside its margins, 85's field read as it was, a pageless
notebook's column cut
to the length of a made-up drawing's ink, longer when more is kept on the
second sheet, shorter only when it is opened again.
Then a stroke taller than a sheet (`writtenTall`; alone with `"part":
"tall"`): at half size, from three quarters down a pageless notebook's
first sheet to a third down its third; one stroke, kept on the first; the
long sheet given both sheets it runs over; the eraser put down on the third
sheet takes it; another document and back. A `tall:` line before each
capture says where it lies, and a script reads down its column for ink on
every row.
Last, a notebook's tabs (milestone 89; `writtenTabs`, alone with `"part":
"tabs"`): `new tab` from `more`, the child's page setup read against the
parent's, the rail's name field typed into, then `dev_ink_state` asked for
its one surface each time a tab is pressed in the rail (the rig's tap):
its sheets must be the open notebook's, with none of the other's strokes
on them from the first time a surface is there again, and it must lie on
the rectangle the page gives it beside the rail, folded, unfolded and on
its side; each tab at its own zoom; a tool's settings and page setup left
open across a switch; `+ add tab` over paper; `tabs` off and on. On the
Mac (`writtenTabsMac`, `ILMI_PART=tabs`): the same from `more`, a typed
note as a third tab, the bar's `tabs`.

`ILMI_SMOKE=sharp` (milestones 86, 87), a simulated iPad under the touch
rig, over a copy of the sample (`vault` in `smoke.json`): how sharp ink and
paper are on the glass, and how pages zoom and scroll. A notebook of blank
paper (a surface, as above): a level, an upright and a slanted stroke and a
tight curl in the even line, the pen (its width changing along it) and the
highlighter (`dev_ink_stroke`; a point may say its own size), then the
pages at fit, 150%, 300%, 137% and 73%, where the sheet must lie on whole
pixels of the screen, unstretched, its picture a pixel for a pixel. A
`geo:` line says where every stroke lies in the capture and
`dev_ink_picture` writes the three pictures, so a script measures each
edge on the glass, in ours, in PencilKit's and in PencilKit's oversampled
(the width over which it goes from 10% to 90% of its ink; a perfectly
drawn edge measures 0.8 to 1.6 px that way, by where it falls on the
pixels). Then ruled paper (`rules:`), and the zoom and scroll (alone with
`"part": "zoom"`), each after a `mark:` line: two fingers spread slowly,
closed slowly past fit, a quick pinch, past the least and the most, a
finger's two taps (`do: tap2 x y`) to fit and back, a stroke written and
the pages pinched at once, a flick that coasts, the iPad turned and turned
back. After each nothing is left stretched, the sheet is on whole pixels
and drawn a pixel for a pixel, the bar says the zoom, and `sharp:` says how
long after the zoom ended every picture was made again. Last a PDF's pages
(`"part": "pdf"` alone; 86's way, the web view's layer for the pages
stretched under the fingers): the same pinches, taps and flick over the
sample's chapter with a stroke on its page, the page and its canvas on the
same pixels after each. Record the screen the while (`xcrun simctl io
booted recordVideo`): the long stroke drawn between two rules must stay
between them in every frame.

`ILMI_SMOKE=touch` (milestone 57) is three runs over one storage folder.
On the Mac, `ILMI_VAULT=<a copy of the sample> ILMI_STORAGE=<an empty
folder>`: the collection makes the storage. On the simulator, `{"mode":
"touch", "storage": "<that folder>"}`: a collection is made from the
storage (a simulator reads the Mac's disk), the chapter is opened and read,
a passage boxed and kept with the PDF (milestone 81: among its marks, in no
note), its tag's menu and the bar's `more` menu worked by taps, and the
passage synced; its `passage:` line is its boxes. Since milestone 70 the
Mac's first run also puts a PDF on its own in the storage
(`library/alone.pdf`), which the iPad opens and boxes; `create notes` there
makes a blank note for it in `fleeting` (its `alone note:` line names it),
`+` a second, and `card` on a box clips into the one in front. On
the Mac again, `ILMI_VAULT=<the collection's own folder under
collections/> ILMI_STORAGE=<the folder> ILMI_EXPECT=<the passage's boxes>
ILMI_ALONE_NOTE=<that note's path>`: the passage and both notes are there
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
two and a half minutes). Every touch it makes is the runner's own pointer
path (`fingers` in `TouchRig.swift`), a tap and a drag too: XCUITest's
public calls (`tap()`, `press(forDuration:thenDragTo:)`) first find the
application and read its whole accessibility tree, before the touch and
five times after it, which over a long typed note is 10 s before a touch is
made and 30 s before the next can be. A smoke that waits 20 s for what a
tap does then saw taps that did nothing: they landed after it had given up,
or on what it had moved to since (`ink` stopped so at a note's ink area
every time, `phone` at a different button of the foot's bar each run; the
app's own record of the touches it met, `touchLog` in `dev_ink_state`,
showed none had come). A pointer path asks the app nothing; the window's
frame is read once and again when the device is turned. What the public
calls gave without being asked is given on purpose: no touch sooner than
three quarters of a second after the one before it (they waited for the
app to be idle, and a smoke asks for a touch the moment it sees what to
touch, while a sheet is still coming in or the pages are still settling;
two taps closer than that are also a double tap to the web view); a moment
before `type`; a tap is down, still there 0.04 s on, and up (one point
alone was no tap to the page's buttons, a tenth of a second none to a row
of the tree; the system's colour wheel is put away only by a longer one,
which a smoke asks for as `press x y 0.12`); on its side a path's places
are turned into the upright screen's (`screen`: a record said to be on its
side put its taps elsewhere); every run begins upright; `tap2` alone is
still XCUITest's own `doubleTap()`. `TEST_RUNNER_PUBLIC=1` makes taps and
drags by the public calls again, `TEST_RUNNER_SIDE=public` only while the
device is on its side.
That runner makes fingers only: Xcode 27.2's
XCUIAutomation has no stylus among its pointer paths, so the Pencil's path
never reaches the page; a dev run says a finger stands in for it
(`dev_ink_pen`) and the `touch` smoke's one `pen` press is an event it
makes itself, which boxes nothing. `src/app/touch.ts` holds the three timings (a finger's hold before
a box, the long press, how long a touch rests before the system's own
selection is kept off).

Ink lies over the web view (milestone 69; `src-tauri/ink`: `ios/` is the
Swift package Tauri builds into the app, `native/ink.m` what reads a drawing
as strokes and draws them, on the Mac too). Nothing opens: a layer above the
web view takes no touch and holds a PencilKit canvas per sheet (a PDF's page
or a written notebook's near the screen, or an ink area a typed note
already holds), each canvas's drawing recogniser moved
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
(`dev_ink_state` says how everything stands). The tools are the page's
(milestone 82; `InkBar.tsx`, `inkTools.ts`): there is no `PKToolPicker`.
`ink_tool` gives every canvas the pen or the highlighter (PencilKit's
inks); the eraser and the lasso are the plugin's own, worked from the
touches its watcher sees, since PencilKit's do nothing through a recogniser
moved onto the web view. One undo manager is every canvas's (`ink_undo`,
`ink_redo`, and a `history` event when what can be undone changes);
`ink_finger` is `draw with finger`; `ink_color` puts up the system's colour
wheel as a popover from the swatch. A tool's colours are as many as it has
(2026-11-25, `Kept.colors`, 1 to 12; kept shape 3, where the wheel's own is
`CUSTOM` -1): `+` after them (`ADD`) opens the wheel for one more, in use
(`withAdded`); one held has its menu (`SwatchMenu`: `change colour` is the
wheel for it, `remove` is `withRemoved`, one kept at least). The run
(`.ib-sw-run`) is as wide as its swatches while the row has room, the
spacer before undo giving way first, `+` and the wheel's ring after it;
once the row is full it shrinks, to `SWATCHES_SHOWN` (4) with the sizes on
the row and `SWATCHES_MID` (2) without, and scrolls, the one in use kept in
sight (2026-11-22). `rowFit(w, tool, swatches)` counts those least widths
(`ROW_FULL` and `ROW_MID` are the row with four; a tool with fewer needs
less), so more colours never need more of the row. `"part": "colourgrow"`
logs and captures the row with 4, 6, 8 and 12 colours upright and on its
side, in a notebook and a book with its notes open; `"part":
"colourremove"` removes them by a finger's hold, down to one, in both. `written`'s `"part":
"colours"` adds, changes and removes them under the rig and with
`"relaunch": "1"` finds them after a launch. A book with no notes may want
none (2026-11-22): its `⋯`'s `no notes for this book` (`more-no-notes`,
`setNoNotes` in `book.ts`) writes `notes: none` (FORMAT.md §3; a PDF on its
own keeps it in its `reading.json` entry, §1), `DocInfo.noNotes` follows,
and its bar has no `create notes` nor `+`; `openNotes` (the `⋯`'s `create
notes`, ⌘\) clears it first. It replaced a global `notes button` tweak; a
stored value of that is ignored. `"part": "notesbar"` drops two PDFs on
their own, says it of one, and with `"relaunch": "1"` over the same
collection (`novault=1` and `vault=` its path in the collections home)
finds it after a launch and clears it both ways. A tool's width is its three sizes'
(2026-11-25): the size in use pressed again sets `sizing` in
`useInkTools` (`pressSize`), and its width is a slider under it on the row
(`SizeSet`) or, where the row is narrow and the sizes are in the tool's
settings, under them there (`WidthRow`); `setWidth` keeps it in that size,
on the device with the rest of the tools. The tool pressed again opens its
other settings, with no width. A size's mark is as thick as its width, by
ratio over the tool's own range (`SizeMark`). `written`'s `"part":
"presets"` sets the pen's three under the rig, and with `"relaunch": "1"`
finds them after a launch.

Since milestone 85 a page's canvas stays on the screen at rest (`ink_fill`
with `show`; since 89 only a phone's notebook's, see below: a PDF's page
draws its own ink): what is written on a page is drawn by PencilKit from the
strokes at the canvas's zoom, whatever size the page is, and the picture of
it (`store_ink_page`, now with a `scale`) was what a Mac and a phone showed
(they draw the strokes themselves now, as paths: see `PageInkSvg` below)
and what an iPad showed until a page's canvas had been filled. Before, a
kept page was shown as a PNG at two pixels to the point of the page,
stretched to the page's size: softer than the live stroke at fit on every
iPad, and more so zoomed. The canvas is laid on the page as the picture
was (`blend`: a compositing filter on its layer, multiply or, on dark
paper, screen), and since it lies over the web view it stands aside for
what the page lays over the pages: the scene carries `holes`, the
rectangles of menus, a tool's settings, the overview, a notice (`OVER` in
`ink.ts`), which are cut out of the layer's mask and where no touch arms a
sheet. The typed notes' ink areas still rest as pictures.

The rest of 85 on the native side (`InkPlugin.swift`, `Shapes.swift`): the
tool carries a pen's ink by name, a highlighter's opacity, the eraser's
way and whether a rested stroke is a shape; `ink_caps` says the inks this
PencilKit has and their widths. The eraser's `part` cuts a stroke where it
is crossed (`Shapes.cut`: the path sampled, the run under the eraser taken
out, each run left a stroke of the same ink). A pen's stroke ended with
the Pencil resting (`PenWatch` knows when it last moved) is looked at once
PencilKit hands it over (`Shapes.find`: a line, an arrow, a rectangle, an
ellipse, each only when plainly that) and replaced, one more undo step.
The lasso's selection is told to the page (`picked`, `unpicked`, `rest`
events), which draws its menu in the scroller's content (`InkMenu`,
`PageTools.tsx`); `ink_selection` and `ink_paste` act on it, each a step;
a stroke changed in a way its name does not cover (its colour) is made a
moment later, so the store takes it for a new one. A pinch and two- and
three-finger taps are recognisers of the plugin's on the web view
(`pinch`, `fingers` events, `onFingers` in `ink.ts`), because where a
finger draws the web view is not given a finger's touch on a sheet; the
page stretches its pages with a transform while the fingers are down and
tells the canvases the same (`ink_pinch`), then lays them out at the new
zoom. `UIPencilInteraction` gives the double tap and the squeeze
(`pencil` events). `pages_pdf` writes pages as a PDF (`native/ink.m`,
CoreGraphics, on the Mac as on iOS: a notebook's paper as lines, a PDF's
page as the PDF's own, the ink as a picture at four pixels to the point,
multiplied), and `ink_share` puts up the share sheet for it.

Since milestone 87 a written notebook's pages on an iPad are not the web
view's at all. They are one native surface (`Surface.swift`): a
`UIScrollView` the plugin lays over the web view where the page says its
pages go, so the scroll, its coasting, the pinch about the fingers and the
give at either end are UIKit's, and nothing of ours runs while they move.
The page (`surface.ts`, the `native` branch of `Pdf.tsx`) says one thing,
`ink_surface`: a rectangle, the notebook's id and its sheets, the paper and
its colours (`paperLook`), the passages' boxes, and the holes, the
rectangles of whatever the page draws over the pages (`holesOver`: a menu,
page setup, the overview, a notice, the box's bar, found by asking what is
at a grid of places over the pages' place). It is said again only when one
of those changes, never for a scroll. The surface is cut away at the holes
and takes no touch there. It says back, through the same `window.__ink`
the canvases use, `{ kind: 'surface', what }`: `view` (the page in view,
the zoom, the place at the top, where the first sheet lies and how far
apart the sheets are, at most ten times a second while the pages move and
once when they rest), `zoomed`, `want` (sheets come near whose strokes it
has not been given: `ink_fill` answers, as for a canvas), `grow` (a stroke
begun low on the last sheet), `add`, `boxed` (a held finger's box),
`tag`, `tap`, `touch`, `moving`. `ink_surface_do` asks it to `go` to a
place or `zoom` to a zoom. What stands on the pages and is the page's to
draw (the lasso's menu, the box's `passage`/`card` bar) is drawn in the
placeholder at the place the surface said, and goes while the pages move.
Hidden `.pdf-page.sheet-place` elements in the placeholder lie where the
surface says each sheet is: nothing is drawn there, but a menu's place and
a check's touches are reckoned from them.

Inside the surface every sheet is a view in one zooming view. While two
fingers are down the scroll view zooms that view (the sheets' pictures
stretched); when the zoom ends, in the same turn of the main thread, the
sheets are laid out at the zoom it ended at, each on whole pixels of the
screen, the scroll view's own zoom is one again and its offset is where the
same place of the same sheet was (`rebase`). The room round and between the
sheets grows with the zoom, so what is laid out is what was stretched. A
sheet is one picture of its paper and its ink (`Paint.swift`), made off the
main thread at a pixel for a pixel of the screen; past a count of pixels by
the device's memory the picture stays coarser and the part in view is drawn
over it, a pixel for a pixel (`fine`). A change (a stroke written, erased,
moved, undone) is drawn at once in a patch over the pictures and the
pictures made again behind it. A sheet far from the view has no picture.

The ink at rest is not PencilKit's drawing (`native/stroke.m`, for the Mac
and iOS alike): each stroke is an outline filled by Core Graphics. What
PencilKit makes of a stroke was measured from its own pictures: a pen and
the even line are a round nib twice the point's `size.width` less four
wide, whatever its opacity or force; a highlighter is a flat nib, 1.34 by
0.47 of the point's size, lying the way its azimuth says, laying three
quarters of its colour. A pen's and the even line's outlines differ from
PencilKit's by under a twentieth of a pixel in place and width; a
highlighter is filled once, flat, where PencilKit's is denser along its
nib. A fountain pen's and a pencil's strokes are PencilKit's picture of
that stroke, made with twice the pixels. A highlighter's strokes lie under
the rest, and the ink is one layer multiplied onto the paper (screened on
dark paper, in the colours PencilKit turns ink to on a dark canvas). The
same code draws the pictures a Mac and a phone show, the overview's, a
clip's, and the ink of `pages_pdf`, which is shapes now, not a picture.
PencilKit still takes the Pencil: one `PKCanvasView` the size of the view,
standing still over the scroll view with its recogniser on the scroll view,
shows the stroke while it is written; when PencilKit hands it over
(`canvasViewDrawingDidChange`) it is moved into its sheet's points, kept in
the sheet's `PKStroke`s (what is stored and synced is as it was), drawn by
us, and the canvas emptied in the same turn. The eraser, the lasso (what it
holds lifted into a picture of its own while it is carried), shapes, undo
and redo work on the sheet's strokes. The typed notes' ink areas, the Mac
and a phone's notebooks are as they were: the canvases over the web view
above. A PDF's pages are next.

Since milestone 89 what is written on a PDF's page is drawn by the page
itself, wherever there are canvases (`pageInk.ts`, `PageInkSvg.tsx`). Until
then a page's ink at rest was its `PKCanvasView`, a native view over the web
view, kept on the page by words across the bridge: the page's layout is
WebKit's, in another process; the stretch under two fingers is a transform
this side puts on WebKit's layer and on the canvases; and PencilKit draws a
canvas again at a new zoom when it likes. Three things had to change in one
frame at the end of every zoom, and could not: a recording of the simulator
showed the ink a frame at the size it had before the zoom (off by up to a
thousand pixels of the screen across a cross drawn on the page), and after a
quick pinch 38 pixels from its place for 1.7 s; while the fingers moved, and
in a scroll, it kept to the page within a pixel or two. Now ink on a PDF's
page is an annotation of the page and is drawn like one: an `svg.page-ink`
in the pages' own column (`.pdf-ink`, where the Mac's picture of it lies),
placed as a highlight is, a path a stroke. Whatever moves the page moves it:
there is nothing to keep in step, and nothing to make again when a zoom
settles, since a path is drawn anew at any size as the page's letters are.

A stroke's outline is `native/stroke.m`'s, the one the pictures are filled
from, said as an SVG path (`ilmi_stroke_shape`: a pen's and the even line's
discs and bands, filled by the nonzero rule; a highlighter's swept bar,
filled and stroked round, laid on once at three quarters; a fountain pen's
and a pencil's as PencilKit's picture of that stroke, an `<image>`). It
reaches the page two ways, by the stroke's name. From the store, for the
strokes a page holds (`ink_shapes`, asked once a stroke). And from the
canvases' side the moment something is done: a sheet whose scene says
`vector` keeps its strokes beside its canvas (`Sheet.model`), and every
change to them (a stroke handed over by PencilKit, the eraser, a shape, the
lasso's doings, an undo) is told through `window.__ink` as `{ kind: 'ink',
sheet, seq, names, add }`: the names it holds now, in order, and the outline
of each the page has not been told. (The names are asked of the drawing
whole, `ilmi_drawing_names`, as the store's are when it is kept: a stroke
taken out of a drawing by itself on the Swift side came out under another
name once the drawing had been read back from the store. A page told of a
stroke whose outline it has not asks for it, `ink_outlines`.) The page shows what was last told until
that has been kept and the store read again (`inkKept`, `storeRead`: what
was told is shown until the store's strokes and their outlines are in hand,
and the two change places in one step). What the lasso carries is moved by
a transform on its paths (`carry`) and is strokes anew where it is put down.

PencilKit's canvas is there for what is being written only. It is hidden
and empty at rest. A stroke handed over joins the model (the pen's
`pressure` applied, as on a notebook's surface) and is told at once, with
its name among `hide`: the page holds its path unseen while the canvas
still shows the stroke, so it is on the glass once, not laid on twice (ink
is multiplied onto the page: twice is darker). When the Pencil has been off
the sheet a quarter of a second and PencilKit has handed over what it ended
(`Sheet.awaiting`: a canvas emptied under the Pencil, or before a stroke
just ended is handed over, loses it), a telling without `hide` has the page
show the paths; the page says when they are on the glass, two frames on
(`ink_shown`); and only then is the canvas emptied and hidden
(`InkPlugin.settle`). For those two frames or so the strokes are there
twice; there is never a frame with neither. The Pencil down again before the
canvas could be emptied has the page hide them again. Anything else that
changes what a sheet holds (the eraser, the lasso, a shape, an undo) shows
the page's own at once. The quarter of a second is for writing on, never for
the pages moving: when two fingers begin a pinch, a host's scroller moves,
or a sheet is laid out at another size (`InkPlugin.hurry`), whatever the
canvas still shows is told to the page to show at once, and the canvas goes
when the page says it has (in a simulator 30 to 200 ms after the pages
first move; until then the canvas is carried by the stretch as before 89,
in the transaction that stretches the pages). A stroke PencilKit has not
yet handed over when the pages move is shown by the page from the moment
it is. And a canvas is never laid out anew over strokes the page was told
to show: the page laid itself out after it was told, so the canvas is
emptied in that turn instead (`settle(force:)`, at least 50 ms after the
telling). A highlighter's stroke is handed over at once, pause or no:
PencilKit lays one it has taken over on more heavily than while it was
written and than the page does (in a simulator's capture its yellow on
paper goes 72, 19, 63 of 255 in blue: written, taken over, the page's), and
a quarter of a second of that is seen. 86's pinch is as it was (the
web view's layer stretched under the fingers): the ink is inside that layer
now. `dev_ink_state` says of each sheet `vector`, `live` (the strokes still
on PencilKit's canvas), `said` and `seen`, `hurriedAfter` and `hurriedFor`
(the last time the pages moved with strokes on the canvas: ms after the
lift, and ms until the canvas was away), and `trace` (what happened to what
was last written, each with its ms from the lift).

The stroke being written is ours too (2026-11-21, `ios/Sources/Live.swift`),
on every surface that writes: a notebook's, a PDF's page, a typed note's ink
area. PencilKit still takes the Pencil (its canvas, its recogniser, its palm
rejection, the `PKStroke` it hands over), but its canvas is given the ink
with no colour (`LiveInk.unseen`), and what is seen while the Pencil writes
is a layer inside the canvas (so it is placed, sized, blended and hidden as
the canvas is), drawn from the touches the watcher sees (`PenEars.penSample`:
every touch the system coalesced into an event, and those it predicts for the
next frame). The stroke is a `PKStroke` made of those touches, the predicted
ones left off at the lift, drawn by `native/stroke.m` (the outline filled,
`ilmi_stroke_outline`; a fountain pen's and a pencil's as the picture the page
is given, `ilmi_stroke_page_picture`, brought down to the glass with mipmaps
as the web view brings an image down, under one random seed from the first
touch to the last so a pencil's grain does not change). A point's size is
the ink's own: a pen and the even line `(width × f + 4) / 2` (the round nib
`stroke.m` draws is twice that less four, so a 0.3 pt pen is 0.3 pt, under
PencilKit's thinnest), a highlighter two thirds of its width, a fountain pen
`(2.03 + 0.62 × width) × f` and a pencil `0.707 + 0.2055 × width` at half
opacity (PencilKit's own, read off its strokes). `f` is the pen's pressure
by a mapping fixed at the touch: `1 + pressure × 0.85 × (force − 1)` with the
force evened with the touches before it, never after, between 0.3 and 2.4;
1 for a finger and for the inks that do not follow the hand. When PencilKit
hands its stroke over, the one drawn for it is kept in its place
(`InkPlugin.keep`, when it begins within 12 points of PencilKit's; else
PencilKit's own, reshaped by `sensed` as before, which `dev_ink_state`
counts as `liveMissed`): nothing is drawn again at the lift. The layer's
ended strokes go when the canvas is emptied (the page or the sheets show
them) or, in a typed note's area, when the canvas's drawing is the area's
again. On a PDF's page in the dark theme the layer turns its colours as the
page turns its ink (`invert(0.92) hue-rotate(180deg)`), not as PencilKit
turns a colour on a dark canvas, which is what the notebook's sheets show.
Under study (2026-11-24): `LiveInk.pencilKit` has PencilKit draw the pen
and keep its stroke its own. PencilKit's tool is no thinner than 0.878 pt
(a pen) in its canvas's drawing, but its drawing of a stroke is as thin as
the stroke says. So a PDF's page and a notebook's surface draw in a space
`LiveInk.scale` times the sheet's points (four, or less where the ink's
widest needs it), the tool that many times as wide, and the stroke is kept
under a transform of one over it, its random seed marked
(`ilmi_stroke_seed_drawn`) so that `stroke.m` draws it as PencilKit's own
picture. `written`'s `"part": "pkside"` puts the two side by side; `pdfink`'s
live check runs in the mode with `"pk": "1"`; `"part": "pkwidth"` and
`pencilDev` `pkthin` are the experiments that found where the least lies.
Each place of ilmi's own stroke is evened along it, centred
(`LiveInk.along`, 2 screen points), and its force over 50 ms
(`LiveInk.forceSpan`, 2026-11-25: the width's ripple on a device's strokes
was what was left to see), both by `LiveInk.evenOne`. `written`'s `"part":
"replay"` makes a device's logged strokes again on a notebook (`pencilDev`
`replay:<sheet>:<surface>:<dx>:<dy>`, the log as `replay.jsonl` in the
app's temporary folder; `force-<ms>` sets the span for a run).
`LiveInk.ours = false` (one constant at the top of `Live.swift`) gives the
stroke being written back to PencilKit's canvas and keeps PencilKit's
stroke, reshaped, as before. The eraser and the lasso were ours already.

`pdfink`'s `"part": "live"` is a check: for the pen at 0.3, 0.6 and 2.2, the
even line, the fountain pen and the pencil each thin and thick, the
highlighter at 7.5 and 16, and the dark theme's pen, fountain pen and
highlighter, a line ending at rest is captured while it rests and after it
lifts; it fails unless the stroke on the glass while it was written and the
one kept have the same mean width (`lastWidths`, within a hundredth) and a
pen and the even line keep the width asked (within a fiftieth), and unless
none was kept as PencilKit's. The `written` and `ink` smokes fail if a
stroke was (`liveMissed`). `"part": "lag"` (`"lag": "kit"` for PencilKit's
drawing) writes three lines under a frame clock (`pencilDev` `clock-on`:
twelve squares at the window's foot count the frames in binary; each frame's
number and when it is to be on the glass, and every touch, are written to
`live-clock.txt` in the app's temporary folder), for reading against the
screen's recording frame by frame (BUILD-LOG, 2026-11-21).

A stroke is smooth at any zoom (2026-11-22). A touch's place is taken
precise (`preciseLocation`): UIKit's `location` is rounded to the screen's
points, and a stroke made of places rounded so and divided by the zoom it
was written at is a run of short straight steps meeting at corners, which
is what strokes written before looked like at 250%. The outline walks the
stroke's curve a fifth of a point at a time (was a half: at 400% a curve
showed as straight pieces) and keeps a place unless the outline without it
is within 0.004 points. A stroke whose points were rounded (every move from
one point to the next a whole number of one step, nine in ten of them:
`roundedTo` in `stroke.m`) has the middle of its outline evened along the
path, a Gaussian whose sigma is twice that step; its radii are left as they
are, so no stroke is drawn wider, and it moves less than the rounding it
takes out. A stroke taken precise is not evened, so the stroke being
written and the one kept are still one. The rule for smooth is the turn
between neighbouring two-pixel pieces of the outline's middle as the glass
shows it (`ilmi_stroke_turns`, `lastTurns` in `dev_ink_state`). The Mac
harness in BUILD-LOG (2026-11-22) measured it against the true curve, and
against a port of perfect-freehand's outline (MIT, Stephen Ruiz:
streamline, outline, quadratic midpoints), which did not take the rounding
out and was not taken. `written`'s `"part": "smooth"` (iPad, under the rig)
writes a word at 100%, 250% and 400% and puts a stroke rounded as before
under it, with the outline as it was (`pencilDev` `smooth-old`) and as it is
(`smooth-new`); `smoothgeo:` lines say where each is in its capture.

Each touch's place is also evened as it comes (2026-11-23, `LiveInk.Even`,
a one-euro filter in the screen's points: below 8 Hz at rest, 0.2 more per
point a second, so a slow hand's tremor goes and a fast one is not dragged
behind), and the force over 30 ms by the clock. A predicted touch is evened
from where the filter stands without moving it on; held still, or lifted,
the stroke ends where the Pencil truly is (the evened place trails it, and a
Pencil held still sends nothing to catch up with). The places kept are the
evened ones, so the stroke written and the one kept are still one; the
device's log keeps the touches as they came. `smooth-old` has neither.
`"part": "smooth"` also puts a level line on at 100%, 200%, 250% and 400%
with an `inkgeo:` line for `scripts/ink-thin.py` (the sheet's picture's
edge). The device's log (`InkLog` in `Live.swift`): `Library/Caches/
ilmi-ink.log` in the app's container (`dev.ilmi.app`), a JSON line a stroke
for the last twenty or so: every coalesced and predicted touch as it came
(precise and rounded place, time, force, altitude, azimuth), the zoom and
the screen's scale, the stroke's control points, its outline's middle after
evening, the step it was found rounded to and the sigma it was evened by,
and its turns; on in every build (`InkLog.on`); pulled with `xcrun devicectl
device copy from --domain-type appDataContainer --domain-identifier
dev.ilmi.app --source Library/Caches/ilmi-ink.log`.

On a PDF's page the eraser is on the glass at once (2026-11-22). The page
draws its ink in the web view's process; told of what an eraser left, it
drew it 40 to 55 ms later, and a telling each move (each with every name
the page holds) came faster than it drew them, so a stroke went up to
190 ms after the eraser touched it. While the eraser is down the sheet's
strokes are drawn natively in a layer inside its canvas (`EraseGlass` in
`Live.swift`, the same drawing as the stroke being written:
`LiveInk.paint`), by name, and the page is told to hold all of them unseen;
what the eraser takes goes from that layer in the turn it is taken, what it
leaves of a stroke cut comes into it, and a telling waits while the page
has yet to draw the one before (`tellLater`; a quarter of a second at
most). When it lifts the page shows its own again and the layer goes when
the page says it has drawn that (`shown`), or after a second. On a
notebook the eraser draws the place again at once, as before; a place
over four million pixels is now drawn at once with fewer pixels (sharp a
moment later with the sheet's pictures) where it was left to the pictures.
`written`'s `"part": "erase"` (`"where"` `notebook` or `pdf`, `"emode"`
`stroke` or `part`) puts 300 strokes and six red ones on a page and draws
the eraser across the red ones under the frame clock; `erasegeo:` says
where they are, and `dev_ink_state` what each move cost (`eraseHit`,
`erasePut`, `erasePatch`, `eraseShown`).

A stroke is on the glass once at the hand-over, by construction. Told by
a message that the page has drawn a telling, the canvas was emptied some
frames after the page's path was on the glass (both for those frames: ink
laid on twice); emptied first, there would be frames with neither, which
shows on every ink. The web view's layers are put on the glass by the app's
own process, in a transaction on the main thread that applies what the
page's process committed, and that commit carries the size of every
scroller's content. So a telling that shows what the canvas still shows
carries a ticket (`stamp`); the page, in the turn it draws the telling,
sets the height of what a tiny scroller of its own holds to the ticket
(`signalDrawn` in `pageInk.ts`: 3 by 5 px, fixed at the window's corner);
the web view makes that scroller a `UIScrollView`, which the plugin finds
by its size (`bindSignal`) and whose `contentSize` it observes: the
observer runs inside the transaction that puts the paths on the glass, and
empties the canvas there. One frame has the canvas's stroke, the next the
page's. `Sheet.trace` says it: `on the glass, ticket n` and `emptied` at
the same millisecond, the page's message (`drawn n`, still heard, for a web
view that makes no scroll view of the scroller) some tens of milliseconds
after.

And a pen's stroke is one colour over print, written and at rest, by
construction too. A simulator cannot show what a device makes of a
compositing filter over PencilKit's own layers (there it does nothing, see
below), so nothing rests on it for a pen: on a PDF's page a pen's ink lies
over the print as it is, PencilKit's canvas laid on plainly while a pen
writes (`InkPlugin.lay`) and the page's path laid on plainly at rest; only
a highlighter's strokes are multiplied (screened on a dark page), in a
drawing of their own under the pen's (`svg.page-ink-under`, `pdf.css`: the
layer `.pdf-ink` is no group of its own on a PDF's page, or the blend would
be shut in with nothing under it), and the canvas is laid on that way while
the highlighter is held. The PDF passed on does the same on a PDF's own
page (`ilmi_ink_pdf`). A notebook's sheets are as they were: one layer of
ink multiplied onto the paper. In the `look` part's captures a pen's stroke
over print is now the same written, taken over and at rest (246, 122, 62
against 245, 122, 61; it was 254, 126, 63 against 195, 97, 49); a
highlighter's still differs in a simulator while it is written (the filter
does nothing there) and for the tenth of a second until the page has it.

The pen's `pressure` and a width under PencilKit's thinnest are one
function for every place a stroke is written (`InkPlugin.sensed`): a
notebook's surface, a PDF's page (which had an older pressure and no
thinness) and a typed note's area (which had neither: PencilKit's stroke
was kept as it came). An area's canvas is its sheet, so what PencilKit adds
to it is taken as a page takes it (`took`): made what `sensed` has it, and
a step of the plugin's own to undo, the canvas's undo being its `scratch`
on every sheet now. `dev_ink_stroke` takes a force a point (a fourth
number) and `hand`: the stroke is given to the canvas as PencilKit's own,
so it goes the way a written one goes. `"part": "pressure"` of `written`
hands the same stroke, its force rising, to a notebook's sheet, a PDF's
page and a note's area under the pen as it is, following the hand not at
all, twice as much, and at 0.4 points (PencilKit's thinnest is 0.88), and
compares what the store keeps of each by its outline's nib.

A stroke has one name, in hand and in the store (`nameOf`, `native/ink.m`).
PencilKit writes the even line (`monoline`, the pen as it starts) into a
drawing's bytes as a pen, and the name is a hash over the ink's kind among
other things: named in hand a stroke said `monoline`, named from the bytes
`pen`, and the page drew a stroke just written under a name the store
never kept. The name takes the even line for the pen it is saved as (the
store's names, always made from bytes, are what they were). A stroke
PencilKit's own eraser has masked moves by a hundredth of a point in its
mask through its first trip to bytes, and so is named anew once; the
app's eraser cuts strokes and makes no masks. Read back from the store,
kept again with strokes erased or added, set and set back, every stroke
keeps its name (run inside a simulator and on the Mac): an erase on a page
loaded from the store writes the erased rows and nothing else.

(Before the two paragraphs above were so:) what the canvas's compositing
filter does could not be shown in a simulator: there PencilKit's ink over the web view covers the print under
it, written or taken over, whatever the filter (and a canvas made a group
by an opacity under 1 does the same), and the page's own lets the print
through. `"part": "look"` of the `pdfink` smoke captures a pen's and a
highlighter's stroke three ways (under the finger; lifted with the
hand-over held back, `dev_ink_pen` with `keep`; the page's) and
`scripts/ink-look.py` compares them: on paper the pen is the same to a
level in 255, on print it is the ink's colour until the page has it. `ILMI_SMOKE=pdfink` (an iPad's, with `vault`,
under the touch rig, the screen recorded) writes a cross on a page between
two squares that are the page's own element and pinches, taps, drags and
flicks; `scripts/ink-scan.swift` reads the recording's frames and
`scripts/ink-measure.py` says how far the cross lies from where the squares
put it in each part. Its `lift` part is the pages moved before the writing
has paused: the rig's `wpinch` is a stroke and, a tenth of a second after it
lifts, two fingers, in one record (a second ask could not be read that
soon), with `dev_ink_pen`'s `once` making the finger a Pencil for that one
stroke; the measure says how far the stroke lies from its place on the page
in every frame from the one the pages first move in, and whether it is ever
gone or laid on twice. `finger` is `draw with finger` on a PDF's page;
`share` and `turned` (with `"books"`: `design/books/turned.pdf`, a page
turned a quarter by `/Rotate`) pass the PDF on with what is written on it,
and `scripts/ink-export.py` draws the file's page (`scripts/pdfpng.swift`)
and looks for the ink where it was written. On a phone the same smoke with
`"part": "most"` needs no rig. Since these gaps were closed a Mac draws a
PDF's writing the same way, from what the store holds (`vectorInk` in
`Pdf.tsx`): one renderer. Since the round after, a notebook's sheets read
on a Mac or a phone are drawn the same way (`PageInkSvg` with the sheet's
`paper`, whether it is dark, and `run` for a pageless one, whose drawing is
as tall as its ink reaches (its own box: what overflows a box far off the
screen is not painted) and is kept while any of the eight sheets after it
is near the view (`RUNS_OVER`)), and a phone shows no canvas over a
notebook: a picture of the sheet at two pixels to the point
was shown over a 3x screen's 1.68, and stretched as the pages were zoomed,
and the canvas PencilKit drew over a paged sheet made every stroke under a
pixel a pixel and a half wide and soft. `written`'s `"part": "thin"` (a
phone, no rig) hands strokes of 0.2 to 2 points to a sheet and captures it
at fit, zoomed to four times and pageless; `scripts/ink-thin.py <run dir>`
reads each stroke's darkness, width and edge from the captures. The page
grid's small pages are pictures still (`store_ink_page`).

Two fingers stretch the pages' own layer in the web view (`pagesLayer`): it
must begin at the column (a page's shadow above it and no more), never be a
layer that holds the bar over the pages too. `dev_ink_state`'s hosts say
where the layer they would stretch lies (`stretched`), and `pdfink`'s
`"part": "bar"` (with `"books"`; only when asked for) opens a paper of four
pages, checks that, and pinches out and in for a recording whose bar rows
are compared frame by frame.

Under a finger the rows over a book's pages (`.meta`, `.pdf-bar`) are not
in the scroller: `Pdf` gives the pane a place for them over it
(`.book-head`, after `.book-pages` in the tree so a book's first `.pdf-view`
is still its pages') and `Pages` draws them there through a portal
(`overPages`, `outside`), wherever the pages are the page's own. A row that
sticks in a scroller goes with its content when a finger pulls it past an
edge. What reads the rows asks `inBar`; the place kept at the top of the
view is `PLACE_OUT` down the scroller. `written`'s `"part": "stays"` (a
phone, under the rig) and `pdfink`'s `"part": "bar"` pull the pages past
each edge at twice their size and read the rows' place every frame
(`pullsStay`). `pdfink`'s `"part": "word"` and `"part": "held"` (only when
asked for; counts, not checks) tap `notes` in the bar round after round,
plainly or after a heading of the note is held for its menu, the page
keeping every touch, press and click it meets, so a tap that does nothing
is told apart: never met by the page, met on the word, or met on something
else. `touch`'s `notes:` lines say what the book, the word and the panes
hold before each tap on the word and when one does not do its work.

A PDF's pages as pictures: `ilmipage://localhost/<hash>/<page>?root=<the
collection>&w=<pixels across>&q=<quality>` is the system's own drawing of a
page (`ilmi_pdf_page` in `native/ink.m`, on a thread of its own in
`lib.rs`), a JPEG, or a PNG at `q=1`; `pdf_sizes` gives every page's size.
The reader lays its pages out by those sizes before pdf.js has the file
open and keeps each page's small picture under it (`img.pg-low`, `lowUrl`,
`picturesOf` in `Pdf.tsx`); pdf.js still draws the sharp page, the text and
the links. `pdfink`'s `"part": "draw"` times a page each way and checks the
two agree on the sizes; `"part": "feel"` (both with `"books"` naming a
folder that holds `scan.pdf` and `vector.pdf`; `"only"` for one of them)
opens, scrolls, flings, jumps and zooms, and says for each how many frames
had a page in view that was bare, or only its small picture. `"part":
"zoomfeel"` (with `"books"` holding `vector.pdf`; `"pinch": "1"` under the
rig for the two-finger cases, `"cases": "pinch"` for those alone, `"far"`
for the two that go from 200% or 250% out to 50% where the pages coming into
view were never drawn; `"slow":
"<ms>"` holds each page's drawing back that long a screen's worth of pixels,
as a slower device would take; `"measure": "1"` makes the checks counts)
zooms by the bar's − and + one step and several, out to 50% and in to 400%,
scrolls down and across at 250%, and pinches in and out. Every frame each
page in view is sampled on a grid of its own points: what shows there (its
canvases and pictures by their opacity) and how much detail that is against
the screen's pixels. Hard checks: no frame where a point shows less than the
frame before would with its pixels only stretched, none blank, the writing on
a page there and on its page in every frame, and nothing under the eye moved
more than 2 px in one frame after the zoom is laid out. A screen recording of
a simulator with no window open (`simctl io recordVideo`) holds a few frames
a second, too few to judge a blink by; the page's own frames are the measure.

A page's layers, bottom to top (`Pdf.tsx`, after pdf.js's own viewer): its
small picture (`img.pg-low`), a middle-sized one where it is in view and its
drawing not yet as fine as the screen (`img.pg-mid`, up to 1280 px; zoomed
out, the page sharp at once), its whole drawing (`canvas.pg-base`, at most
5.2 MP on a device), the part in view drawn sharp over it where the whole is
coarser than the screen (`canvas.pg-detail`, up to 8 MP with what lies about
it, by fractions of the page), and its text. A zoom keeps all of them: they
fill the page's box, so they are the same picture larger or smaller, and the
text follows by `--total-scale-factor`. A page is drawn again only where what
it has is too coarse for the screen now (`baseWill`, `wants`), and what is
drawn goes in only once it is drawn, never for something coarser. The bar's
steps and ⌘= ⌘− zoom about the middle of the view. That is the Mac's way, and
any device's without the app's drawing.

On a device (iPad, phone) the app draws the pages itself: tiles from
`ilmipage:` (`img.pg-tile` in a `.pg-tiles` layer a zoom, bands up to 2048 ×
384 px of the page as drawn at the size it is shown, for what is in view and
half a view about it), Core Graphics on a few worker threads at once
(`src-tauri/src/pages.rs`: as many as the cores, two to eight, the asking with
the least `p` first, an asking of a zoom gone by, `g` older than
`pages_generation` says, not drawn; `native/pdfpage.m`'s `ilmi_pdf_region`,
each thread its own open documents). A band rather than a square because
Core Graphics reads the whole page for each tile, and a page of type is mostly
reading. A zoom keeps the old layer under the new one's until those cover the
view. Each page near the view has its middle-sized picture (1024 px, `k=mid`),
kept on disk among the app's caches (`ilmi-pages`, 160 MB, the oldest let go)
and the latest pictures in memory (64 MB); the pages a little further on have
theirs made ahead. pdf.js gives only the text, the search and the links.

The zoom log: a line per drawing (`draw kind=tile|mid|low|pdfjs-text page= w=
px= from=drawn|disk|memory wait= draw= make= all= depth=`) and a line per
zoom (`zoom from= to= sharp=<ms until every tile in view was there>
pictured=<ms until every page in view showed a picture> tiles= ...`), each
after the time in ms since 1970, in `Library/Caches/ilmi-zoom.log` of the
app's own container on an iPad (in the app's caches on a Mac), begun anew past
512 KB with the one before kept as `ilmi-zoom.1.log`. From a device:
`xcrun devicectl device copy from --device <udid> --domain-type
appDataContainer --domain-identifier dev.ilmi.app --source
Library/Caches/ilmi-zoom.log --destination <file>`. The native page view's prototype (phase 1, `Reader.swift`, `ink_reader`,
debug builds only) and its plan: `docs/native-reader-plan.md`; `pdfink`'s
`"part": "reader"` measures it.

The native page view itself (phases 1 and 2 of that plan), behind the
settings' `book pages: web | native` on a device (`ilmi.pdf.native` in the
device's storage; web by default): `PdfSurface.swift` lays a `UIScrollView`
of the book's pages over the pane where `Pdf.tsx` puts a `.pdf-surface`
(`ink_pdf` the spec: where, the file by collection and hash, the zoom, the
place to open at, dark, the holes, the pages shown; `ink_pdf_do` go, zoom,
find, select, clear, state). A page shows, bottom to top, its pictures whole
(half the fitted size for every page a zoom out to 50% could show, the fitted
size for the pages in view), and its tiles a layer a level (bands of 2048 × 384
px at 2, 4 times the fitted size, for the view and about it, nearest first,
drawn by `PagePainter` on as many threads as the cores, each with its own open
document); at 250% and over the level under it is kept for a wider area too,
so a scroll finds at worst a level coarser. The level the zoom has come to is
asked for while the fingers move, and the next one up is drawn ahead when the
pages rest. The pictures live in memory within a budget (a quarter of what the
app may still use, at most 640 MB) and the whole pages on disk
(`Caches/ilmi-pdf`). The surface says `pdfplace` (page, place, zoom, the read
point, settled or not, whether the page asked for it), `pdfsel` (a selection:
its text and lines), `pdfact` (`copy`, `passage`, `card` from its menu) and
`pdftap` (the page follows a link there by pdf.js's annotations). Text is
PDFKit's (`PdfText.swift`: a held finger selects a word and carries the
selection on; a search's hits found on a document of its own and drawn).
`pdfink`'s `"part": "surface"` (with `"books"`, `"pinch": "1"` under the
rig) weighs each frame natively: how many levels coarser than the zoom asks
any point over the pages in view shows. Hard checks: none two levels coarser
for more than 100 ms in any zoom, scroll, pinch or fling; the bar's zoom and
the surface's the same at rest; the place kept across a closing; two books in
two panes. `"part": "surfacetext"` (`"links"` naming around.pdf): a selection
told to the page, a held finger's selection, a search's hits, a link followed
with the way back.

The disk caches of pages (`ilmi-pages`, the scheme's, and `ilmi-pdf`, the
surface's) budget themselves by the device's free space: a twentieth of it, at
most 160 MB each, nothing kept (and what there is let go) under 500 MB free;
the oldest go first, to three quarters of the budget. The system's memory
warning lets go of the pictures in memory and cuts both to half their budget
(`DiskBudget` in `PdfSurface.swift`, `disk_budget` in `pages.rs`). `zoomfeel`'s
`"tileslow": "<factor>"` and `"workers": "<n>"` hold the app's drawings (and
pdf.js's) to that many times as long on that many threads, `"within":
"<ms>"` makes the time to sharp a hard check, and `"notiles": "1"` draws with
pdf.js as before for the one against the other. `"part":
"live"` (under the rig) is the stroke being written against the one kept,
for every ink (below, by the canvases), with `inkgeo:` lines for
`scripts/ink-thin.py`.

A large PDF on a device: `pdfink`'s `"part": "big"` (with `"books"` naming
a folder that holds `big.pdf` and `turned.pdf`; no rig) brings it in, opens
it, reads on through sixty pages, and checks the words of a file that is no
PDF and of one marked as having taken the page down (`ilmi.pdf.opening`);
`"part": "bigpull"` gives the collection a bare repository in that folder,
clones a second collection, pushes the PDF from the first and pulls it into
the second. `gaps/mem.sh`-style sampling of the page's process is by `ps`
from the host (a simulator's WebContent is a child of that simulator's
`launchd_sim`); a simulator has no memory limit, so a kill is made by hand.
`"part": "sess"` opens the session on a PDF's reading and says what its bar
offers.

`press` (`platform.ts`) lets go the one mouse press a tap sends after
itself, up to five seconds late: with a wait of 0.8 s a tap on a box's
`card` whose picker kept the page busy acted twice (the picker open again
over whatever came next: `written` failed there once in this round). The
phone smoke's `typeIn` says `keys short:` and types the rest once when the
runner's keys fall short with the caret still in the field, and its `tap`
takes a place once nothing has moved for a second: a simulator's keyboard
leaves the glass and comes back as the runner's keys come (as for a keyboard
attached), the field keeping its caret, and what stands over it moves.

`dev_ink_state` says each surface (`surfaces`: where it lies in the
screen's pixels, the zoom laid out and the stretch over it, the offset,
each sheet's place, strokes, the pixels of its picture and of the part in
view, `drawn` its pixels to a pixel of the screen, patches, the bytes the
pictures hold, the tags, `add page`, the last box) and lists a surface's
sheets among `sheets` and the surface among `hosts`, so what a check asked
of a notebook's canvases it asks of these. `dev_ink_picture` on a
surface's sheet writes three pictures of its upper left into the app's
Documents: ours, PencilKit's at the screen's pixels, PencilKit's at twice
them. `scripts/touch-rig`'s `pinch` takes a ninth number, the seconds the
fingers take on the way.

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
Each simulator run writes into the storage as it goes, a failed one too: keep
a copy of the folder as the Mac's first run left it and put it back before
a rerun. A dev build keeps its whole log in one file (`max_file_size` in
`lib.rs`): the rig counts the asks in it, and the plugin's own 40 kB limit
dropped the file in the middle of a long run.

Pairing by a code (milestone 84) is `src/app/pair.ts` (the code's text,
`ilmi-pair:` and a base64url JSON object with `v: 1`; what a collection's
code holds; the squares, from `qrcode-generator`; `joinFromPairing` for a
welcome and `fillFromPairing` for the settings), `PairRows.tsx` (the
settings' `pair a device`, the code drawn as one SVG path, and `pairing
code`), and `scan.ts` (the camera, the barcode-scanner plugin's, which is
in the build for iOS alone: `capabilities/mobile.json`, the `cfg(mobile)`
line in `lib.rs`, `NSCameraUsageDescription` in `Info.ios.plist`). The
camera is shown behind the web view (`windowed`), so while a scan runs the
page is see-through and the app hidden (`data-scanning`), leaving a frame,
a line and `cancel`. Nothing there logs, and the code is held only in the
component that draws it. `ILMI_SMOKE=pair` on the Mac, over a copy of the
sample: the collection connected to the debug build's loopback bucket,
`pair a device`, the code read back off the squares on the screen by jsQR
(a dev dependency, not the library that drew it), the text nowhere in the
store or the web view's storage, then a new collection whose `pairing code`
refuses what is not a code, takes the code, and `join…`s; then the same by
a remote, over a bare repository the smoke makes beside the sample's copy.
It makes three collections more (`pair-b-<time>`, one named for the bucket,
`pair-b-<time> 2`): delete them with the sample's. On a simulated iPhone or
iPad, `{"mode": "pair", "remote": "<a bare repository on the Mac's disk>"}`
starts at the welcome and needs no touch rig: a simulator has no camera, so
`setDevScan` (a dev build's) hands over what the camera would have read: a
camera refused, something that is not a code, a scan cancelled, then a code
for the remote, from which the collection is cloned and opened; its own
`pair a device` is then read back. No token in either is real.

The phone as a remote (milestone 90): `src-tauri/src/remote.rs` is the
server (on the local network, port 51765 or any free one, every path under a
token made at start), `src/app/remote.ts` reads the session's buttons off the
page and clicks the one a phone pressed, `src/remote/controller.ts` is what a
phone shows, written to stand alone so the page a phone's browser gets is made
from its own source (`remotePage`), and `src/app/remoteClient.ts` runs the same
controller inside ilmi on a phone over the http plugin. `ILMI_SMOKE=remote` on
the Mac, over a copy of the sample, needs no network beyond the Mac's own
address. It shows the page in a frame the size of a phone and the app's
controller beside it, drives the session with real pointer gestures on the
controller (taps to enter, reveal and grade good, a swipe left for again, a
swipe up back), and checks a stale press, a double tap, hide, stop, and that the
server is gone afterwards. 36 checks, 6 shots.

Haptics (milestone 83) are `src/app/haptics.ts`: named calls (`hapticReveal`,
`hapticGrade`, `hapticFinished`, `hapticTick`) made from the session and the
few places a tick belongs, each a name handed to `app_haptic`, which on iOS
is the ink plugin's `haptic` (UIKit's feedback generators) and anywhere else
answers null. The plugin says whether the device has the hardware
(CoreHaptics; a simulated iPhone is taken as having it, since a simulator
reports none), asked once at launch (`loadHaptics`, `canHaptics` in the
store), and the settings' `haptics` row is drawn only then. A simulator does
not shake: a dev build keeps the names asked for (`hapticsAsked`,
`hapticsAskedClear`; empty in a release), and the `phone` smoke reads them
after the reveal, each grade, a topic's `later` and the queue's end, then
turns the setting off and on by taps.

`ILMI_SMOKE=ink` is three runs over one storage folder in the same way,
over the ink a typed note holds (a note takes no new handwriting since
milestone 82). The Mac first (`ILMI_VAULT`, `ILMI_STORAGE`): it puts two
pages of ink in a long note as a note from before would hold them, a made-up
drawing's strokes each (`dev_ink_sample`) and its line between two
paragraphs. Then the simulator with `{"mode": "ink", "storage": "<that
folder>"}` and `TEST_RUNNER_MODE=ink`: each page an area in the note with
the row of tools at the pane's top; the stand-in put down on a paragraph
opens nothing; a stroke in the area, the area growing, kept when quiet; the
eraser tapped in the row and drawn across a stroke, undo and redo by their
buttons; a finger scrolling it; the second area's canvas emptied
(`dev_ink_wipe`), its line and page gone. Its `touch:` and `touches:` lines
say what a touch cost, `page:` what the page weighs, and `ink:` the two
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
the page where the finger went, the pages scrolled with it; then a written
notebook of two sheets, each written on; its `pageink:` line says the
count, where the strokes lie in the page's points, the device, and the
notebook. The Mac again with `ILMI_VAULT=<the collection's own folder>
ILMI_EXPECT=<the count> ILMI_BOX=<where> ILMI_NOTE=<the notebook>
ILMI_MINE=<its own strokes' names, from its first run's `pageink: mine`
line>`: both writings on the page, shown as a picture, and the notebook's
two sheets with theirs. The simulator again with `"again": "1", "expect":
"<the count>", "mine": "<those names>", "device": "<the device>"` added: the
collection it made, opened as it was left, holds both too. A stroke written on a book's page is a row of `ink` under `p.<the PDF's
SHA-256>.<page>` (`pageKey`, `src/vault/store.ts`), no row of the tree.

## Building the installer

`npm run tauri build` makes the macOS app and its installer:
`src-tauri/target/release/bundle/macos/ilmi.app` and, beside it under
`dmg/`, `ilmi_<version>_aarch64.dmg` (the version is `src-tauri/tauri.conf.json`'s).
Drag the app into Applications from the DMG. The build is unsigned unless a
Developer ID certificate is on the keychain, so the first launch is refused
and allowed once under System Settings > Privacy & Security (Open Anyway).

A new version is written in every place that names one, alike:
`src-tauri/tauri.conf.json` (what the Mac and the iOS builds take, and the
app's `ilmi.version`), `src-tauri/Cargo.toml` and `Cargo.lock`'s ilmi,
`package.json` and `package-lock.json`, and the iOS project's
`ilmi_iOS/Info.plist` and `project.yml` (the iOS build writes the plist
from the config, so committed it matches what is built).
`src/plugins/__tests__/version.test.ts` fails while any of them differs.

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
src/schedule/      ts-fsrs grading, the reading and writing loops, the queue query; slot.ts is the scheduler slot's pure side (which cards another scheduler is asked about, its scores laid over the queue), fsrs7.ts FSRS-7 as a scheduler in it
src/import/        text from a paste, a page, a list of cards, an Anki package, a book in EPUB, or a SuperMemo collection, on its way to a file
src/pdf/           the PDF lens's pure side: a page's text from pdf.js items, finding a passage again
src/plugins/       the plugin runtime (api.ts is the typed handle, runtime.ts the loader) and its tweaks section; scheduler.ts is the scheduler slot's runtime (what is registered, the collection's choice, the scores), index.ts starts both over the open collection
src/sync/          engine.ts merges a collection's changes by CRDT (registers by a clock, a document's text through Loro, the tree and each directory's order from the registers, change files and snapshots in a storage, the PDFs fetched when asked for; src/app/crdt.ts runs it, src/app/storage.ts makes the storages); merge.ts is git sync's merge of one file changed on both devices, src/app/sync.ts its policy over the Rust commands
plugins/           the plugins the repo ships, built by `npm run plugins`; ilmi.d.ts is the API; see PLUGINS.md
scripts/           command-line tools, run with tsx
src-tauri/         the shell (Tauri v2, fs + dialog + http + deep-link + single-instance + opener + log plugins, barcode-scanner on iOS, and ink/, its own: the PencilKit canvases on iOS and a drawing read as strokes; store.rs is a collection's SQLite and blobs, storage.rs an S3 bucket or a WebDAV folder as a storage (and a blob sent or fetched as a stream), cloud.rs Dropbox and Google Drive as storages, oauth.rs the sign-in to them and its tokens, devstore.rs and devcloud.rs the debug build's loopback servers shaped like each, anki.rs reads a package, epub.rs a book, plugin.rs a plugin zip, cache.rs a plugin's bytes on the device, fit.rs FSRS-7's weights fitted to a review log, sync.rs a folder as a git repository over libgit2); gen/apple is the iOS project
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
