# Using ilmi

ilmi is a desktop app over your notes in Markdown, kept as a *collection*: a
database of its own on your device, in which every document's text is plain
Markdown. Anything you can do in the app leaves one readable line in one
document; a folder of Markdown files is what a collection is made from and
what it exports to. This guide
walks the app the way a day goes: open a collection, bring things in, read,
write, card, and work the day's queue. The keys are listed in `keys.md`, the
file format in `FORMAT.md`, and plugins in `PLUGINS.md`.

## Collections

The app opens on the collection it had open last; the welcome (the wordmark,
`new collection`, `import folder`, and the collections there are as rows)
shows when there is none or when `reopen the last collection on start` is
off in the tweaks. A new collection is named on the welcome and starts with
`start here.md`, one short source with a card in it. `import folder` takes a
folder of Markdown files (a vault as `FORMAT.md` describes it, or any notes
you have) and makes a collection named after it, every file in it included;
a folder dropped on the welcome does the same. The folder is left as it is
and is not read again.

A collection lives under the app's data directory as one database file, with
its PDFs and images beside it. To get files back, `export collection ·
folder` in the palette writes it to a place you choose as a folder of
Markdown, each document at its path with its schedule lines in it, and
`export collection · zip` writes the same as one file. An export is what
another editor, a script, or a backup works on; what is changed there comes
back by importing that folder as a collection. Nothing else changes the live
collection.

