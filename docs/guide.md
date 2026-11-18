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
shows when there is none or when `reopen last collection on launch` is
off in the settings. A new collection is named on the welcome and starts with
`start here.md`, one short source with a card in it. `import folder` takes a
folder of Markdown files (a vault as `FORMAT.md` describes it, or any notes
you have) and makes a collection named after it, every file in it included;
a folder dropped on the welcome does the same. The folder is left as it is
and is not read again.

A row on the welcome has a menu (right-click, a long press on an iPad, or
the `···` at its end): `rename…` and `delete…`. Rename makes the name a
field in place (F2 on the selected row; ⏎ commits, Esc cancels); a name
another collection has, or one a folder cannot have, is refused and the row
says why. A renamed collection is the same one everywhere it is known: it
keeps its place in the list and reopens on start as before, and its
storage, its remote and its mirror go on under the new name (the mirror's
folder keeps the name it was made with). Delete (⌘⌫) asks on the row,
saying how many cards and documents go, and `keep` has the focus: the
collection is removed from this device with its daily exports, there is no
undo, and what was sent to a storage or pushed to a remote stays there.
Neither is done to a collection a window has open (`close it first`).

A collection lives under the app's data directory as one database file, with
its PDFs and images beside it. To get files back, `export collection ·
folder` in the palette writes it to a place you choose as a folder of
Markdown, each document at its path with its schedule lines in it, and
`export collection · zip` writes the same as one file. An export is what
another editor, a script, or a backup works on; what is changed there comes
back by importing that folder as a collection. Nothing else changes the live
collection.

Two copies are kept without asking for an export. `mirror` in the settings
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

A PDF dropped on the intake lands on its own: the file, in the tree by its
name, read in place through pdf.js and never written, in the reading queue
from that day. It opens as a PDF reader would show it: its pages across
the window, sheets on a grey desk, the sidebar and the inspector folded
away (each comes back by its toggle at the two ends of the top strip, the
sidebar's also ⌃⌘S, and both are as you left them once you are on a note
again). A bar over the pages has the contents, the book's name, its
notes, the zoom between `−` and `+` (a press on the number fits the pages
to the window again), the page (a press goes to a page) and search. Your
notes on it are a note attached to it, made when you ask: the bar says
`create notes` until there is one and `open notes` after. The first time
you press that (or ask for a card from the pages) you pick a note that is
there or make a
new one, named as you like, in a folder of your choosing; the note names the
file in its `pdf` field and is otherwise blank. It is an ordinary note: a
row in the tree where you put it, yours to write and lay out as you like.
ilmi writes nothing into it for you: no headings, no page markers. `open
notes` (⌘\) opens that note in the pane beside the pages, the
ordinary tab it is, and closes it again; nothing slides over the pages. A
PDF with a `.md` of its name beside it (a book's chapters, or anything
from before) opens the same way, that document's body being its notes.

On an iPad the pages can be written on: the Pencil writes where it lands,
and the bar has a second row under its words with the tools to write with
(see *On an iPad*). What you write is kept with the PDF, not in it, and
every device shows it over the page. It lies on the page as ink does on
paper: a highlighter's stroke over a line of text leaves the text dark.

A PDF can have several notes. A `+` sits beside the notes' word in the
bar and opens a small menu. `new note` asks what `create notes` asked, a
note that is there or a new one and where, and that note names the PDF
too. `new written notes` makes a notebook of paper for the PDF instead,
named and placed the same way (see *Written notes* below). `open notes`
then opens them all as tabs of the pane beside the
pages, the one you used last in front, and `hide notes` (⌘\) closes them
together; they are ordinary tabs, so one can be closed by itself. Each is its own row in the tree, wherever you put it; a note
deleted, or whose `pdf` field you take out, is no longer among them. A
chapter of a book has its own body as its notes, first among the tabs,
and the notes attached to the book's PDF after it.

Drag a box around a passage (again for another box, on any page) and
press `e`, or `passage` on the box's bar: the passage is kept and comes back
in the day's queue until you dismiss it, first on the cadence of the
book's priority, then further out each time you pass it. It is kept with
the PDF, not in a note: no note is asked for and none opens. The notice
says when it is back and undoes it. Its boxes stay drawn on the page with
its pages beside them (`p. 41`, `pp. 41–42`), dashed once dismissed; a
press there says when it is next and offers `dismiss` (or `bring back`)
and `remove`. `]` and `[` step between a book's passages in book order.
`passages · <book>` in the palette lists them with when each is next, and
the inspector lists them too, each with a quiet × that removes it. In the
queue a passage is a row tagged `passage`, named by its book and its
pages; its session opens the pages at its boxes, with `next`, `later` and
`dismiss` under them, and the focus `read` counts it. Passages sync
between your devices one by one, as bookmarks do.

`m` on a box (or `card` on its bar) is for a card about what you boxed: the
box is clipped into the note as the crop of its page, where your caret is
in the note (at its end when the note is closed or you have not put the
caret anywhere), and the caret lands under it for the card. Of several
notes it goes into the one in front beside the pages, or, with the notes
closed, the one you used last. That is the
only thing ilmi puts in the note, and only when you ask for a card; the
notice undoes it.