Two copies are kept without asking for an export. `mirror` in the tweaks
(off until you choose a folder; the Mac's) keeps a folder of the
collection's name inside the one you pick as the collection is, a moment
after each change, for other tools to read: the same files an export
writes. It goes one way; a file changed there is written over by the next
change to its document, and a file of your own put there is left alone. A
folder that already holds something else is never taken: the mirror goes
beside it under the name with a number. And once a day, when the collection
is opened or the day turns, the collection is written as a zip under
`exports/` beside its database (in the app's data directory), the last
seven days kept: what to import if the database is ever damaged. It holds
every document and the state, not the PDFs and images: those are not in
the database but files of their own under `blobs/` there, each named by
its SHA-256, and the zip's `.ilmi/blobs.json` says which path is which.

While a collection is open the File menu has `New Collection…` (⌘⇧N), `New
Collection from Folder…` (⌘O), `Open Recent` (the other collections, by
name), `Import…` (⌘⇧O, files into the open collection), and `Close
Collection` (⌘⇧W), and the palette has the same as `import folder…`, `new
collection…`, `import…`, `close collection`, and the other collections under
`vaults`.

## The tree

Anything nests under anything. Drag a row onto the middle of another row and
it goes inside it: a folder at once, a document (whose children directory,
`name/` beside `name.md`, is made on demand) once the pointer rests there;
drop on a row's top or bottom quarter and it goes before or after it, and
that order is kept in `.ilmi/order.json` (`sort by name` on the menu forgets
it). A line indented to where the row will land, or a box around the row it
goes into, shows the drop before it happens; below the last row of a group,
moving the pointer left lands it further out. The same drag works in the tab
rail and the folder lens, and between them and the tree. With the tree
focused: ↑↓ → ← ⏎, F2 renames, ⌘⌫ deletes, ⌥⌘↑↓ moves a row among its
siblings, ⌥⌘← → outdents and nests it, a letter jumps to a name. ⌥-click a
row to hoist it. The menu's `new …`
on a document makes the new item inside it, `move to…` lists documents as
well as folders, and a document's children open as a folder lens from its
inspector's `children` line or ⌥-click on its chevron. Deleting a document
with children asks first. Every delete leaves a notice whose `undo` puts it
back where it was. The sidebar's edge drags its width.

### A document as a notebook

A document can show its children as tabs, as Google Docs does: `tabs` in the
top row of any document with children (or `show as tabs` on its menu; it
writes `tabs: true` in its front-matter) draws a rail on the left of its page
with the document first and its children in their order, a child's own
children as subtabs under a chevron, three levels at most. Extracts are never
tabs: a tab's are one `n extracts` line under it that opens them as a folder.
The open tab's headings are listed under it; a click scrolls the page there.
A click shows a tab in the same pane; the pane's tab reads `linear algebra ›
unit 2`. `+ add tab` at the top makes a note, `▾` beside it a source, a deck,
a draft, or an imported file; on hover a row shows `+` (a note after it) and
`···` (add subtab, rename, duplicate, move to…, delete), and rows drag to
reorder or nest, into the sidebar too. With the rail focused the tree's keys
work there; ⌘⌥↑ / ⌘⌥↓ step through the tabs from the page and ⌃⌘T folds the
rail; its edge drags its width. A book (EPUB) lands as a notebook, its
chapters as tabs. Each tab is a whole document in its own file, so the
queue, the palette, and a session reach it by its path and open the notebook
on it.

## Bringing things in

Anything lands through the *intake* (⌘⇧O, `+` beside the collection's name, or
a drop), which previews what it read and writes files when you say `place`.

A file dragged from the Finder lands where it is dropped: on a folder row in
the sidebar or the folder lens, in that folder (a document row: its folder);
anywhere else, in the folder of the active tab (the root when there is none).
A PDF, a book, a `.md` / `.txt` of prose, and an Anki package with one deck
land straight away with the intake's defaults and open; a notice says what
landed and where, with `undo` and `open`. Text that reads as cards and a
package with several decks open the intake with the file in it, for the
choices. `Import…` and the menus' `import a file…` take the picker the same
way, and an address pasted (⌘V) with no field or editor focused is clipped
into the active tab's folder and opened.

### A PDF

A PDF dropped on the intake lands as a pair, `name.pdf` beside `name.md`: the
Markdown is the document (schedule, priority, cards, notes), the PDF its
pages, read in place through pdf.js and never written. It opens as a book:
the pages on the left, the Markdown's body on the right as your notes on
them, one continuous document. A passage boxed on the pages becomes a
section of the notes, named from the page (`3.3 · average values (3.12)`),
placed in book order, and comes back in the day's queue until you dismiss
it; its boxes are drawn on the page with its name, lit while the caret is
in it, dashed once dismissed. Under its heading a chip shows it in the
book, draws its boxes inline, and says when it is next. The gold bar in the
margin runs to the read point (`pos` and `y` on the `read` line); done for
today records the bottom of the view. An older extract's passage is still
drawn on the page as a highlight when it is found there again.

### A book in EPUB

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

### A list of cards

Text pasted or dropped on the intake that reads as a list of cards lands as a
deck: a row chooses what separates front from back (`Q:`/`A:` lines, a tab,
` :: `, a dash, a comma, or anything typed) and what separates cards (a blank
line, a newline, a semicolon, or anything typed), detected from the text and
changed with a click; `both directions` writes `:::`. An Anki text export is
read by its header, HTML reduced to text; its hints, sounds, and images are
dropped and counted. Lines that did not split stay at the end of the file
under `## not cards`.

### An Anki package

An Anki package (`.apkg`) dropped on the intake is read on the Rust side
(`src-tauri/src/anki.rs`: the zip, the SQLite collection, zstd when it is
compressed) and listed deck by deck; `place` writes one deck file per Anki
deck, `Parent::Child` as `Parent/Child.md`. A basic note is `front :: back`,
a reversed note `:::`, a cloze note its text with the blanks kept; a review
card's progress seeds the card's `sr` line (due, interval, reps, lapses, a
difficulty from the ease). Hints, sounds, images, a reversed note's second
schedule, and empty notes are dropped and counted; media is not copied.

### A web page

An address pasted on the intake is fetched and read as the Obsidian Web
Clipper reads a page: Defuddle finds the article and what the page says
about itself, and the article lands as Markdown with its links, emphasis,
inline code, fenced code with its language, tables, footnotes under
`## notes`, math as `$…$`, and images. The preview shows the site and the
title, the author and the date, the count with the image count, and `via
defuddle` or `via the fallback` (Readability, else the whole page, when
Defuddle finds nothing). The file carries `url`, `author`, and `published`;
the inspector shows them, the address as a link that opens in the browser.
With `download images when clipping` on in the tweaks (it is by default)
the page's images are downloaded into the document's own folder,
`name/img-01.png` …, and the links pointed at them; one that does not
answer keeps its address. Anything the format would read as a card is
escaped on the way in: `{{` is written `{ {`, a ` :: ` loses its spaces.

### From the browser: the `ilmi://` scheme

The app owns the `ilmi://` scheme, the same grammar as Obsidian's URI under
its own name, so a browser can hand it a page: `ilmi://new?name=&content=&
folder=&url=` lands a frozen source (the content as the text, else the page
at the address fetched and read as the intake reads one, with the same
`url`, `author`, and `published` fields and its images; the name as the
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

### A SuperMemo collection

The import reads a SuperMemo collection's data files (`src/import/supermemo/LAYOUT.md`
says which bytes, and on whose word) and lands its tree as folders, topics as
sources and extracts, items as cards, tasks as drafts, with their schedules
and priorities; what the layout notes do not cover is printed, never written.

## Reading

A *source* is a document you read: a clipped page, a chapter, a PDF's notes.
`r` starts reading it; the gold bar in the margin runs to the read point, and
the source returns in the day's queue on a cadence set by its priority until
its marker reaches the end. From a selection, `e` carves a *section* (an
extract that comes back on its own) and `m` makes a card. A book is read the
same way with its pages beside the notes.

### Sections that come back

Any section of a note or a source can come back: `come back` on the
heading under the caret (the inspector, the heading's right-click menu, or
the palette) writes `<!-- read made=… due=… ivl=2 -->` under it (the
interval is the cadence of its priority: every day under 34, every other
day to 66, every third day above), and the section (the heading and
everything under it, up to the next heading of its level) is in the day's
queue when it is due, sorted with the reading and the cards by the day's
draw around each priority, never grouped by kind. Every row says where it
stands in one line: a section `boxed oct 29, nothing written yet`, `written,
no cards yet` or `written, 3 cards`, then `first time back` or `back for the
2nd time`; a book `read on from p. 42`. A section opens in its document at
its heading, in the editor, to write in and card; the same three choices
everywhere: ⏎ **next · back in Nd**, `p` **later** (not counted), `d`
**dismiss** (its notes and cards stay). A book or source with reading left
comes back on its cadence (⏎ **done for today · back in Nd**, the interval
never growing); once its marker is at its last block or page, ⏎ reads
**dismiss**. A section, a note revisited or an extract grows from the time
elapsed since the pass before, so sixty days late on three lands past
ninety, not at five. The tree's due counts include sections.

## Writing

### The editor

The reader draws Markdown as Markdown without changing a byte of it:
`*emphasis*`, `**strong**`, `` `code` ``, and `[text](href)` read as
themselves in prose, in card faces, in the deck's rows, and in the queue.
The markers follow the caret: they show, dimmed, only around the span the
caret is in or has just typed closed, and a backspace into a hidden one
reveals it before anything is deleted; ⌘-click on a link opens it, a plain
click puts the caret. A formula stays rendered: a click on the chip (or ⏎
with it selected) opens a small field under it holding the TeX, the chip
redrawn as you type and the error shown quietly when KaTeX refuses; ⏎ or a
click outside writes it once, Escape leaves it as it was, an arrow at the
field's end steps out past the chip. A list, a block quote, and a fenced
code block are edited as themselves: the bullets, numbers, and `> ` sit
beside the text as what the file says, ⏎ continues an item or a line (the
numbers on, a task box unticked), outdents an empty one and then leaves,
Tab and ⇧Tab move an item in and out with its children (under the item
before it, at its text's column), ⌥⇧↑ and ⌥⇧↓ move it among its siblings,
a task's box ticks on a click or ⌘⏎, and a code block
takes ⏎ as a newline, Tab as two spaces, and ⌘⏎ to step out, its fence
written back as it was. They are made as they are typed: `- `, `* `,
`1. `, `[ ] `, `> ` at a paragraph's start, `---` alone, a fence line or
`$$` and then ⏎; a Backspace right after puts the typed text back. The
formatting keys write the markers (`**`, `*`, a backtick, `~~`, `[…](…)`)
and take them out again, and a selection shows a small bar above it with
b, i, code, link, card, and extract. A table, a rule, or indented code is drawn as that
element inside its block, and a click on it shows the source. An
`![alt](src)` alone in a paragraph is the picture with its
alt as the caption, read from the vault when the path is relative and from
the web when it is an address and `show remote images` is on; one that
cannot be had is its alt in mono. A passage selected over emphasis carries
the markers into the extract or card made from it.

### Formulas with blanks

A blank can sit inside a formula: `$y = {{c1::x^{2}}}$`, or a whole line of
an `align` environment. Inside math only the numbered form is a blank and it
closes at the braces that balance, so `\binom{n}{{k}}` stays TeX. The formula
is rendered once with the blank as a box, then with the answer on the accent;
in the composer, `⌘B` on a selection inside a formula writes the numbered form.

### A list item as a card

A list item can be a card, as a line of class notes is: `- dof :: 3N − k`,
`1. the {{c1::Boltzmann}} factor`, nested or not. It is drawn as the card
it is beside its bullet, and a review writes its `sr` line under the item,
set in to the item's text. After a line that is only `?`, a numbered or
bulleted list is the back: the steps of a derivation. In a session the line
above a card names its document and the headings over it, and `o` (or a
click on that line) opens the document scrolled to the card, marked.
`study` in the top row of a note or source with cards, and on a tab's
`···`, studies what is due in it.

### Arabic and English on one page

Arabic and English share a page: each block reads the way its first letter
does (a block with no letter, a formula or a number, reads like the one
before it), formulas and inline code stay left to right inside an Arabic
sentence, and Arabic is set in Noto Naskh Arabic (IBM Plex Sans Arabic in the
chrome), bundled, with lines tall enough for the ḥarakāt. Nothing about
direction is written to the files. A cloze whose answer is only a case
ending (`غَائِبَات{{c1::ٍ}}`) shows its blank on the letter it sits on.

## The day

The *queue* (`today` in the sidebar) holds everything due: cards, sources with
reading left, sections, notes revisited, drafts. ⏎ enters a *session* that
walks it; each element offers the same choices, ⏎ next, `p` later, `d`
dismiss.

### Priority, growth, and the budget

The inspector sets a priority, 0 first and 100 last, on a document or on the
selected card; what is due sorts by a draw around it, the same all day and
another order the next, so the top holds and the middle mixes. It also sets a
topic's growth, the factor each pass multiplies the interval by (1.6
reading, 1.5 writing), and shows the next three intervals (a source with
reading left shows its cadence instead), and a reading's interval outright
(`ivl` and `due = today + ivl`, nothing else: come back in 100 days for what
is not understood yet); postpone grows the interval by 1.2. A budget folds
the day at that many elements: the top strip counts what is above the fold
and a session walks it. `postpone the rest`, a row under the fold or a
palette command, postpones the backlog, the reading and writing due before
today, and leaves what is first due today alone; cards stay where they are;
`postpone the backlog when the day starts`, a tweak off by default, runs
it at the day's first queue build; a source with reading left that it
pushes on is only held over to tomorrow, its cadence kept, where `p` on it
still grows the interval. The bottom strip shows the keys that work where you are. `ilmi.theme('dark')`
and friends still work from the devtools console.

## Sync

A collection syncs between devices as a git repository. In the tweaks (⌘,),
`remote` takes a repository's HTTPS address (a private GitHub repository, a
bare repository on a machine of yours) and `token` what it asks for;
`connect` gives the open collection a repository on that remote and brings
the two level, `clone…` makes a new collection from the remote, named for
it, and opens it. The repository is a folder the app keeps beside the
collection's database, written out from it before each commit and read back
into it after each pull. From then on the app commits what it writes after each batch
(a session, a save, an import; at most once a minute, the message naming
what changed), pulls on open, on focus, and every two minutes, and pushes
after a session, on close, and a minute after a commit. The top strip says
where things stand: `synced · 2 s ago`, `3 to push`, `pulling…`, `offline`,
or `2 conflicts`. Offline is quiet; commits wait.

A push also nudges the other devices, so a change crosses in seconds rather
than waiting for the timer: the app announces "changed" on a topic named by
a hash of the remote's address (nothing of the collection goes out), over
the ntfy server in the tweaks' `nudge` field, `https://ntfy.sh` unless you
run your own; every open copy of the collection listens there and pulls at
once. The age beside `synced` is how long since the remote was last
reached. Clear the field and the timers are all there is.

Two devices changing different cards in one file merge clean. The same card
graded on both keeps the later grade; a source read on on both keeps the
later pass. A paragraph edited on both keeps both versions, one block after
the other, under a notice naming the file and the heading; `2 conflicts` in
the strip opens the files. A file edited on one side and deleted on the
other keeps the edit; the order chosen for a folder takes the pulled side;
the review log is unioned. Every merge is one commit in the history.
`.ilmi/state.json` (the window's own state) stays out, the rest travels,
PDFs included. A folder that was a repository before it was imported does
not bring its history: `connect` the collection to the same remote and the
two are merged. The
remote and the token live with the tweaks on each device, never in the
collection. SSH remotes and large files are not supported.

### Through a storage

The other way to sync needs no repository: a storage, which is a folder (a
disk, a NAS), an S3-compatible bucket (Cloudflare R2, MinIO, AWS), or a
WebDAV folder (Nextcloud, a Synology). In the tweaks, `storage` takes the
kind and the fields it needs: a folder; or `endpoint`, `bucket` (a prefix
may follow the bucket's name after a `/`), `key` and `secret`; or the
folder's `address`, `user` and `password`. `connect` puts the open
collection in an empty storage, or meets the storage that already holds
it; `join…` makes a new collection from what a storage holds and opens it,
which is how a second device starts. `off` stops; what is in the storage
stays. A collection that syncs this way does not sync by git.

Each device writes its own changes to the storage and reads the others',
on open, a few seconds after a change, when the window comes back, and
every half minute; the strip reads as it does for git. Nothing needs a
server of ilmi's, and nothing is overwritten there. Two devices changing
one paragraph are merged by character and the paragraph is named in a
notice; the same card graded on both keeps the later grade; a document
moved on one and edited on the other is one document in its new place.

`keep files` says what a device holds of the PDFs and images: `all`, or
`opened`. Set to `opened`, a book whose PDF is not on the device says `not
here` on its row and fetches it when it is opened, the strip reading
`pulling 40%` as it comes. A large PDF goes to and from the storage a
piece at a time, and a book over 16 MB is read from disk as its pages are
turned to. The fields are kept with the tweaks on each device, never in
the collection.

### On an iPad

The same app runs on an iPad, beside the Mac rather than instead of it. Its
welcome has one button, `connect`: give it the remote and the token and the
remote is cloned as a collection in the app's own data, as on the Mac (the
Files app no longer shows it; the remote is its copy). The collections there
are the rows under it. From there sync is the
Mac's: a card graded on the iPad is on the Mac after its next pull.

Held sideways the iPad is a narrow Mac window: one pane, the sidebar and
the inspector hidden until the toggles at the two ends of the top strip are
tapped. Upright, the sidebar comes over the page from the left edge (its
toggle, or a swipe in from the edge) and goes once something is opened, and
a book's notes start folded. A tap opens; the queue, the session, and its
grades are buttons; a passage selected brings `card` and `extract` under it.
With a keyboard attached the keys are the Mac's.

Reading a book there: a finger scrolls the pages. To box a passage, rest the
finger on the page a moment and then drag; the Pencil's drag boxes at once.
Drag again for a second box, tap the page to clear them, and the bar under
the last box makes them a `section` or a `card`. Upright, the notes slide
in over the pages from the right edge (a swipe in from that edge, or
anything that goes to a section) and fold at a tap beside them or a swipe
back. Where the Mac has a right-click, hold: a row, a heading and a deck's
card open their menus when the finger lifts, and a row held and then moved
is dragged.

A page of working: hold a section's heading in the notes and choose `draw`
(or `/draw` where the caret is), and the Pencil's canvas comes over the
page. Write, then `done`: the page is under that section as a picture, and
a tap on the picture opens it again to go on. It is kept as its strokes,
so the Mac and every other device show the same picture without a file
crossing, and an export writes it as `name/ink-01.png` with its drawing
beside it, `name/ink-01.pkdrawing`.

## Plugins

Plugins live in a vault's `.ilmi/plugins/` and are turned on in tweaks; the
API, how to write one, and how to package one are in `PLUGINS.md`. The repo
ships two under `plugins/`: the sample, and a dictionary that looks a selected
word up (Wiktionary by default, Arabic clitics stripped on the way) and adds
it to a vocab deck from the popover.