A note from before this (the sample's chapters) holds its passages as
sections under headings named from the page, and what came from a page
under `## p. N`. Those still work as they did: the section comes back, its
boxes are drawn on the page with its heading, lit while the caret is in
it, and a chip under the heading shows it in the book, draws its boxes
inline and says when it is next. Nothing is rewritten. The
gold bar in the margin runs to the read point (`pos` and `y` on the `read`
line, or in `.ilmi/reading.json` for a PDF on its own); done for today
records the bottom of the view. An older extract's passage is still drawn
on the page as a highlight when it is found there again.

The pages are fitted to the pane's width. ⌘= draws them larger, a step at
a time (125%, 150%, 200%, 250%, 300%, 400%), ⌘− smaller (75%, 50% under the
fit), ⌘0 fitted again; a pinch on a trackpad steps once. Two fingers on an
iPad or a phone zoom the pages as they spread and close, about the place
between them, and leave the pages at whatever size they stop at, from half
the fit to four times it; the bar's zoom says it, and its `+` and `−` step
on from there. On an iPad the pages follow the fingers exactly, moved with
them as well as spread, with what is written on them; pulled past either
end they give a little and come back. A finger tapped twice on the pages
fits them, and tapped twice again goes back to the zoom they had (twice
their fitted size, if they had none). Under the fit the pages stand in the
middle of the pane, and the room between two pages grows and shrinks with
them. The same text stays under the top of the view, pages
wider than the pane scroll sideways, and the boxes, what is written on the
pages, and the read bar grow with them. The zoom is said in the bar, is
the book's own, and is kept for the device: it
is there when the app is opened again. With the caret in the notes, and everywhere else, those keys are the
text size.

Getting around a book is by the keyboard as much as by the scroll (the
bar's buttons do the same under a finger: search opens the field and,
pressed again, closes it). `/`
searches it (⏎ and ⇧⏎ step the hits from the field, `n` and `N` once the
caret has left it; the hits stay lit until esc), `g` goes to a page, and
`t` lists the PDF's own contents in the palette: its outline, indented as
it is nested, each entry's page at the right, the one you are in marked;
type to narrow it, ⏎ goes. A PDF with no outline says so and lists the
passages you have boxed instead; a chapter cut from a book lists what lies
in its own pages. The palette offers the same list as `contents · <book>`.

The PDF's own links work: a press on a citation, an equation's number or a
line of a contents page goes where it points, and a web address opens in
your browser. A press that moves is still a box, or a selection, as
anywhere on the page. With ⌥ held, or from a right-click's `peek`, the
destination is shown in a small window over the page instead, without
leaving your place; a press in it, or ⏎, goes there, esc closes it. The
same ⌥-press and right-click work on words the PDF did not make links of:
`(3.12)`, `Fig. 4`, `Table 2`, `Theorem 2`, `Section 3.2`, `§3.2`, `[17]`,
`Eq. 5`. ilmi looks for the equation, the caption, the heading or the
bibliography's entry the word names, as it does when you select one and
press ⏎.

`f` puts a letter on every link and reference in view. Type the letter (two
when there are more than 26) and that one is followed; hold ⇧ on the last
letter to peek at it instead; esc, or any other key, lets the letters go.

Every jump remembers where you were: a search's first hit, `g`, the
contents, a link, a reference, a section more than a screen away. ⌫ goes
back to that place exactly, and again to the one before; ⇧⌫ goes forward.
Scrolling by hand after going back keeps the way forward until the next
jump. The strip at the bottom says `⌫ back` while there is somewhere to go
back to. The trail is the book's own and is kept while the app is open.

A right-click on a selection offers `passage` and `card` as the two buttons
under it do, and `search the web` and `search scholar`, which open your
browser on the selected words; ilmi itself fetches nothing.

What you leave on the pages is kept with the book, not in it: nothing is
written into the PDF. It is kept by the file's contents, so a renamed book
keeps its marks, a chapter and the book it was cut from show the same
ones, and they sync between your devices one by one (a bookmark made on
each of two devices is on both afterwards). If you delete a PDF from the
collection its marks are kept, and are there again when the same file
comes back; the palette's `bookmarks` lists them under `no longer in the
collection` until then.

- **Bookmarks.** `b` names the place in view. A field opens where the
  search does, filled in with the nearest numbered heading above the place
  (or the page); change it or not, ⏎ keeps it, esc does not. A bookmark is
  a small mark in the left gutter with its name as its tooltip; a
  right-click on it removes it. `bookmarks · <book>` in the palette lists
  the book's, with their pages; ⏎ goes there, and ⌫ comes back. `bookmarks`
  lists every book's and opens the book at the one you pick. The inspector
  lists the book's too, each with a quiet × that removes it (the notice
  undoes).
- **Marks.** ⇧M and then a letter marks the place in view under that
  letter; `'` and the letter goes back to it. Setting a letter again moves
  it. A lowercase letter belongs to the book. A capital belongs to the
  collection: there is one `A` across all your books, and `'` `A` from any
  book opens the one that has it, at the place. `marks` in the palette
  lists them. While ilmi waits for the letter the bar says `mark…` or `go
  to mark…`; any other key lets it go.
- **Highlights.** Select some words and press `h`. Right after, 1 to 4
  choose its ink: a band, a rule under the line, a dashed rule, a dotted
  rule. Each has its own tint, and they are told apart without colour, so
  they read on an e-ink screen; the next highlight is made in the ink you
  chose last. `h` with the selection (or your last click) inside a
  highlight clears it, and the notice undoes that. With nothing selected,
  `h` highlights the words under the boxes you have drawn, and the box's
  bar has `highlight` beside `passage` and `card`. That is how a finger
  highlights, since a page's text is not selected under one: hold, drag a
  box around the words, and press `highlight` (or `look up`, which
  searches the web for them). A right-click on a
  highlight (a long press under a finger) offers `passage` and `card`, as
  a selection does, `clear`, and the four inks. `highlights · <book>` in
  the palette lists them by their words; type to search them, ⏎ goes. The
  inspector shows how many there are and the first few.
- **Portals.** A portal ties a place to another: the paragraph that
  discusses a figure to the figure, the use of a theorem to its statement.
  Press ⇧P at the first place (the bar says `portal: go to where it should
  show, ⇧P again`), go to the second by any means, in this book or
  another, and press ⇧P again; esc in between lets it go. The first place
  gets a small `↗` in the page's right margin: a press on it peeks at the
  destination, and ⏎ goes there (one that leads into another book opens
  that book). A right-click removes it. Run `portals beside · <book>` from
  the palette and the same book opens in the pane beside, marked
  `following portals`: as you read past a portal's source in the first
  pane, the pane beside moves to its destination, and stays on the nearest
  one above your place. Close that pane, or run the command again, to
  stop. A portal into another book is followed too: the pane beside shows
  that book at the place, and the first book again once you read past one
  of its own portals. An iPad and a phone have the mark and its peek only.
- **The ruler.** `v` holds the line a third of the way down the view under
  a rule: a soft band over the line and a hairline under it. A click in a
  page's left margin, beside a line, does the same for that line. ↓ and ↑
  (or `j` and `k`) move it a line at a time, onto the next page at a
  page's end, and the page scrolls so the rule stays where your eyes are.
  `r` sets the read point to the rule's line in a book you are reading.
  `v` or esc lets it go. The ruler is not kept: it is where you are now.

### Written notes

Written notes are a notebook of paper: pages you write on by hand, with
nothing typed in them. Make one from the sidebar's `+` (`new written
notes`, under `note`) or from the palette's `new written notes`; it is a
row in the tree with its own mark, renamed and moved as any note is. Over
a PDF's pages, `+` beside the notes' word and `new written notes` makes
one that belongs to that PDF: it opens in the pane beside the pages, a tab
among the PDF's other notes, and is still a notebook of its own in the
tree.

A notebook opens as a PDF does: its pages on the grey desk, the bar over
them with its name, its notes, the zoom, the page (a press, or `g`, goes
to a page) and `more`. A new notebook is ruled Letter sheets.

`page setup`, in `more`, is one panel over the pages, which change behind
it as you use it. The paper: blank, ruled, grid or dotted. The spacing of
its rules, lines or dots, by a slider that says it in millimetres or by
name (`narrow`, `college`, `wide` for ruled paper; 5, 7 and 10 mm for a
grid and dots). A `left margin` and a `right margin`, on any paper, blank
too: each a switch, and when it is on how far from its own edge its rule
stands; the rules, the grid and the dots run on under them to the sheet's
edges, as on paper. For ruled paper the `top space` over the first rule
and, for pages, the `bottom space` under the last. The `paper colour`
and, for paper with anything ruled on it, the `line colour`: a row of
rounds each, the first of which is none chosen, then the ones with names
(white, cream, yellow, grey and dark for paper; blue-grey, grey, blue, red
and green for lines), then one from the colour wheel. With none chosen the
paper follows the theme, white in the light one and dark in the dark one;
a colour you choose is the paper in every theme. The line colour is the
rules', the grid's and the dots'; the margin rules stay red. Ink is always
drawn to be read on its paper: on dark paper black ink shows white, and on
light paper it is as you wrote it, whatever the theme. The layout: `pages`,
or `pageless`, where the notebook is one sheet: no pages, no gaps, the
ruling and the margins running down all of it, and nothing to show where
a page would have ended, so you write, erase and lasso across any part of
it. It is as long as what you have written and a little more (192
points of bare paper under the lowest ink), never shorter than one sheet.
As you write toward its foot it grows a line or two at a time, under the
Pencil, without anything on the screen moving. It is never made shorter
while you are in it: erase what was at its foot and the paper stays;
the next time you open the notebook it ends that little under what is
left. A pageless notebook has no page count, nothing to add or delete, no
overview, and `g` goes nowhere. For pages, the size (`letter`, `a4`) and which way they lie
(`portrait`, `landscape`). `use for new notebooks` keeps all of it as what
notebooks made on this device start with. None of it moves what you
wrote: the paper changes under the ink. Going pageless and back loses
and moves nothing: what you wrote is kept by the sheet, a page's height of
the long sheet each, either way.

On an iPad the Pencil writes where it lands, and the tools are the bar's
second row (see *On an iPad*). `add page` under the last page adds one,
and you do not have to reach for it: a stroke begun in the lower third of
the last page adds the next page by itself. `more` has `add page after
this one`, `duplicate this page` (a copy of the page and what is written
on it, right after it) and `delete this page`, which takes the page in
view. A page with writing on it, or a passage kept from it, asks first;
the notice undoes it, and the page comes back where it was with what was
on it. The other pages are not touched by it: what you wrote on them and
what you kept from them stay with them.

`all pages` (the squares in the bar, or `more`) lays every page out small,
with what is written on it. Press one to go to it. Each has its own `…`:
`add page after`, `duplicate`, `delete`; the last tile is `add page`; the
four small sheets at the top are the paper. To move a page, drag it to
where it should go (under a finger, hold it first). A PDF has the same
overview of its own pages, to go to one.

`share as pdf` in `more` (on a Mac, `export as pdf`) makes one PDF of the
notebook, its paper and what is written on it, and hands it to the
system's share sheet (on a Mac, saves it where you say). Over a PDF it
makes a PDF of that PDF's pages with what you wrote on them; the PDF's own
text stays text, and what you wrote is drawn in it as shapes, sharp at
any size (a fountain pen's and a pencil's strokes as pictures). A pageless
notebook is cut into pages of its size, as many as what you wrote
reaches.

On the Mac a notebook shows its pages and what is written on them, and
cannot be written on; the bar says `written on an ipad`.

Written and typed are kept apart. A typed note takes no handwriting, and a
notebook no typing. To type up what you wrote, work from the written page
as you would from a PDF's. Drag a box around part of a page (hold, then
drag, under a finger). `passage` on the box's bar (or `e`) keeps it: it
comes back in the day's queue until you dismiss it, its session the page
at its box, exactly as a PDF's passage does; `]` and `[` step between a
notebook's passages, and `passages · <name>` in the palette lists them.
`card` (or `m`) clips the box into a typed note on the notebook, with the
caret under it for what you type: the bar's `create notes` picks or makes
that note the first time, `open notes` opens it beside the pages, and `+`
adds another, as over a PDF. In the note the clip is drawn as that part of
the page, its paper and your handwriting, and is drawn again when you
write more there.

What a PDF's text gives is not there for paper: no contents, search,
links, highlights, bookmarks, marks, portals or ruler, and those keys do
nothing over a notebook.

On disk a notebook is a `.md` with a few fields and no body (FORMAT.md
§3). What is written is kept in the collection stroke by stroke, syncs
that way, and an export writes each page's drawing under `.ilmi/ink/`.

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
compressed) and listed deck by deck. With several decks each row is a
toggle, all on to start: a deck turned off (a click, or space / ⏎ on the
row) is left out, the count follows, and `place` needs one on. A deck holds
its own cards only, so a sub-deck left on under a parent turned off still
lands in the parent's folder, without the parent's deck. `place` writes one
deck file per Anki deck that is on, `Parent::Child` as `Parent/Child.md`. A basic note is `front :: back`,
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
With `download images when clipping` on in the settings (it is by default)
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
title, else the page's) in the folder named, else the one `save clippings to`
in the settings panel (the vault root until set), opens it, and leaves a
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

A right-click in the text offers cut, copy, paste and `insert table`, and
with words selected `bold`, `italic`, `code` and `strikethrough`. A card's
text is written in this same editor wherever it is written: a deck's row,
the card view, the new card's question and answer and a phone's front and back (and both terms of
a card that goes both ways), so the menu, the formatting keys, formulas
and tables are the same there. A cloze's menu has `blank` where a note's
has the table.

### Blanks

A cloze's blanks are made, not typed. In a new card's passage, or a cloze
opened in a deck or the card view, select the words and press ⌘B (with
nothing selected, the word at the caret), or right-click and choose
`blank`. The answer is marked and a small number where it opens says which
group it is; the braces the file keeps (`{{c1::…}}`) are not drawn. Each ⌘B
is a group of its own, asked separately. `blank · with 2` on the menu puts
the selection in a group there already is (asked together with it), `move to
group` moves the blank you pressed in, `remove blank` takes it away. So does
backspace at a blank's start: the blank goes, its words stay. Typed braces
still work, and become a blank as they close.

A card of several lines is one text: a blank can start on one line and end
on another, and ⌘A then ⌘B blanks all of it.

A blank can hold blanks. Select a stretch that has blanks in it and press
⌘B: the new blank is the whole stretch, the ones inside keep their own
groups. Asked, the whole hides everything in it; when one inside is asked,
the rest is shown around it. A line to recite whole and also piece by
piece is one card: blank each piece, then select all of it and blank that.
The inspector's box for a selected card still shows the text as the file
has it, braces and all.

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
dismiss. A card graded into its learning steps (`again`, or a new card
graded `good`: due in minutes, not days) comes back before the session ends,
once everything else has had its turn, and again until a grade moves it out
of today; the count grows by one each time. A deck studied ahead (`cram`)
asks each card once.

The day is one list, every kind mixed, in priority order. Under its count a
row of words narrows it to one thing to do: `all · recall · read · write`,
each with how many are due. `recall` is the cards, `read` the sources and
sections, `write` the drafts. `f` goes round them, ⇧F back. Narrowed, the list
shows that kind only, still in priority order, and ⏎ (or a row pressed, or
`enter queue` in the palette) walks only that, to the session's end. It
composes with an exam's chip: `recall` and `midterm 2` together is the cards
studied toward it. The focus is this device's, kept per collection and never
synced: a phone left on `recall` stays there while the Mac shows everything.
The budget is the whole day's: a narrowed list has no fold, and a focus
walks everything due of its kind. To have a focus keep to the budget, turn
on `focus stays within daily budget` in the settings (⌘,): the
narrowed list then folds where the day's does, and ⏎ walks only what is
above the fold of that kind.

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
`postpone backlog at start of day`, a setting off by default, runs
it at the day's first queue build; a source with reading left that it
pushes on is only held over to tomorrow, its cadence kept, where `p` on it
still grows the interval. A source you must have read by a day takes it in
`finish by`, under the interval in the inspector: its passes are spread over
the days left, sooner than its cadence when they have to be, and its queue row
and the session's bar say `on pace · 9 passes left`, or `behind · 14 passes
left` once a pass a day would no longer make it. Empty the field and it is back
on its cadence; past the day nothing changes and the field stays as it was. An
exam that comes first still wins. A chapter counts its pages; a PDF that is
one whole file has no `finish by`, since its length is not known until it is
opened. The bottom strip shows the keys that work where you are. `ilmi.theme('dark')`
and friends still work from the devtools console.

### The numbers

A deck's lens reads `cards · numbers`, a folder's or a notebook's `items ·
cards · numbers`, and `numbers` in the palette (⌘K) opens the whole
collection's. The numbers are of the cards under the lens and no others.

At the top is a year of days: weeks as columns, Monday at the top, a cell a
day, shaded in four steps by the reviews done that day (the day turns at
your midnight, as a card's due day does). In e-ink a day is a square that
grows with its count. Point at a day, or walk the days with the arrows (↑ ↓
a day, ← → a week), and the line under the grid says its date, its reviews
and the time on them; press it (or ⏎) and its cards are listed under the
grid, each with the grades it got, each opening its card. Beside the year:
the days studied of the days in range, the average a day, the best day, the
days in a row now and the longest run, retention (of the reviews of cards
already in review, those not answered `again`), the answers given, and for
this week, month and year the reviews, the time, the cards started and the
cards matured (an interval past three weeks).

Over the year is `cards · reading`. `reading` shades the same days by what
was read instead: each time you read on in a source, a section or a draft
(⏎ on it, a book's done for today), and each extract or section you made.
A day says `3 read, 2 made`; pressed, it lists them with the document, the
section's heading when it was a section's, and what was done (`read on`,
`later`, `done`, `extract`, `section`), each opening its document. Under
it: the days read of the days in range, the times read on, the extracts
and sections made, and the same for this week, month and year. Reading is
never added into the reviews: the two are one grid shown two ways. It is
logged from the day this was added, so the days before are empty, and a
folder of sources with no cards has its reading alone. An undo from a
notice takes its line back.

Under it the days ahead are drawn in the same cells for half a year, by
what comes due; what is overdue counts today. A day pressed lists what
comes due on it. Then retention by week, by how long a card has been
studied and by the time of day, the cards failed most, and the spread of
stability and difficulty.

## Finding

The palette (⌘K) finds words as well as names. Type and the rows are, in
order: names that hold what you typed, then cards and lines of text that
hold it, then looser matches among the names. A card shows as a card; a line
of text shows the words around what was found, the word itself marked, and
the document it is in. `⏎` opens it there: a card selected, a heading or a
paragraph in the middle of the page with a fill that fades.

It looks through every document's text and every card, both faces, a cloze's
answers in place. Case, accents, Arabic's vowel marks and the tatweel do not
count: `كرم` finds `كَرَمٌ`, `lucke` finds `Lücke`, and أ إ آ are all ا.
It finds letters, not roots: `كرم` finds `بالكرم` and `أكرمه` because
the three letters are there in a row, and not `كرام`, where they are not.
Several words find the lines that hold them as you wrote them first, then
the lines that hold all of them anywhere. Text in a formula is found as its
TeX is written. A PDF's pages and handwriting are not searched: only what is
text in the collection.

A collection from before this reads itself in the first time it opens, while
you go on working. Until it has, the palette's foot says how far it has come,
and anything it has not reached is not found.

## Sync

A collection syncs between devices as a git repository. In the settings (⌘,),
`remote` takes a repository's HTTPS address (a private GitHub repository, a
bare repository on a machine of yours) and `token` what it asks for;
`connect` gives the open collection a repository on that remote and brings
the two level, `clone…` makes a new collection from the remote, named for
it, and opens it. The repository is a folder the app keeps beside the
collection's database, written out from it before each commit and read back
into it after each pull. From then on the app commits what it writes after each batch
(a session, a save, an import; at most once in fifteen seconds, the message naming
what changed), pulls on open, on focus, and every half minute, and pushes
after a session, on close, and a few seconds after a commit. Press the
strip's sync word to sync now; what went wrong, if anything did, is said. The top strip says
where things stand: `synced · 2 s ago`, `3 to push`, `pulling…`, `offline`,
or `2 conflicts`. Offline is quiet; commits wait.

A push also nudges the other devices, so a change crosses in seconds rather
than waiting for the timer: the app announces "changed" on a topic named by
a hash of the remote's address (nothing of the collection goes out), over
the ntfy server in the settings' `nudge` field, `https://ntfy.sh` unless you
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
remote and the token live with the settings on each device, never in the
collection. SSH remotes and large files are not supported.

### Through a storage

The other way to sync needs no repository: a storage, which is a folder (a
disk, a NAS), an S3-compatible bucket (Cloudflare R2, MinIO, AWS), a
WebDAV folder (Nextcloud, a Synology), Dropbox or Google Drive. In the
settings, `storage` takes the kind and the fields it needs: a folder; or
`endpoint`, `bucket` (a prefix may follow the bucket's name after a `/`),
`key` and `secret`; or the folder's `address`, `user` and `password`; or,
for Dropbox and Google Drive, what is below. `connect` puts the open
collection in an empty storage, or meets the storage that already holds
it; `join…` makes a new collection from what a storage holds and opens it,
which is how a second device starts. On an iPad or a phone the welcome has
`join` beside `connect`, with the same kinds and fields, so a device with no
collection yet can start from the storage. `off` stops; what is in the
storage stays. A collection that syncs this way does not sync by git.

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
turned to. The fields are kept with the settings on each device, never in
the collection.

### Dropbox and Google Drive

These two are signed in to. Each needs an app of your own at the service:
ilmi has none, so `app key` (Dropbox) or `client id` and `client secret`
(Google) say whose it is. `folder` is the collection's name there, the same
on every device. `sign in` opens your browser; say yes there and come back,
and the row reads `signed in`. Then `connect` or `join…`, as for any
storage. Each device signs in for itself.

Dropbox keeps a collection in the app's own folder, `Apps/<your app>/<folder>`.
Google Drive keeps it in `ilmi/<folder>` in My Drive, and ilmi sees nothing
else of your Drive. There each file's whole path is its name, in one folder:
it is a storage, not something to tidy by hand.

If the service lets go of the sign-in, the app says `sign in again` and the
strip reads `offline`; press `sign in`, and the sync goes on where it was.
An app of Google's still in testing does this every seven days. `sign out`
beside it forgets the sign-in on this device and stops the sync through it;
what is in the storage stays, and the service still lists the app on your
account until you remove it there.

To make the app, in the [Dropbox App Console](https://www.dropbox.com/developers/apps):
Scoped access, App folder; under Permissions tick `files.metadata.read`,
`files.content.read` and `files.content.write`; under OAuth 2 add the
redirect URI `http://localhost:51764/auth` (and `ilmi://auth` for a device)
and allow public clients. The app key is on that page. In the
[Google Cloud Console](https://console.cloud.google.com/): enable the Drive
API, set up the consent screen with the scope `drive.file`, and make an
OAuth client of the type Desktop app, whose id and secret go in the fields.
On an iPad Google wants a client of the type iOS, and its id turned round
added to the app as a URL scheme, which is a build of your own.

The tokens are kept in `oauth.json` in the app's own data folder, readable
by your user alone; they are in no collection, export or storage, and not
in the web view. They are not encrypted there.

### Pairing a device

A second device does not need the fields typed. On a device whose
collection already syncs (by a remote or through a storage), the settings
have `pair a device` beside the sync: it shows a QR code that holds what a
new device needs, the remote and its token or the storage's kind and
fields, and the collection's name. On the iPhone or the iPad, the first
screen has `scan a code` beside `connect` and `join`: point the camera at
the code, and the collection is made there from the remote or the storage,
opened, and synced, as if the fields had been typed. `cancel` leaves the
camera. If the camera is not allowed, the app says so and `connect` and
`join` are as they were.

The code holds the token (or the storage's secret or password), so treat it
as you would the token: do not share or photograph it. It is drawn only
while `pair a device` is open (`hide code`, or closing the settings, takes
it away), and it is not written to disk, logged, or sent anywhere. For
Dropbox and Google Drive the code carries the app's key and the folder but
no sign-in: the other device is taken to the storage's fields, already
filled, to press `sign in` and then `join`. A code for a folder on a Mac's
disk is no use to a phone, which says so.

Between two Macs there is no camera: `copy as text` under the code puts it
on the clipboard, and on the other Mac, in the settings of a collection
that does not sync yet (a new one will do), `pairing code` takes the paste
and fills the rows; `clone…` or `join…` then makes the collection, or
`connect` joins the open one to it. An iPhone's or an iPad's settings have
`scan a code` in that row, filling the rows the same way.

### On an iPad

The same app runs on an iPad, beside the Mac rather than instead of it. Its
welcome has `connect` (and `join`, for a storage, and `scan a code`, above):
give `connect` the remote and the token and the
remote is cloned as a collection in the app's own data, as on the Mac (the
Files app no longer shows it; the remote is its copy). The collections there
are the rows under it. From there sync is the
Mac's: a card graded on the iPad is on the Mac after its next pull.

Held sideways the iPad is a narrow Mac window: one pane, the sidebar and
the inspector hidden until the toggles at the two ends of the top strip are
tapped. Upright, the sidebar comes over the page from the left edge (its
toggle, or a swipe in from the edge) and goes once something is opened. A
tap opens; the queue, the session, and its grades are buttons; a passage
selected brings `card` and `extract` under it. No keys are named there: the
strip of keys at the foot and the key caps beside the buttons are hidden on
an iPad and a phone. With a keyboard attached the keys are the Mac's, and
the first key pressed on it brings the strip and the caps back (they go
again when the keyboard on the glass comes up).

Reading a book there: a finger scrolls the pages. To box a passage, rest the
finger on the page a moment and then drag (the Pencil writes on the page,
below). Drag again for a second box, tap the page to clear them, and the bar under
the last box makes them a `passage` or a `card`. `notes` among the words
over the pages opens the note beside them and closes it again, as on the
Mac (several notes are that pane's tabs, and `+` beside the word adds
one); upright, the two panes lie one above the other, the pages above and
the note below, since half the width cannot hold a page. Where the Mac has
a right-click, hold: a row, a heading and a deck's
card open their menus when the finger lifts, and a row held and then moved
is dragged.

Writing with the Pencil: there is nothing to open. Put it to a PDF's page
or to a page of a written notebook and the first touch is a stroke there,
where the page stands among the others; the pages scroll under a finger
with the writing on them, and a finger still boxes a passage after a hold.

The tools are a row under the bar over the pages, on an iPad only:

- `pen`, `highlighter`, `eraser`, `select`, the one in use on a plate, a
  pen and a highlighter with the colour they write in under them. The pen
  writes; the highlighter is a marker the text shows through; the eraser
  takes away what it is drawn across, with a ring under the Pencil that
  shows how far it reaches; with `select`, draw a loop round some strokes.
- Three sizes of the tool in use, `thin`, `medium`, `thick`: a line for the
  pen, a band for the highlighter, a round for the eraser. Each tool
  remembers its own.
- Its colours: black, blue, red and green for the pen; yellow, green, pink
  and blue for the highlighter. A press on the colour in use, or a hold on
  any of them, opens the colour wheel to replace it. The ring after them,
  `colours`, opens the wheel for a fifth colour of that tool's own; a
  press on the ring uses that colour again, and a press while it is in
  use opens the wheel to change it. The eraser and `select` have none.
- At the right, `undo` and `redo`, grey when there is nothing to take back
  or put back; `draw with finger` (off, the Pencil writes and a finger
  scrolls; on, a finger writes too and two fingers scroll); and `hide
  tools`, which tucks the row away for reading. The tool in use, in the
  bar's first row, brings it back: a pen or a highlighter with its colour
  under it, the eraser, or the lasso, so the Pencil's double tap to the
  eraser and back shows there. Tucked away, the Pencil still writes with
  the tool it had, and a finger never draws.

Press the tool in use again and its settings open under it. The pen's: its
ink (`pen`, `fine`, `fountain`, `pencil`, as many as the iPad has), the
size in use made thinner or thicker by a slider, with a stroke drawn as it
is set, the three sizes, the colours, the last few colours taken from the
wheel, and `hold to make a shape`. The highlighter's: its size, its
opacity, its colours, and `hold for a straight line`. The eraser's:
`whole stroke` or `part of a stroke`, and its size. Each press acts at
once; a press anywhere else, or the Pencil writing, closes them. In a pane
too narrow for the whole row (a note beside the pages, an 11-inch iPad on
its side) the sizes leave the row first, then the colours but for the one
in use, which opens the settings; nothing scrolls sideways, and
everything that left the row is in the settings.

With `hold to make a shape` on, a stroke you end by resting the Pencil
where it stops is drawn again as what it nearly was: a straight line, an
arrow, a rectangle or an ellipse. Only a stroke that is plainly one of
those, and only when the Pencil rests: handwriting is never touched.
`undo` gives the stroke back as you drew it.

What `select` holds has a dashed box round it with a handle at its lower
right, and a small menu: `cut`, `copy`, `duplicate`, `delete`, `colour`.
Drag it by its middle to move it and by the handle to make it larger or
smaller. Rest the Pencil on bare paper with `select` held and `paste` puts
what was cut or copied down there, on that page or another, in that
notebook or another. Each is one step for `undo`.

Fingers: two spread or closed zoom the pages about the place between
them; two tapped at once are `undo`, three `redo`. The Pencil's own double
tap goes to the eraser and back to the tool you had (or to the tool
before, if that is what the iPad's Pencil settings say; set to do nothing,
it does nothing); a squeeze, on a Pencil that has one, opens the settings
of the tool in use.

What you choose is kept on that iPad, through a restart, and is the same
over every book and notebook.

On an iPad a notebook's pages scroll and zoom as the iPad's own things do:
a finger's flick coasts and comes to rest, two fingers zoom about the place
between them and give at either end, and the paper and what is written on
it are one thing under them. A finger tapped twice fits the pages, and
twice again goes back to the zoom they had. A finger held on a page and
then dragged draws a box, with `passage` and `card` under it; a tap lets it
go.

What you write stays as sharp as when you wrote it, at any zoom. On a
notebook's page a stroke at rest is drawn from its own outline at the
screen's pixels, the pen, the even line (`fine`) and the highlighter alike,
so its edge is as crisp as the screen can make it however far you zoom; a
`fountain` or `pencil` stroke keeps the grain the Pencil gave it. The paper
and its lines lie on the screen's own pixels at every zoom. On a PDF's
page the writing is drawn finer than the screen and shown at its size. The
pen starts as `fine`, a line of one even width; `pen`, thinner where the
Pencil is light, `fountain` and `pencil` are in its settings.

The Mac and a phone show what you wrote as a picture over the page, drawn
the same way and as fine as their screen at the size the page is drawn. Nothing is written into the PDF: the strokes are kept in the
collection with the book they are on, whichever chapter shows that page.
An export, the mirror and the dated exports write them as
`.ilmi/ink/<the PDF's fingerprint>/<page>.pkdrawing`, and an import takes them
back.

A typed note takes no handwriting: the Pencil on its text is a finger, to
scroll and to put the caret. Writing has a note of its own kind, the
written notebook, alone or beside a PDF, and what you want typed from it you
type in a note. Writing that a note already holds, from before this, stays
where it is and stays ink: it is drawn in the note, the Pencil in it adds
to it and the eraser erases in it, it grows as the writing nears its foot,
and when everything in it is erased it is gone from the note. Such a note
has the same row of tools under its header. Its writing is kept as strokes,
so every device shows the same picture without a file crossing, and an
export writes it as `name/ink-01.png` with its drawing beside it,
`name/ink-01.pkdrawing`.

### On a phone

Under 600 points wide, either way up, the app is a phone's: the day is its
face, and reading is possible there, not the point. A bar sits at the foot,
under the thumb. Its left button has the tree behind it, with the palette's
field at the sheet's foot; its right, `+`, is a new card; the middle one enters
the queue on the day, with the count beside it, and anywhere else comes back
to the day. The day's row of words (`all · recall · read · write`) narrows it
to one thing to do, and the middle button then enters that, with its count. There are no tabs, no inspector, no second pane, and no keys named.

A row of the day opens the session there. A topic's row (a source, a section,
a note revisited) has its three on the row: `next`, `later`, `dismiss`, acting
without opening it, and the notice can take any of them back. The session is
the whole screen: a card shows `reveal` across the foot and then, in the same
place, the four grades; a topic shows its page with the three at the foot. `×`
at the top goes back to the day.

An iPhone taps back as you go: a firm tap when a card's answer is shown; by the
grade when you give one (`again` the system's error, three knocks, `hard` a
heavy tap, `good` a sharp one, `easy` a light one); the system's success when the queue is walked
to its end; and a tick for a topic's `next`, `later` or `dismiss`, a new
card's `got it`, a blank made, a passage kept, a highlight, and a menu opened
by a long press. `haptics` in the settings turns it off. The row is there
only on a device that can do it (no iPad can), and what you choose is kept on
that phone.

`+` opens the composer with front and back and names the deck at its foot,
over the buttons: the deck in front, else the one you chose last on this
phone. A tap on the name lists the others. `save, another` keeps it open; on a
cloze, `blank` makes a blank of the selection.

A document opens as a single page, a notebook's page with no rail. A book opens
as its pages, and with no pane to put it in `notes` shows the note in their
place (of several, the one used last; the others are in the tree);
`pages` over the note comes back. The bar over the pages keeps the
contents, the notes, the page, `more` and search; the name and the zoom
are left out (a pinch zooms), and there is no row of writing tools: what
was written on an iPad shows on the pages as a picture. In a session the
pages stay, at the section's boxes.

To clip a page, make the Shortcut the README describes; the link it opens is
the one above, `ilmi://new?url=`. It starts the app first and waits a second,
since a link that itself starts the app is lost.

## Plugins

Plugins live in a vault's `.ilmi/plugins/` and are turned on in settings (through a
storage, each one on or off on its own, so two devices that each turn one on
both keep both); the
API, how to write one, and how to package one are in `PLUGINS.md`. The repo
ships two under `plugins/`: the sample, and a dictionary that looks a selected
word up (Wiktionary by default, Arabic clitics stripped on the way) and adds
it to a vocab deck from the popover.
