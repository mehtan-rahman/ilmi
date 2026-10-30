# ilmi — build log

One entry per session, newest first. `PLAN.md` holds the milestone list and
the per-milestone notes; this file holds the narrative: what was done, what
was verified, what was not, and the prompt to resume with.

---

## 2026-10-30 — milestone 41: the editor's rest — outline, folding, code, tables

Done on main; commit `c1a7a60` — *the editor's rest (milestone 41): an
outline in the inspector beside the rail's, headings folded by a chevron
and kept in state.json, code coloured by a bundled highlighter with a
language picker on the fence, tables edited as tables and written back as
the normalized pipe table*. New: `src/reader/fold.ts`, `highlight.ts`,
`table.ts`, `src/app/headings.ts`, `popMenu.ts`, two test files. Changed:
the schema (table nodes), `raw.ts` / `blocks.ts` (the table pair,
`readTable` / `writeTable`), `plugins.ts` (keys, the code plugin, cell
directions, paste in a cell), `slash.ts`, `insert.ts`, `Reader.tsx`
(`CodeView`, `TableView`, the folds kept, the marker over a fold, the
heading jump), `Inspector.tsx` (the outline), `Rail.tsx` (its click
through the jump), the store and `state.json` (`folds`), the CSS and
tokens, `smoke.ts` (`smokeRest`; `insert` and `render` adjusted), and
highlight.js 11.11.1 in package.json. Also, by the coordinator's word,
`smokeArabic`'s passage check is `rtl >= 4` (the glossary is LTR since
`d0adb50`).

### Done

- An outline of the page's headings in the inspector whenever the tab
  rail is not showing them; the rail's and the inspector's click both go
  through one jump that opens folds and scrolls.
- Headings fold by a chevron in the margin; folded, a quiet `…` (with the
  cards it holds) after the heading opens it; kept per document by
  heading key in `.ilmi/state.json`, never in the file. A press on a
  folded heading in the gutter reads its whole section; the rule ends at
  the folded heading; the caret, a landed card, or a find match arriving
  inside opens the fold.
- Code coloured in eleven languages, themed for light, dark and e-ink
  (grey and weight); the language picked from the fence's corner, written
  on the fence. +67 kB minified / +22 kB gzip for the highlighter.
- Tables edited in place: cells with the live inline rules, Tab/⇧Tab, ⏎
  down and out, ⌘⏎ a row, rows and columns at the edges and from the cell's
  menu, delete, align; written back as the pipe table, untouched tables
  byte for byte, changed ones normalized (only edited lines change on the
  sample's tables); Arabic cells right to left; find and replace reach
  cells.

### Verified

- `npx vitest run`: 919 tests, 50 files (894 before; `rest.test.ts` 16,
  `rest-view.test.ts` 9). `npm run typecheck` clean. `cargo test` 12.
  `vite build` clean.

### Not verified — the window run is owed

- Nothing ran in the Tauri window. `ILMI_SMOKE=rest` drives the "done
  when" over a copy of the sample, asserting each step and polling the
  files: the outline scrolling from the rail and the inspector, lecture 9
  folded, untouched on disk, kept in `state.json` and after a reopen, a
  folded section of the Lindqvist chapter read by one press, a code note
  coloured (light, dark, e-ink) and a plain block given `bash`, the
  verb-forms table typed, tabbed, ⏎'d, a row and a column added and
  removed. Captures are listed in 41's notes.
- Window run 1 (`21f5763`, the coordinator's): all passed up to the read
  rule's check over a folded section, which measured the rule mid-ease
  (4611 vs 7187). The smoke now waits for the rule to rest; the reader
  re-measures on a timer after a fold (`d8925f9`). Rerun owed.
- Window run 2 (`3f4839a`): still 2575 px off. The rule's painted box is
  frozen by a covered window's held-back transition; the smoke now checks
  the rule's style in the wrap's frame and logs what is drawn (and a
  shot) before the check; the reader's end block comes from the state
  (`ruleEndIndex`), tested on the sample. Rerun owed.
- Window run 3 (`b313750`): the rule right; e-ink code kept the dark hues
  because the page was still in dark (`data-theme` waited on App's
  effect, held back in a covered window). `setTheme` sets it at once now;
  the smoke waits for it and checks e-ink after light and after dark.
  Rerun owed.

### Handoff prompt

```
Read PLAN.md (ground rules, Refinement, 41's notes and the notes for the
next session), FORMAT.md, spec/hashiyah/BUILD-PROMPT.md, and the top
BUILD-LOG.md entries. If the user has not yet, run ILMI_SMOKE=rest with
ILMI_VAULT on a fresh copy of samples/double-major (port 1420 free, never
kill a run that is not yours; capture 2 s after each `shot:` line), read
the captures, fix what they show, and record it under 41. Then do
milestone 40 (a pass over everything, on a full collection) and only
that one; stop at its "done when". Suite, typecheck, and `cargo test`
green before each commit; tick it, write notes, add an entry here with a
fresh handoff prompt, and commit.
```

---

## 2026-10-30 — milestone 36: Arabic beside English

Done on branch `worktree-agent-a52202991c6a668ce` (to be merged by hand);
commit `594a4e1` — *Arabic beside English (milestone 36): each block's
direction from its first strong character, math and code isolated, Noto
Naskh Arabic and IBM Plex Sans Arabic bundled, a case ending's blank on
its letter*. Files: `src/reader/direction.ts` (new, the rule),
`src/reader/plugins.ts` (the `direction` plugin, code's `dir`),
`src/app/fonts.css` (new), `tokens.css`, `main.tsx`, `Reader.tsx` (math,
code, raw blocks, card faces, `clozeHTML`'s case ending, `blankAnswers`,
`faceDir`), `Session.tsx`, `DeckBrowser.tsx`, `Queue.tsx`, `Crumbs.tsx`,
`dir="auto"` in `Composer`, `Palette`, `Tree`, `Rail`, `Lenses`,
`Inspector`, `Pdf`, `Intake`, the deck search; `reader.css`, `app.css`,
`session.css`, `queue.css`; `smoke.ts` (`smokeArabic`), `vault.ts` (the
dispatch); `package.json` and the lock (the two font packages); README;
tests (`direction.test.ts`, `arabic.test.ts` new, `reader-view.test.ts`'s
HTML with its `dir`s).

### Done

- Each block's direction from its first strong character, a block with
  none inheriting the one before; lists and quotes by their first item,
  each item its own; cards by their text. A decoration, never written.
  The same rule on the read-only drawings: raw lists and tables, card
  faces, the session, the deck browser, the queue's rows; names
  `dir="auto"`; every field that may hold Arabic `dir="auto"` (find,
  deck search, palette, renames, card editor, composer, intake).
- Inline math, inline code, and card markup are LTR isolates; display
  math LTR and centred.
- Noto Naskh Arabic (variable) behind the serif and IBM Plex Sans Arabic
  behind Plex, from @fontsource, only their Arabic woff2 files, with
  Arabic `unicode-range`s: +227.9 kB of fonts, `dist` 5776 → 6016 KiB.
  RTL blocks at line-height 1.85, no letter-spacing, no fake italic;
  one-line rows that clip given room for the marks.
- Logical CSS for the reader's bullets, task boxes, quote bars, list
  indents, the card's due chip and the session card's alignment.
- A cloze whose answer is only marks shows its blank on its letter: the
  bare letter hidden, letter + mark revealed and on the answer face.

### Verified

- `npx vitest run`: 864 tests, 45 files (838 before; `direction.test.ts`
  15, `arabic.test.ts` 11). `npm run typecheck` clean. `cargo test` 12.
  `vite build` clean. (In this worktree vitest ran with a scratch config
  allowing the symlinked `node_modules`, not committed.)

### Not verified — the window run is owed

- Nothing ran in the Tauri window. `ILMI_SMOKE=arabic` (new) drives the
  "done when" over a copy of the sample, asserting every step (`ok: …`;
  the first mismatch is `failed: …`); its captures are listed in 36's
  notes. What only the window can say: Naskh's marks against the 1.85
  line in WebKit, the joins across a case ending's span, the find field's
  direction as typed, and how the canvas ink check reads WebKit's metrics.
- `npm install` could not run here (node_modules is the main checkout's);
  the lock was written with `--package-lock-only` and the packages
  unpacked from `npm pack`. Run `npm install` on main after the merge.

### Window check 2026-10-30

Window check 2026-10-30: fonts load, Naskh draws, voweled runs not
clipped, the find field RTL; failed at "a glossary item that starts in
Arabic is right to left" (the smoke read the item's text from its bullet,
`•`, so found none), and the captures showed the rule wrong for this
user: in the grammar note `إِنْ تَدْرُسْ تَنْجَحْ, in tadrus tanjaḥ, …` was
RTL, its English right to left, the period at the far left. Rule changed
to majority script: a block is RTL when its right-to-left letters
outnumber its others (strong letters only; formulas, code, card markup,
`^id`, comments, addresses skipped as before); a tie goes to the first
letter; no letter inherits. One change in `strongDir` reaches every
caller (editor plugin, raw lists and tables, card faces, session, deck,
queue); `dir="auto"` fields untouched. A raw list's `<li>`s each get the
rule, an item with no letter inheriting the item before. Tests:
`direction.test.ts` (majority, ties, marks not counted, the sample's
glossary all LTR), `arabic.test.ts` (the glossed example and glossary
LTR, the verse RTL, vocab cards LTR with their faces RTL/LTR, raw list
items). `smokeArabic` updated (glossary LTR, verse RTL, the glossed
example LTR with its Arabic run in order, an all-Arabic list item RTL);
the window re-run is owed.

### Handoff prompt

```
Read PLAN.md (ground rules, Refinement, 36's notes), FORMAT.md §5, and the
top BUILD-LOG.md entries. Merge branch worktree-agent-a52202991c6a668ce
into main if it is not yet, then `npm install`. Run ILMI_SMOKE=arabic with
ILMI_VAULT on a fresh copy of samples/double-major (port 1420 free, never
kill a run that is not yours; capture with screencapture -l <window id>
2 s after each `shot:` line), read the captures, fix what they show, and
record it under 36's entry. Then do milestone 37 (cards where notes put
them, and review in their place) and only that one; stop at its "done
when". Suite, typecheck, and `cargo test` green before each commit; tick
it, write notes, add an entry here with a fresh handoff prompt, and
commit.
```

---

## 2026-10-30 — milestone 37: cards where notes put them, and review in their place

Done on main (beside 36 in a worktree); commit `fe4c5c2` — *cards where
notes put them: a list item whose text is a card is a card, its sr line
under the item; review shows the heading path, go to source lands on the
card, study from the reader's top row*. Files: FORMAT.md (§4, §5 steps,
§5.2, §6, §8, §10), `src/format/model.ts` (`Card.item`, `joined` on cards
and raws), `parse.ts` (`listBlocks`, `itemCard`, the steps rule),
`serialize.ts` (`formatBody`, `joins`), `src/reader/schema.ts` and
`convert.ts` (the `joined` attr), `lists.ts` (renumbering past card items),
`insert.ts` (a copy keeps the joins), `src/app/Reader.tsx` (the card item's
view, the landed mark, the `StudyButton`), `Session.tsx` (the trail, `o`),
`items.ts` (`trailParts`), `src/schedule/queue.ts` (`trail`),
`StudyButton.tsx` and `incontext.css` (new), `NodeMenu.tsx` (the tab's
`study`), `cardEdit.ts`, `deck.ts`, `src/vault/vault.ts` (a moved card
loses its item), `src/import/page.ts` (list items defused), `chrome.ts`,
`smoke.ts` (`smokeListCards`), `vault.ts` (its dispatch), README, the
sample's three notes, and the tests.

### Done

- `- term :: def`, `1. the {{c1::x}} factor`, nested items, `?` items are
  cards; the sr line is written under the item at its content column; the
  rest of the list stays raw, in pieces written back as one list. A lazy
  line, a task, five spaces, a fence, a tab: raw. An sr line under a plain
  item is an orphan with a diagnostic. The rules are in FORMAT §5.2 and
  37's notes.
- Steps: after a `?` line, a list is the back (paragraph or item).
- The reader draws a card item beside its bullet or number; typing one in
  a list makes a card once the write is read back; ⏎ renumbers past it.
- The session's top line: `canonical ensemble & partition functions ›
  lecture 9 — $Z$ does everything (Wed 9/23) ↗`; `o` or a click opens the
  note scrolled to the card, selected and marked.
- `study` in the reader's top row of a note or source with cards, and on
  a tab's `···` in the rail.
- The sample: four Poisson-bracket cards and one stat-mech card are
  bullets; the three list cards in the Lagrangian notes count now (758).

### Verified

- `npx vitest run`: 866 tests, 46 files (843 before). `npm run typecheck`
  clean. `cargo test` 12. Every corpus file and every sample file is a
  fixed point; the samples test lists the card items.

### Not verified — the window run is owed

- Nothing ran in the Tauri window. `ILMI_SMOKE=listcards` (new) drives
  the "done when" over a copy of the sample and asserts each step (`ok:`;
  the first miss is `failed:`): the stat-mech note's card items drawn, a
  bullet card typed after lecture 9 and read back as one, its queue row,
  the session's heading path, the grade's sr line under the item, `o`
  landing on the card (scrolled, selected, `landed`), `study` in the top
  row and on the tab's menu, then dark. Captures listed in 37's notes.
- The look of a card item beside the list in light, dark, and e-ink; the
  landed fill's fade in WebKit.

### Handoff prompt

```
Read PLAN.md (ground rules, Refinement, 36's and 37's notes), FORMAT.md
§4–§6 and §8, and the top BUILD-LOG.md entries. Run ILMI_SMOKE=listcards
with ILMI_VAULT on a fresh copy of samples/double-major (port 1420 free,
never kill a run that is not yours; capture with screencapture -l <window
id> 2 s after each `shot:` line), read the captures, fix what they show,
and record it under 37's entry. Merge milestone 36's worktree branch into
main if it is not yet (it meets 37 in Reader.tsx's card view and top row
and in Session.tsx's top line; 37's CSS is apart in incontext.css). With
33–39 in, do milestone 40 (a pass over everything, on a full collection)
and only that one; stop at its "done when". Suite, typecheck, and `cargo
test` green before each commit; tick it, write notes, add an entry here
with a fresh handoff prompt, and commit.
```

---

## 2026-10-30 — milestone 39: tabs, refined

Done on branch `worktree-agent-afea09d94a7eddc9d` (beside 35 on main, to be
merged by hand); commit `7c76a4c` — *tabs, refined (milestone 39): a `tabs`
toggle in the top row, extracts never tabs, the active tab's outline, the
rail from the keyboard, hover menus, ⌃⌘T, a resizable rail; 38's window
findings fixed*. Files: `src/app/Rail.tsx` (rewritten), `tabs.ts` (the
rail's rows as tree rows, extracts out, three levels, `railKeyPlace`,
`outline`, `showsTabsToggle`, the width), `TabsToggle.tsx` and `remove.ts`
(new), `drag.ts` (the rest and the spring on timers), `NodeMenu.tsx` (the
tab menu, `duplicate`, deletes with undo), `Tree.tsx` and `treeModel.ts`
(10 px a level), `vault.ts` (`duplicateNode`, `noteAfter`, `setRailWidth`,
the book as a notebook), `land.ts`, `store.ts`, `useDoc.ts`, `app.css`,
`src/vault/vault.ts` (`remove` → `Removed`, `restore`, `duplicate`),
`src/vault/order.ts` (`restoreOrder`), `smoke.ts` (`smokeTabs2`), FORMAT §3
(a sentence on how the rail draws), README, one line in `Reader.tsx`, and
the tests (`tabs-refined.test.ts`, `remove.test.ts` new).

### Done

- 38's window findings: a still pointer resting 400 ms on a bare note's
  middle nests it (timers, and the drop checks the clock; the window's miss
  was likely also the smoke's target sitting in the edge band, scrolled
  under the pointer by each dragover); every delete leaves `deleted · name`
  with `undo`, which writes the files back and the entry into its old place
  in `order.json`; names four levels down no longer cut at the default
  width (10 px a level, 4 px gaps, 232 px sidebar; the sidebar's edge was
  already a resize remembered in `state.json`).
- `tabs` in the reader's top row of any document with children; an EPUB
  lands as a notebook, its chapters as tabs.
- The rail: 200 px, its edge dragged (150–360, one width remembered);
  extracts never tabs (one `n extracts` row opening their folder inside the
  notebook); three levels; the active tab's headings under it, a click
  scrolling to one, a second click on the tab hiding them; `+ add tab` at
  the top; hover `+` (a note after it) and `···` (add subtab, rename,
  duplicate, move to…, delete); the tree's keys in the rail; ⌘⌥↑↓ from the
  page; fold on ⌃⌘T (why in 39's notes); drags cross to the sidebar (38's).

### Verified

- `npx vitest run`: 818 tests, 42 files (793 before). `npm run typecheck`
  clean. `cargo test` 12. (In this worktree vitest ran with a scratch config
  allowing the symlinked `node_modules`, not committed.)

### Not verified — the window run is owed

- Nothing ran in the Tauri window. `ILMI_SMOKE=tabs2` (new) drives the
  "done when" and the three fixes over a copy of the sample and asserts
  every step (`ok: …` lines; the first mismatch is `failed: …`); read its 19
  captures (listed in 39's notes).
- A real pointer's drag on the rail, the hover look, the outline's scroll in
  WebKit, the rail's resize cursor; a multi-chapter PDF as a notebook is not
  done (a page range per document would be a format change).
- Window run 1 (`854659c`): passed to the outline, then failed reading the
  overview's headings before the click had made the tab the page (a smoke
  race; the rail was right). Heading rows carry `data-of`; the smoke waits
  for the page and that tab's headings only; a new test. 839 tests.
- Window run 2 (`74eefea`): passed to the rail → sidebar drag, then no wkb row:
  the dragged tab was the open page and the pane followed it out of the
  notebook (the app is right). The smoke reopens the course there. Rerun owed.

Window run 3 (2026-10-30, on main after the merge): `ILMI_SMOKE=tabs2`
ran to `done`, every step asserted: a still rest nests in the tree and
the rail, a delete comes back by the notice's undo with its order, a level
is 10 px and the sidebar's edge resizes and is kept, the top row's toggle
writes and drops `tabs: true`, no extract is a tab (`§ 2 extracts` opens
their folder), the open tab's headings scroll the page, `+ add tab` makes
a plain note, F2 and ⌥⌘←→↑ in the rail, drags rail → rail → sidebar, the
row's `+` and `···`, ⌃⌘T folds, the rail's edge resizes and is kept.

### Handoff prompt

```
Read PLAN.md (ground rules, Refinement, 38's and 39's notes), FORMAT.md §1
and §3, and the top BUILD-LOG.md entries. Merge branch
worktree-agent-afea09d94a7eddc9d into main if it is not yet (its one line
in Reader.tsx: <TabsToggle path={id} /> after the crumbs). Run
ILMI_SMOKE=tabs2, then ILMI_SMOKE=tree, each with ILMI_VAULT on a fresh copy
of samples/double-major (port 1420 free, never kill a run that is not
yours; capture with screencapture -l <window id> 2 s after each `shot:`
line), read the captures, fix what they show, and record it under 39's
entry. When 35–37 are in, do milestone 40 (a pass over everything, on a
full collection) and only that one; stop at its "done when". Suite,
typecheck, and `cargo test` green before each commit; tick it, write notes,
add an entry here with a fresh handoff prompt, and commit.
```

---

## 2026-10-30 — milestone 35: insert, paste, find

Done on main; commit `89d881d` — *insert, paste, find: a slash menu for
every block and the card forms, HTML pasted as Markdown, images beside
the note, find with marks folded*. Files: `src/reader/slash.ts`,
`src/reader/insert.ts`, `src/reader/find.ts`, `src/import/paste.ts`,
`src/app/pageImages.ts` (new); `src/reader/plugins.ts` (the menu and find
plugins, the paste and copy as Markdown), `src/app/Reader.tsx` (the menu,
the find bar, images pasted, dropped, picked), `src/vault/vault.ts`
(`addImage`), `src/app/land.ts` (a Finder drop of images over a page goes
to the page), `src-tauri/src/lib.rs` and `Cargo.toml` (Edit › Paste and
Match Style, ⌘⇧V, macOS), `src/app/chrome.ts` (`⌘F find` in the strip),
`src/app/reader.css`, `src/app/smoke.ts` (`smokeInsert`),
`src/app/vault.ts` (the `insert` dispatch), README, and the tests
(`insert.test.ts` new; `notes.test.ts`'s strip case).

### Done

- `/` at a block's start or after a space opens the insert menu, filtered
  as typed, ↑↓ ⏎ Tab, Esc keeping the `/`: heading 1–3, bullet,
  numbered, task, quote, code, math block, divider, table, image, cloze,
  q&a, both ways, each row with its Markdown and its key; one ⌘Z after a
  pick puts the typed text back.
- Paste: HTML through the clipper's walker as Markdown (headings, lists,
  emphasis, links, code, tables, math; Google Docs' and Word's markup made
  plain), plain text read as Markdown by the format's parser, a copy from
  a page here written and read back as its Markdown; ⌘⇧V plain (a native
  menu item sending the webview `pasteAsPlainText:`).
- An image pasted, dropped from the Finder, or picked from the menu lands
  as the next `img-NN` in the document's folder and is linked there.
- ⌘F find at the page's top with `n/m`, ⏎ ⇧⏎ ⌘G ⇧⌘G, Esc; case, accents,
  ḥarakāt and the tatweel folded; cards and tables counted; ⌥⌘F replace and
  replace all on editable pages.
- Keys checked against App, chrome, Palette, Rail, the tree, the reader,
  and the native menu; all free (35's notes).

### Verified

- `npx vitest run`: 812 tests, 41 files (793 before; `insert.test.ts` 19).
  `npm run typecheck` clean. `cargo test` 12; `cargo build` with the new
  menu item and `objc2`.

### Not verified — the window run is owed

- Nothing ran in the window this session. `ILMI_SMOKE=insert` (new)
  drives the "done when" over a copy of the sample and asserts each step
  (a mismatch logs `failed:`); its captures: insert-menu, -blocks,
  -cards, -paste, -images, -find, -find-step, -replace.
- By hand: the real ⌘⇧V from the menu (the smoke sends the keydown and a
  synthetic paste); a real screenshot pasted (WebKit's clipboard files);
  a real Finder drag onto a page; the image picker; the menu's place near
  the window's bottom (it opens above its `/` there).

### Window check (2026-10-30, by the coordinator)

`ILMI_SMOKE=insert`: every step passed through the find count (`1/34`);
`⏎ walks every match` failed: matches in tables and cards counted but
were not drawn (29 lit of 34). The atoms' views dropped the decoration's
classes on redraw; they keep them now, and light each match inside what
they draw (`mark.find-hit` in a cell or on a card's face, the current
one ringed, the atom ringed too); the smoke checks every match's index is
lit and the current one is visible. The find fields are `dir="auto"`.
Rerun owed (tests 813).

### Handoff prompt

```
Read PLAN.md (ground rules, Refinement, 35's notes), FORMAT.md, and the
top BUILD-LOG.md entry. Run ILMI_SMOKE=insert with ILMI_VAULT on a copy of
samples/double-major (port 1420 free, never kill a run that is not yours;
capture with screencapture -l <window id> 2 s after each `shot:` line),
read the captures and the `ok`/`MISMATCH` lines, fix what they show, and
record it under 35. Then do milestone 36 (Arabic beside English:
direction per block, isolated math and code, bundled Arabic faces,
logical CSS, a case-ending cloze on its letter), and only that one; stop
at its "done when". Suite, typecheck, and `cargo test` green before each
commit; tick it, write notes, add an entry here with a fresh handoff
prompt, and commit.
```

---

## 2026-10-30 — milestone 38: the tree, refined

Done on branch `worktree-agent-a13978a57b82cc981` (beside 34 on main, to be
merged by hand); commit `ccb8e4c` — *tree: one drag for the tree, the rail
and the folder lens; the tree from the keyboard; the open note revealed;
a due number, quiet marks, hover menus, a hoist*. Files: `src/app/dnd.ts`,
`src/app/drag.ts`, `src/app/treeModel.ts`, `src/app/Crumbs.tsx` (new),
`Tree.tsx` (rewritten over the flat rows), `Rail.tsx` (only switched to
the shared drag), `Lenses.tsx` (`FolderLens` on the shared drag, its empty
row takes drops), `NodeMenu.tsx` (`dropMode` gone), `names.ts` (`GLYPH`,
`slugName`, `rowCounts`), `chrome.ts` (the palette's marks and names),
`Pdf.tsx` (breadcrumbs), `app.css`, `smoke.ts` (`smokeTree`), `vault.ts`
(the `tree` dispatch), README, and the tests (`dnd.test.ts`,
`tree-model.test.ts`, `tree-refined.test.ts` new).

### Done

- One drag model in one module for the tree, the tab rail, and the folder
  lens, crossing between them: quarters before / after, the middle half
  nests (a bare document only after a 400 ms rest, so a reorder never
  nests by accident), an open parent's bottom is its first child, below a
  last child the pointer's x picks how far out; a line indented to the
  landing depth with a ring at its start, a hairline box for into,
  nothing for a refused drop; no flicker over a row's text; a folded row
  opens after 500 ms; the scroller scrolls at its edges; Esc cancels.
- The keyboard: ↑↓ Home End → ← ⏎ F2 ⌘⌫ (asking in the row when
  something is under it), ⌥⌘↑↓ ⌥⌘← →, type-ahead.
- F2 fixed (the coordinator's report from 33's window run: "F2 in the
  tree: rename not open"): the key read a stale selection; see 38's notes.
- The selected row drawn; the open document revealed; indent guides; one
  due number with the counts in the tooltip; the name's gradient mask gone
  for an ellipsis; slugs as names; the six marks `/ ¶ “ § = ~` all in the
  bundled Plex Mono (why in 38's notes); folder names by weight; hover
  `+` and `···`; an empty folder's `empty` row; ⌥-click hoist with a crumb;
  breadcrumbs as links in the PDF lens (the reader's after the merge).

### Verified

- `npx vitest run`: 767 tests, 39 files (718 before). `npm run
  typecheck` clean. `cargo test` 12. (In this worktree vitest needs
  `server.fs.allow` for the symlinked `node_modules`, a scratch config;
  on main it runs as is.)

### Not verified — the window run is owed

- The screen was locked and this is a worktree; nothing ran in the
  window. `ILMI_SMOKE=tree` (new) drives the "done when" over a copy of
  the sample; read its `where the mark said: yes/NO` lines, `cut by their
  count: none`, the reveal line, the F2 lines, and the captures (listed
  in 38's notes).
- A real pointer drag (WebKit's drag image, relatedTarget on dragleave,
  Esc in a native drag), hover, and the cursor's "no".
- After merging: the reader's crumb to `<Crumbs path={id} />` (one line in
  Reader.tsx, left alone here for the editor track).

### Window check (after the merge, 2026-10-30)

`ILMI_SMOKE=tree` on a copy of samples/double-major ran to `done`, 23
captures read. Every before/after drag landed where its line said; a
folder's middle nests; an open parent's bottom is its first child; below a
last child the pointer's x picked depths 5, 4, 3; a refused drop draws
nothing and moves nothing; Esc cancels a sprung drag; the sidebar
scrolls at its edge; drags cross tree → rail → tree and tree → lens →
tree; ↑↓←→, type-ahead, ⏎, F2 (only with the tree focused), ⌥⌘↑ and
⌥⌘←→ move rows; reveal opens the rows to the active note; hoist and
back. Found, for 39: (1) resting 600 ms on a bare document's middle still
drew the line below and dropped after it, not into it ("middle, rested");
(2) ⌘⌫ on a note with nothing under it deletes at once with no undo;
(3) at the default sidebar width names four levels deep are cut
("variational met…", 56 of 84 rows) by the indent, not the counts.

### Handoff prompt

```
Read PLAN.md (ground rules, Refinement, 38's notes), FORMAT.md §1, and the
top BUILD-LOG.md entry. Merge branch worktree-agent-a13978a57b82cc981 into
main if it is not yet (swap the reader's crumb for <Crumbs path={id} />).
Run ILMI_SMOKE=tree with ILMI_VAULT on a copy of samples/double-major
(port 1420 free, never kill a run that is not yours; capture with
screencapture -l <window id> 2 s after each `shot:` line), read the
captures, fix what they show, and record it under 38's entry. Then do
milestone 39 (tabs, refined), building its rail drags and keys on
src/app/drag.ts, dnd.ts and treeModel.ts, and only that one; stop at its
"done when". Suite, typecheck, and `cargo test` green before each commit;
tick it, write notes, add an entry here with a fresh handoff prompt, and
commit.
```

---

## 2026-10-30 — milestone 34: editing like an editor, keys, rules, lists

Done on main; commit `52823ee` — *editing: formatting keys that write
Markdown, block rules as typed, lists moved with their children, a
toolbar over the selection*. Files: `src/reader/lists.ts` and
`src/reader/commands.ts` (new), `src/reader/plugins.ts` (the list
commands moved out; `formatKeys`, the Enter and Backspace chains),
`src/reader/inline.ts` (`~~strike~~`), `src/reader/index.ts`,
`src/app/Reader.tsx` (the toolbar, the link field, ⌘K, a blank formula's
editor), `src/app/App.tsx` (⌘K yields to the reader), `src/app/reader.css`,
`src/app/smoke.ts` (`smokeEditing`), `src/app/vault.ts` (the `editing`
dispatch), `README.md`, and the tests (`editing.test.ts` new, two cases of
`reader-view.test.ts` changed on purpose).

### Done

- Formatting keys, matched on `event.code` (an Arabic layout presses the
  same keys): ⌘B ⌘I ⌘E ⌘⇧X put `**` `*` a backtick `~~` around the
  selection and take them out again; ⌘K opens an address field over a
  selection or in a link (with a bare caret it stays the palette's), and a
  URL pasted over a selection links it; ⌘1–⌘6 and ⌘0; ⌘⇧7 ⌘⇧8 ⌘⇧9 lists
  on and off; ⌘⇧. a quote on and off.
- Block rules as typed: `- ` `* ` `1. ` `[ ] ` `> ` at a paragraph's
  start, `---`, a fence line then ⏎ (an empty code block), `$$` then ⏎ (a
  display formula with its editor open). Backspace right after any of
  them puts the typed text back.
- Lists as structure: Tab/⇧Tab move an item with its children (under the
  sibling before it, at its text column); ⏎ on an empty item outdents,
  then leaves; Backspace at an item's start makes it a paragraph (and the
  next Backspace puts it back); ⌥⇧↑/↓ move the item with its children,
  numbers following; ⌘⏎ ticks a task.
- The selection cue is a toolbar above the selection: `b` `i` `code`
  `link`, then `card ⌘⇧M` and `extract ⌘⇧E`; on a frozen page only the
  last two.
- Collisions: only ⌘K (the palette) among the app's keys, the native
  menu, and macOS's; see 34's notes for the full check.

### Verified

- `npx vitest run`: 742 tests, 37 files (718 before; `editing.test.ts`
  24). `npm run typecheck` clean. `cargo test` 12.

### Not verified — the window run is owed

- The screen was locked; nothing ran in the Tauri window.
  `ILMI_SMOKE=editing` (new) drives the "done when" over a copy of the
  sample, in `fleeting/2026-10-29.md`: below its last paragraph it types
  a heading (⌘2, ⌘0, ⌘2), a list by `- ` nested by Tab, moves an item with
  its children (⌥⇧↓, ⌥⇧↑), ⇧Tab/Tab one with its child, ⏎ on empty items
  (outdent, leave), Backspace at an item's start and ⌘Z, a task by `[ ] `
  (⌘⏎, its box), a numbered list by `1. ` with an item moved, a quote by
  `> ` (⌘⇧. off and on), `---`, `* ` taken back by Backspace, a fence and
  ⏎, `$$` and ⏎ with the formula written; then over the note's own words
  ⌘B ⌘I ⌘E ⌘⇧X (⌘B again, off), ⌘3 ⌘0, ⌘⇧8 ⌘⇧7 ⌘⇧9 ⌘⇧. on and off, ⌘K's
  field, ⌘K with a bare caret (the palette), a pasted address; the
  toolbar's buttons and place over a selection, its `b`, gone when the
  selection collapses; and the toolbar on a frozen source. The file's
  typed lines are logged after each step; `shot:` at editing-list,
  -moved, -blocks, -math, -link, -toolbar, -frozen-toolbar.
- Typing goes through `execCommand('insertText')` a character at a time;
  whether WebKit hands each one to the input rules as typing does, the
  synthetic ClipboardEvent's `clipboardData`, and the toolbar's look (the
  letters, the hairline, its place above a selection near the top) are
  for the window.

### Window check 2026-10-30

`ILMI_SMOKE=editing` run by the coordinator: keys, ⌘K, tasks, numbers
and moves, the quote toggle, Backspace and ⌘Z worked. Fixed after it:
`---` under macOS's smart dashes (`—-` counts), the smoke's caret landing
in the note's first paragraph (it now takes the last match, checks a
fresh paragraph before each rule, and asserts every step), the toolbar's
measure (client rects, a frame later), formulas painted over the space or
comma after them (`hanging-punctuation` hung KaTeX's closing brackets;
`.math .katex { hanging-punctuation: none }`, checked in an offscreen
WKWebView), and the formatting steps' "(none)" lines. 743 tests; the
window rerun is owed.
Rerun: all steps passed to `$$ written`, which read the earlier `$$ $$`
write; the smoke's checks now wait for the expected lines (the editor
writes the formula, a new reader-view test shows). 744 tests.
Second rerun: the toolbar never showed; its measure waited for an
animation frame, which WKWebView holds back in a covered window. A
zero-delay timer now.

### Window check (2026-10-30)

`ILMI_SMOKE=editing` on a copy of samples/double-major: the first run
found the smoke typing rules mid-paragraph, `---` turned into an em dash
by macOS smart dashes, the toolbar measured against an empty line rect,
and the space after a formula painted over (WebKit hanging the formula's
closing bracket); all fixed (`11c129b`, `00866cc`, `6f558ee`), and the
fourth run ran to `done` with every step asserted. Captures read: lists
with nesting, a task box, renumbered items, a quote, a divider, a code
block, a display formula, and the toolbar above its selection.

### Handoff prompt

```
Read PLAN.md (ground rules, Refinement, 33's and 34's notes), FORMAT.md,
and the top BUILD-LOG.md entry. First run ILMI_SMOKE=notes and then
ILMI_SMOKE=editing, each with ILMI_VAULT on a fresh copy of
samples/double-major (port 1420 free, never kill a run that is not
yours; capture with screencapture -l <window id> 2 s after each `shot:`
line), read the captures, fix what they show, and record it under 33's
and 34's entries. Then do milestone 35 (insert, paste, find) and only
that one; stop at its "done when". 38 (the tree) is on a branch beside
it: leave Tree.tsx, NodeMenu.tsx, Rail.tsx and the tree's CSS alone.
Suite, typecheck, and `cargo test` green before each commit; tick it,
write notes, add an entry here with a fresh handoff prompt, and commit.
```

---

## 2026-10-30 — milestone 33: notes, what you write is a note, what you read is a source

Done on main; commit `8dceb49` — *notes: what you write is a note, what
you read is a source; bare letters type in editable text, ⌘⇧E and ⌘⇧M
carve and card*. Files: `FORMAT.md` §1 and §3, `src/format/model.ts`,
`src/format/frontmatter.ts` (`note`, the default, the `imported` rule),
`src/schedule/read.ts` and `queue.ts` (a note's pass keeps no `pos`; the
read item's `note`), `src/vault/vault.ts` (`createDoc`, `importDoc` with
`note`, `importPdf`, `extract`), `src/import/supermemo/docs.ts` and its
`LAYOUT.md`, `src/plugins/api.ts` (and `plugins/ilmi.d.ts`),
`src/plugins/runtime.ts`, `src/app/Reader.tsx` (`readerAction`, `revisit`,
`from…`, the cue's keys), `Session.tsx`, `Tree.tsx` (F2), `App.tsx` (⌃⌘S),
`chrome.ts`, `BottomStrip.tsx`, `items.ts`, `names.ts`, `NodeMenu.tsx`,
`Lenses.tsx`, `Rail.tsx`, `Inspector.tsx`, `Intake.tsx`, `vault.ts`
(`enrolReading`, the `notes` dispatch), `smoke.ts` (`smokeNotes`), the CSS,
two corpus files, 11 migrated files in `samples/double-major`, and the
tests (`notes.test.ts`, `samples.test.ts` new).

### Done

- Five kinds: note (the default for a file with no `type`), source,
  extract, draft, deck. A typeless file with `imported` stays a source, so
  files imported before today read as they did. Importers write `type:
  source`; new, `+ tab`, `add subtab`, and text pasted into the intake make
  notes. The menus, the `+` lists, the palette, the inspector, the tree's
  glyphs (note `¶`, source `“`), and the queue's tags (`note`, `read`,
  `write`, the card forms) use the five words.
- Revisit: `revisit` in a note's top row (`r`) and its node menu writes
  `read: due=… ivl=1 reps=0`, no `pos`. A pass opens at the top; the top
  row's `from…` scrolls to a heading, writing nothing. No marker on a note;
  the session's bar says `note` and `went over it`; a pass, a postpone, an
  extract never write `pos` on a note.
- Keys: bare `e` `m` `r` only where the text is not being edited; in
  editable text ⌘⇧E extracts and ⌘⇧M opens the composer over the
  selection, and letters typed over a selection type. The cue and the
  bottom strip show ⌘⇧E / ⌘⇧M on an editable page, `e` / `m` on a frozen
  one. ⌘⇧E was the sidebar's toggle; that is ⌃⌘S now. Nothing in the
  native menu binds either key. F2 renames a tree row only while the tree
  has focus.
- The sample migrated (34 notes, 11 sources, 17 extracts, 10 decks, 2
  drafts); the sample author's verifier reports `problems 0`.

### Verified

- `npx vitest run`: 718 tests, 36 files (629 before; `samples.test.ts` 76,
  `notes.test.ts` 5, the format default-change test, the note's pass in
  `schedule.test.ts`, the extract from a revisited note, F2 in
  `tree.test.ts`). `npm run typecheck` clean. `cargo test` 12.
- `npx tsx <scratchpad>/verify.mts samples/double-major -v`: 74 files, no
  problems, byte-canonical.

### Not verified — the window run is owed

- The screen was locked; nothing ran in the Tauri window. `ILMI_SMOKE=
  notes` (new) drives the "done when" over a copy of the sample: opens
  `fleeting/2026-10-30.md` and logs its kind, lens, glyph, top row, and
  strip; logs the sidebar's `+` and a folder lens's buttons; revisits the
  time-dependent PT note from its top row, picks `Fermi's golden rule` in
  `from…`, finds its `note` row in the queue, opens the session (bar,
  actions, no marker) and goes over it (the read line after); selects
  `rough` in the note, presses `e` on the surface and logs that the key
  was not taken and the word became `e`; bare `m`/`r` not taken; ⌘⇧E
  carves an extract (child and backref logged), ⌘⇧M opens the composer
  and saves a cloze; bare `e` in the frozen ch. 3 still extracts; F2 in
  the page does nothing and in the focused tree opens the rename; an
  import lands `type: source`, a paste a note. `shot:` lines at
  notes-typeless, -new-menu, -revisit-heading, -queue, -revisit-session,
  -cue, -extracted, -composer, -frozen-cue.
- Typing over a selection in WebKit: the smoke types with
  `execCommand('insertText')` only after the keydown was not taken; a real
  keypress is for a person.
- ⌃⌘S under the native menu (no item binds it; the webview should get it).

### Window check (2026-10-30)

`ILMI_SMOKE=notes` on a copy of samples/double-major ran to `done`: a
typeless file opens as a note, revisit writes a read line with no `pos`
and the session says `went over it`, `e` over a selection in a note types
`e`, ⌘⇧E extracts and ⌘⇧M opens the composer, bare keys work on a frozen
source, imports land as sources and pasted text as a note. F2 in the tree
did not open the rename (fixed in 38). Left for 40: an extract carved
from a note is named by its first word ("Typed"); queue paths are slugs
that wrap; raw LaTeX in the inspector's card list and the `from…` list.

### Handoff prompt

```
Read PLAN.md (ground rules, Refinement, 33's notes), FORMAT.md, and the
top BUILD-LOG.md entry. First run ILMI_SMOKE=notes with ILMI_VAULT on a
copy of samples/double-major (port 1420 free, never kill a run that is
not yours; capture with screencapture -l <window id> 2 s after each
`shot:` line), read the captures, fix what they show, and record it under
33's entry. Then do milestone 34 (editing like an editor: keys, rules,
lists) and only that one; stop at its "done when". Suite, typecheck, and
`cargo test` green before each commit; tick it, write notes, add an entry
here with a fresh handoff prompt, and commit.
```

---

## 2026-10-28 — milestone 32: decks, a browser, cards edited in place, and studying one deck

Done on branch `worktree-agent-aedb6add9558a8a41` (built beside 31 on
main, to be merged by hand); commit `e83b596` — *decks: a browser, cards
edited in place, and studying one deck*. Files: `FORMAT.md` §6.2 and §8
(`sus`), `src/format/model.ts`, `src/format/parse.ts`, `src/schedule/queue.ts`
(`isSuspended`), `src/schedule/card.ts`, `src/schedule/index.ts`,
`src/vault/vault.ts` (`VaultState.decks`), `src/app/deck.ts`,
`src/app/cardEdit.ts`, `src/app/study.ts`, `src/app/deckOps.ts`,
`src/app/DeckBrowser.tsx`, `src/app/deck.css` (all new),
`src/app/Lenses.tsx` (`DeckLens` is the browser; `FolderLens` gains
`items · cards`), `src/app/Session.tsx` (the deck's header, the end back on
the deck), `src/app/store.ts` (`Session.deck`, `deckViews`),
`src/app/vault.ts` (`docsOf`, `setDeckView`, the views loaded and
re-keyed, the `decks` dispatch), `src/app/NodeMenu.tsx` (`study`),
`src/app/Palette.tsx` (`study…`), `src/app/chrome.ts` (deck hints),
`src/app/smoke.ts` (`smokeDecks`), the corpus `problem-set-1.md`, and the
tests.

### Done

- Suspended: `sus=1` on a bare line suspends the card, on an `sr cN` line
  that blank; the schedule stays; the queue, sessions, and counts leave it
  out; the browser shows it dimmed with `suspended` for its due.
- Browser: a search over both faces (a cloze's answers in place, case and
  accents folded, Arabic marks and the tatweel ignored; `/` focuses it),
  form chips (q&a, cloze, both ways), state chips (new, learning, review,
  due, suspended), seven sorts, the count `4 of 7`; rows with the form tag,
  the front, the back dimmed, the file's path when there is more than one
  file, and the due and interval on the right. The deck lens lists a deck
  and everything under it; a folder's (or a children directory's) lens
  has `items · cards`, the root's being the whole collection. Chips and
  sort are remembered per lens in `.ilmi/state.json` (`decks`).
- Selection: click, ⇧-click a range, ⌘-click toggles, ⌘A all shown; the
  bar shows `N selected` and move to… (every document, nested), delete,
  suspend / unsuspend, reset (asks), set priority, study these. Each is
  one write per file, with a notice whose undo puts every file back.
- Edit in place: ⏎ or a double-click opens the row as two faces (one for
  a cloze) in the session's look, smaller, each a live ProseMirror field
  with the reader's inline rules and math chips; the form switch (q&a,
  both ways, cloze, ⌘1–3) and the priority. ⌘⏎ or a press outside saves
  one write (id and bare line kept, dropped group lines asking when they
  carry reviews), Escape cancels; `m` and `+ card` open a new one after
  the cursor's row.
- Study: `study` on the lens (with `include not due`), `study` on the node
  menu of anything with cards under it, `study…` in the palette, `study
  these` from a selection; the session's header names the deck and counts
  down, its end opens the deck again.

### Verified

- `npx vitest run`: 611 tests, 33 files (570 with the `sus` format test;
  `deck-browser.test.ts` 21, `card-edit.test.ts` 12, `study.test.ts` 8).
  `npm run typecheck` clean. `cargo test` 12. In this worktree
  `node_modules` is a link to the main checkout's, which Vite's file
  allow-list refuses for the pdf.js worker URL; the suite was run with an
  untracked config that adds the main checkout to `server.fs.allow`
  (`vitest.local.config.ts`, not committed). On main, `npm test` as usual.

### Not verified — the window run is owed

- `ILMI_SMOKE=decks` was written but not run: port 1420 was in use by the
  other milestone's runs and the user's, and this session was told not to
  open the window. It searches the german deck (`wieder`, `Lucke`),
  filters to due, sorts by interval, ⇧-clicks three rows and suspends
  them (undoes from the notice, suspends again), types onto a row's back
  with ⏎ and ⌘⏎, switches another row to cloze and saves by a press
  outside, studies the deck with two grades, and logs the file's lines
  after each. Captures are owed with it.
- Typing into the face fields under WebKit (jsdom covers the fields' DOM,
  the keys, the switch, and the save; the smoke types with
  `execCommand('insertText')`); the sticky bar and the editor's look.
- The old `ILMI_SMOKE=deck` (16) drives the deck lens by `.card-span`,
  `.cs-body`, `.selected`, j k, ⌫, the row menu, and the inspector's
  editor, all of which the new rows keep; it was not rerun either.

### Window check (after the merge)

Merged into main by hand on 2026-10-28 (`0ed9a56`; conflicts in the store,
the vault state, the dispatch, the node menu's imports, the lens imports,
and the two appended smokes, every one kept on both sides). `ILMI_SMOKE=
decks` ran to `done` twice, captures read by window id. The search found
`die Wiederholung` and `spaced repetition` for "wieder" and `die Lücke` for
"Lucke"; the interval sort was remembered in `.ilmi/state.json`; three
rows suspended showed dimmed with `suspended`, the file's lines carried
`sus=1`, undo took them back, and the top strip's count fell from 40 to
37; the editor opened in the list with the two faces and the form switch;
a back was edited and a card switched to cloze (`vergessen {{c1::to
forget}}`); `study` opened `german · A1 · 4 left` and counted down with two
grades. The captures showed two faults, fixed in `deck.css`: `include not
due` wrapped to two lines (now `nowrap`), and the cursor's accent bar
clipped the row's form tag (the tag column is 52 px with 8 px inside).

### Handoff prompt

```
Read PLAN.md, FORMAT.md, BUILD-LOG.md, and spec/hashiyah/HANDOFF.md.
Milestones 0–32 are ticked (13 dropped); 31 ran on main and 32 on a
branch, merged by hand on 2026-10-28. Run ILMI_SMOKE=decks and
ILMI_SMOKE=tabs in the window if not yet recorded under these entries
(port 1420 free, never kill a run that is not yours; capture with
screencapture -l <window id>; if the window is hidden the webview's timers
stop, so keep it in front or touch a CSS file every 2 s), read the
captures, fix what they show, and record it here. Then ask the user what
is next. Suite, `cargo test` 12, and typecheck must be green before a
commit.
```

---

## 2026-10-28 — milestone 31: tabs, a document's children as tabs beside the page

Done on main; commit `a6e97d9` — *tabs: a document's children as tabs beside
the page*. Files: `src/app/tabs.ts` (new), `src/app/Rail.tsx` (new),
`src/app/__tests__/tabs.test.ts` (new), `src/format/model.ts` and
`frontmatter.ts` (`tabs`), `src/app/Lenses.tsx` (`Lens` wraps a notebook's
page, `PageLens` the old dispatch), `src/app/Canvas.tsx` (the pane label),
`src/app/panes.ts` (`openTab`'s `same`), `src/app/vault.ts` (`openNode` per
notebook, `createTab`, `setTabs`, `setRailFolded`, `rails` in state,
`pagesToNotebook`, the `tabs` dispatch), `src/app/store.ts` (`tabs` on
`DocInfo`, `railFolded`), `src/vault/vault.ts` (`rails` in `VaultState`),
`src/app/NodeMenu.tsx` (`show as tabs` / `show as tree`, `add subtab`),
`src/app/chrome.ts` (the palette's trail), `src/app/BottomStrip.tsx`,
`src/app/app.css`, `src/app/smoke.ts` (`smokeTabs`), `FORMAT.md` §3,
`README.md`, the corpus course (`tabs: true`), and the tests.

### Done

- `tabs: true` (FORMAT §3, with a **Tabs** paragraph): the course in the
  corpus carries it; it round-trips, clears, and a bad value is a raw line.
- A notebook is the outermost document at or above a page with the field.
  A pane tab on it holds the page shown, so anything that opens a path
  (the tree, the queue, a card from the palette, a session's source, the
  last tab on reopen) lands in the notebook on that tab, in the tab the
  notebook already has, its key kept: one pane tab per notebook, labelled
  `linear algebra › problem set 1` and drawn with the notebook's glyph.
- The rail (`Rail.tsx`): the notebook first, its children in 30's order,
  subtabs under a chevron (the tabs above the page shown open by
  themselves), click to show, double-click to rename, the node menu with
  `add subtab`, drags through `placeNode` (thirds before and after, the
  middle into, the overview only into), `+ tab` (a draft named `untitled`,
  last in the order, renamed in place) and `+` (source, deck, draft,
  import a file…). ⌘⌥↑ / ⌘⌥↓ step through every page, subtabs counted;
  ⌘⇧[ or `«` / `»` fold it to a strip, per notebook, in `.ilmi/state.json`
  as `rails`. Every lens works in the page: reader, deck, PDF, folder.
- `show as tabs` / `show as tree` on any document's menu. The sidebar
  tree is unchanged (a notebook's children stay rows there, folded until
  opened). The palette indexes a tab under its notebook
  (`linear algebra › unit-2`). A page deleted under its tab sends the tab
  back to the overview. The bottom strip names `⌘⌥↑↓ tabs`.

### Verified

- `npx vitest run`: 587 tests, 31 files (569 before; `format.test.ts` +1,
  `tabs.test.ts` 17). `npm run typecheck` clean. `cargo test` 12. The
  menu lists in `tree.test.ts` and `node-menu.test.ts` gained `show as tabs`.

### Window check

Port 1420 was free. `ILMI_SMOKE=tabs` (`mode-run.sh tabs`). The first two
runs stalled: the ilmi window was hidden and WebKit suspended its timers
(captures blank, the smoke resuming minutes later only when a Vite HMR
push woke it, its `until` deadlines then expired). A third run with a CSS
file touched every 2 s (HMR keeping the page awake;
`scratchpad/nudge.sh`) went through and showed a wrong expectation in the
smoke (the fresh vault's first tab is `unit-2`, not `vectors`); fixed, the
fourth run ended `done`, and every capture shows the ilmi window.

- Start and `show as tabs`: the rail beside the course's page, `TABS` and
  `«` at its head, `linear algebra` lit with the accent bar, then `unit-2`
  (▸), `problem set 1`, `unit 1 · vectors`; `+ tab` and `+` at its foot;
  the bottom strip `⌘⌥↑↓ tabs · e extract · m card …`. `show as tree`: the
  plain reader, `tabs:` gone from the file, back on the second click.
- `+ tab` → `untitled.md` made, open, its row renamed in place to
  `unit 1 notes`; `+` listed `source | deck | draft | import a file…` and
  made `unit 1 cards`, its deck lens (`no cards`) in the page; each last
  in `.ilmi/order.json`.
- `add subtab` (in the row menu after `add from text or a link`, beside
  `show as tabs`) → `unit 1 notes/week 1.md`, indented under its parent's
  ▾, the pane tab `linear algebra › week 1`, the page's crumb
  `courses / linear algebra / unit 1 notes`.
- Drags: `unit 1 notes` to the top of `unit-2` (lit `drop-before`), `unit
  1 cards` to the bottom of `unit 1 notes` (`drop-after`); the order
  `["unit 1 notes.md", "unit 1 cards.md", "unit-2/", "problem-set-1.md",
  "vectors.md"]`, the subtab carried with its parent.
- The deck tab: `problem set 1`'s deck lens with its two cards and `2 due`,
  one pane tab. The source tab: `unit-2` opened, `eigenvalues` in the
  reader under it. ⌘⌥↑ → `unit-2`, ⌘⌥↓ → back to `eigenvalues`.
- ⌘⇧[: the rail a strip with `»` and `7`, the page widening into it;
  `state.json` `rails: ["courses/linear-algebra.md"]`.
- Fixed from the captures: the pane tab cut the label at 220 px
  (`linear algebra › problem…`); a notebook's tab now has 340 px.

### Not verified

- The 340 px pane tab (CSS after the run). A real pointer drag on the rail,
  and ⌘⇧[ / ⌘⌥↑↓ typed rather than dispatched.
- A folder tab deleted leaves its pane on "no longer in the collection"
  (only a document's `gone` sends the tab back); subtab folds are not kept.

### Handoff prompt

```
Read PLAN.md, FORMAT.md, BUILD-LOG.md, and spec/hashiyah/HANDOFF.md.
Milestones 0–31 are ticked (13 dropped). Milestone 32, "Decks — a browser,
cards edited in place, and studying one deck", is being built on a branch
in a separate worktree; merge it by hand when it lands (smoke.ts and the
vault.ts dispatch both gained a mode, PLAN and BUILD-LOG an entry each;
keep both, count the ``` fences), run its `ILMI_SMOKE=decks` and 31's
`ILMI_SMOKE=tabs` in the window after the merge, and tick 32. If the
window is hidden the webview's timers stop: keep it in front, or touch a
CSS file every 2 s while the smoke runs. If port 1420 is held by a run
that is not yours, do not kill it. Suite 587 (31 files) before 32's
tests, `cargo test` 12, and typecheck must be green before a commit.
```

---

## 2026-10-28 — milestone 30: nesting, anything under anything, in an order you choose

Done on main; commit `9ff9791` — *nesting: anything under anything, in an
order you choose*. Files: `src/vault/order.ts` (new), `src/vault/vault.ts`
(`order`, `setOrder`, `place`, the order followed by rename / move / remove,
`dropIfEmpty`, the named PDF carried), `src/vault/paths.ts` (`rekey` maps a
children directory), `src/vault/index.ts`, `src/app/vault.ts` (`placeNode`,
`sortByName`, `openDir`, the `order` event, the `nest` dispatch),
`src/app/store.ts` (`order`), `src/app/names.ts` (`moveTargets`,
`descendants`, `titleOf` for a children directory), `src/app/NodeMenu.tsx`,
`src/app/Tree.tsx`, `src/app/Lenses.tsx` (`FolderLens`),
`src/app/Inspector.tsx` (the `children` line), `src/app/app.css`,
`src/plugins/runtime.ts`, `src/app/smoke.ts` (`smokeNest`), `FORMAT.md`
§1 and §6.3, `README.md`, the corpus `courses/linear-algebra.md` with
`linear-algebra/` (a deck, a draft, `unit-2/eigenvalues.md`), and the tests.

### Done

- A document's children directory holds anything. FORMAT §1 says so (any
  node, to any depth; a move or rename takes the children directory and the
  pages along) and §6.3 that a backref is not rewritten by a move. The
  corpus course has a deck, a draft, and a folder among its children.
- The tree: the middle third of any row is `into` (a folder, or a document,
  its children directory made on demand and its row opening), the top and
  bottom thirds before and after; the root row only into. The folder lens's
  rows take the same drags. `move to…` lists the root, folders, and
  documents, indented by depth, without the node, its subtree, or where it
  already is. The menu's `new …`, `import a file…`, and the intake on a
  document row land inside the document. A document's children open as a
  folder lens (the inspector's `children` line, or ⌥-click on the chevron),
  whose empty space has the document's own menu. Deleting a node with
  something under it asks (`delete with 4 inside?`, a second click).
  Moving a document carries its children, its stem PDF (it did already),
  and a sibling its `pdf` field names (new); a children directory left
  empty by a move or delete is removed, a plain folder is not.
- Order: `.ilmi/order.json`, `{ "<dir>": ["name.md", "sub/"] }`. A
  before/after drop writes the directory's whole list as shown; names not
  listed follow in the walk's order; stale names are dropped on the next
  write; renames, moves, and deletes through the app update it, a parent's
  rename re-keying its children's list; a hand edit of the file is picked
  up by the watcher. `sort by name` (shown when a directory has an order)
  clears it. The tree and the folder lens draw by it; the palette, the
  queue, and the session do not read it.

### Verified

- `npx vitest run`: 569 tests, 30 files (540 before; the new corpus files'
  round trips, the nesting and order tests in `vault.test.ts`, the drag and
  `move to…` tests in `tree.test.ts`, the inside-a-document tests in
  `node-menu.test.ts`). `npm run typecheck` clean. `cargo test` 12.

### Window check

Port 1420 was free. `ILMI_SMOKE=nest` (`mode-run.sh nest`): `done`, every
capture read and each shows the ilmi window.

- `german` dragged to the middle of `james-pluralistic-ch4`: accepted, lit
  `drop-into`; `books/james-pluralistic-ch4/` made and the deck drawn
  under the source, the queue's rows now reading
  `books/james-pluralistic-ch4/german`.
- `papers/archive` into `spaced composition`: drawn under the draft with
  its chevron; the queue reads `essays/spaced-composition/archive/sutton-2019`.
- The course's three children reordered by top-third drops (`drop-before`
  lit): `unit-2/, problem set 1, vectors` → `vectors, unit-2, problem set
  1` → `vectors, problem set 1, unit-2`, the file reading
  `{ "courses/linear-algebra": ["vectors.md", "problem-set-1.md", "unit-2/"] }`.
- The children lens: `linear algebra`, crumb `inside source`, the rows in
  the same order; the course's inspector shows `children 3 items`.
- The course renamed inline to `linear algebra I`: its children moved on
  disk, the tab followed, the file re-keyed to `courses/linear algebra I`.
- `move to…` for the deck: the collection, folders, and documents nested
  by depth (10 / 22 / 34 / 46 / 58 px). Delete on the course reads
  `delete with 4 inside?` in red and nothing was deleted.

### Not verified

- A real pointer drag: the smoke dispatches dragstart / dragover / drop on
  the rows; WebKit's own drag with a mouse, its drag image, and the thirds
  under a real pointer are for a person.
- The folder lens takes drops on its rows only, not on its empty space.

### Handoff prompt

```
Read PLAN.md, FORMAT.md, BUILD-LOG.md, and spec/hashiyah/HANDOFF.md.
Milestones 0–30 are ticked (13 dropped). Do milestone 31, "Tabs — a
document's children as tabs beside the page", and only that: a `tabs: true`
front-matter field (FORMAT §3, round-trip test, the corpus course
`courses/linear-algebra.md` from 30), the tab rail on the left of the
reader in 30's order (`.ilmi/order.json`, `src/vault/order.ts`,
`Vault.place` for reorder and nest, `childrenAt` for a document's
children), subtabs folded by a chevron, `+ tab`, the node menu on rail
rows, `show as tabs` / `show as tree`, the queue and palette landing on a
tab, ⌘⌥↑ / ⌘⌥↓, and `ILMI_SMOKE=tabs`. Stop at its "done when", tick it,
write notes under it, add an entry here with a fresh handoff prompt, and
commit. Window captures: `screencapture -l <id>` of the ilmi window (see
the 2026-10-28 entries). If port 1420 is held by a run that is not yours,
do not kill it. Suite 569 (30 files), `cargo test` 12, and typecheck must
be green before a commit.
```

---

## 2026-10-28 — the window checks of 27, 28, and 29; collection, not vault; one menu order

Done on main after 29, with the user's answers to 28's two questions:
"collection, not vault" and Open Recent "should leave out a vault that's
already opened". Commits: `62ed44b` (every on-screen "vault" is
"collection": the welcome's buttons and keys, the root row's tag, the top
strip's fallback, "no longer in the collection", the Tweaks line, the
palette's group, the clipper's note; the code's names, the plugin API's
`ilmi.vault`, and the link parameter `vault=` are unchanged so plugins and
saved links keep working; `recentRows(recents, open)` leaves the open
collection out and the menu is rebuilt when the open collection changes,
with a test) and the commit carrying this entry (the right-click menu and
the sidebar's `+` share one order, source, deck, draft, folder, and one
label for the intake, `add from text or a link`, also the palette's).

### Window checks

The user's own dev run had held port 1420; it was free this time. The
capture loop now takes the ilmi window by its window id
(`screencapture -l`, the id from a CoreGraphics listing of the process's
windows titled `… · ilmi`), so the captures show ilmi even while the
user's own windows are in front, and the loop polls the log instead of
piping `tail -F` (the old pipe never ended after `done`).

- `ILMI_SMOKE=use` (28): `done`. The queue's first rows read `BIDIR
  german`, `Q&A essays/marginalia — on slow reading`, `WRITE
  essays/spaced-composition`, `READ papers/crick-1995`, in mono, lower
  case, by eye; the tweak flips them to titles and back. The sidebar's
  empty space (40 px under the last row) and the heading both open the
  root menu; Escape and an outside press close it; a hover over `move to…`
  opens nothing and a click lists the folders; the pointer leaving keeps
  it; `◂ move to…` steps back; a right-click at y 780 places the menu with
  its bottom at 782 of 788. `close collection` leaves the welcome with the
  recents; `recent:<path>` reopens with the tree. Only the first capture
  showed ilmi (the user's windows were in front); the log carries the rest.
- `ILMI_SMOKE=land` (29): `done`, every capture read. The PDF on the
  essays row landed as `essays/two-pages.md` with its `.pdf` and opened;
  the EPUB on the reader landed as `papers/The Small Book/` (three
  chapters) and opened its first, the notice reading `placed · The Small
  Book · 3 chapters in papers/  undo  open  ×` at the reader's bottom
  right; undo took the folder away; `import…` with the picker stubbed
  landed the book in `essays/`; a pasted Wikipedia address with nothing
  focused was clipped (3,784 words) into `essays/`; the folder lens's row
  menu and its empty-space menu (`delete folder`, the folder's own) are
  the tree's; the sidebar's `+` opens under the root row.
- `ILMI_SMOKE=blocks` (27): `done`, captures read: the bullets, the
  ticked task box in the accent with its text dimmed, the numbered list,
  the quote's rule with three lines, the code block in mono with its `js`
  tag, "After the list." / "After the quote." paragraphs where ⏎ ⏎ and
  ⌘⏎ left the blocks. 27's owed look is closed.

### Not verified

- A real Finder drag (the OS drop and the row light): a drag cannot be
  faked from a script; the smoke drives the router through its dev hook.
- ⌘V from the keyboard with nothing focused: the smoke dispatches a paste
  event; whether WebKit fires one for a real ⌘V with no focused field is
  unproven.
- The File menu clicked by hand and its shortcuts; Open Recent's rows
  without the open collection (the test covers the rows).

### Handoff prompt

```
Read PLAN.md, FORMAT.md, BUILD-LOG.md, and spec/hashiyah/HANDOFF.md.
Every milestone in PLAN.md is ticked (0–29; 13 dropped) and the window
checks through 29 are recorded. What only a person can check: a Finder
drag onto a sidebar folder, a folder-lens row, and the reader; ⌘V with a
link and nothing focused (if WebKit sends no paste event, add a ⌘V key
handler that reads the clipboard); the File menu by hand. Then ask the
user what is next: the polish list under "Notes for the next session" in
PLAN.md, the plugin directory they set aside, or something new, and write
it into PLAN.md as a milestone with a "done when" before building. The
on-screen word is "collection" (the user's choice); the code keeps
`vault`. Window captures: `screencapture -l <id>` of the ilmi window, so
the user's windows in front do not matter. If port 1420 is held by a run
that is not yours, do not kill it. Suite 540 (30 files), `cargo test` 12,
and typecheck must be green before a commit.
```

---

## 2026-10-20 — milestone 29: one menu everywhere, and a file lands where you drop it

Done on main; commit `461918b` — *one menu everywhere, and a file lands where
you drop it: the shared node menu in the tree and the folder lens, the
window's one drop router landing files in the folder under the pointer with
an undoable notice, File → Import…, a pasted link clipped, the sidebar's +;
the land smoke*. Files: `src/app/NodeMenu.tsx` (new), `src/app/land.ts`
(new), `src/app/Notice.tsx` (new), `src/app/Tree.tsx`, `src/app/Lenses.tsx`
(`FolderLens`), `src/app/Intake.tsx`, `src/app/Welcome.tsx`, `src/app/
App.tsx`, `src/app/menu.ts`, `src/app/Palette.tsx`, `src/app/store.ts`
(`notice`, `fileOver`, `intakeFiles`), `src/app/vault.ts` (the resets, the
dispatch line), `src/app/app.css`, `src-tauri/src/lib.rs` (`Import…`),
`src/app/smoke.ts` (`smokeLand`), `README.md`, `src/app/__tests__/
drop.test.ts` (new), `src/app/__tests__/node-menu.test.ts` (new),
`src/app/__tests__/menu.test.ts`, `src/app/__tests__/tree.test.ts`.

### Done

- One context menu. `NodeMenu.tsx` holds what the tree's menu was (new
  source / folder / deck / draft, `add a source`, rename, `move to…` on a
  click, delete, Escape and an outside press, `MENU_W` and `placeMenu`)
  plus `import a file…`; the tree and the folder lens both render it. In
  the folder lens a right-click on a row opens that row's menu, anywhere
  else in the lens the folder's own (the one its row has in the tree; the
  root's for the vault's lens), new items land in the folder shown and are
  renamed inline in their row, and `rename` is inline there too. The
  lens's `+` buttons stay; `+ source` opens the intake for the folder, and
  the menu's `new source` still makes an empty source.
- A file lands where you drop it. `land.ts` keeps the window's one
  `onDragDropEvent` subscriber (`listenForDrops`, from `App`) and routes
  each event: while no vault is open, to the welcome; over the intake's
  panel, to the intake (which hears every event with whether it is
  `here`, so its veil follows the pointer); anywhere else the row under
  the pointer (`[data-path]`, on the tree's and the folder lens's rows) is
  lit through the store's `fileOver`, and a drop lands in `dropTarget(hit,
  active tab)`: a folder row's folder, a document row's folder, else the
  active tab's folder (a folder tab, a document's folder), the root for
  the queue, the intake, a session, or no tab. Several files land one
  after another. `decide(kind, parsed)` lands a PDF (the pair), an EPUB
  (its chapters in a folder named for the book), a `.md` / `.txt` that
  reads as under two cards, an HTML file (prose), and an `.apkg` with one
  deck, each with the intake's defaults, then opens it; text that reads as
  cards and a package with several decks are queued in `intakeFiles` and
  the intake opens for the folder, reading them in one at a time once it
  is empty. A notice (`Notice.tsx`, over the bottom strip's right end)
  says what landed and where (`placed · The Small Book · 3 chapters in
  papers/`) with `undo` and `open`; undo removes the folders the landing
  made (`newFolders`: the topmost folder per file that was not there
  before) whole and the other files through `removeNode` (a document's
  pages and children go with it), and logs `undone · …`. Every notice is
  also a line in the queue's log. The intake's own drop works as before.
- Import. File → `Import…` (⌘⇧O, id `import`) between Open Recent and
  Close Collection; `runMenu('import')` → `importFiles()`: the native
  picker over the intake's extensions, several files allowed, landing in
  the active tab's folder as a drop does. The palette has `import…`, and
  the menu `import a file…` into its folder.
- Paste a link. A document `paste` listener: with a vault open, the
  palette shut, and the target and the focus outside any input, textarea,
  select, contenteditable, or `.ProseMirror`, an `http(s)` address is
  clipped (24's path, `importClipNode` with the page's fields and images)
  into the active tab's folder and opened, with the notice (`clipped · …`);
  offline it is a notice (`nothing readable at that link`) and nothing is
  written. Text that is not an address is let be.
- The sidebar's `+`, on the root row beside the vault's name: the same
  menu ordered new source / deck / draft / folder, `import a file…`, `add
  from text or a link`, into the selected folder row, else the root.
- README: the drop, Import… ⌘⇧O, ⌘V, the `+`, the shared menu. Smoke:
  `ILMI_SMOKE=land` written.
- Tests: 539 (+33), 30 files (+2); cargo 12, no warnings.

### Verified

- `npm run typecheck` clean, `npx vitest run` green (30 files, 539),
  `cd src-tauri && cargo check` clean with no warnings and `cargo test`
  12. In jsdom with real React roots: a row's menu the same in the tree
  and the folder lens; the lens's empty space opening the folder's own
  menu, `new deck` there calling the vault for that folder and the new
  row showing its rename field with the name selected; the root lens's
  menu without rename or delete; rename from the row's menu inline in the
  lens, ⏎ committing it; a subfolder row's `import a file…`, `add a
  source`, and `new source` all aimed at that subfolder; `+ source`
  opening the intake; the rows' `data-path`s and the row lit by
  `fileOver`; the sidebar's `+` for the root, a selected folder, and the
  root again with a document selected. With the readers and writers
  stubbed: the target for a folder row, the root row, a document row, and
  elsewhere (a document tab, a folder tab, the root, the queue, the
  intake, no tab); `hitAt` over tree and lens rows; land or ask per kind
  (pdf, epub, md, txt, html, apkg with one and two decks, text with 0, 1,
  2 cards); each landing's write and line; refusals in the intake's words;
  the epub's undo removing its folder alone and a pdf's its document;
  three files with one asking (two landed and opened, the ask queued and
  the intake open for the folder, the last notice's undo, the log); a
  file that cannot be read noticed while the next lands; the router to
  the welcome with no vault, to the intake over its panel with no row
  lit, and the lit row cleared on leave; the paste ignored in an editor
  and with no vault, taken on the body into the open document's folder
  and opened, offline a notice and nothing written. The menu: the
  `import` id and its dispatch. `cargo check` compiles the new item.

### Not verified

- Nothing in the window: port 1420 was held by the user's own `npm run
  tauri dev` for the whole session, so `ILMI_SMOKE=land` was written and
  not run. Unseen: a real Finder drag (Tauri's position in physical
  pixels, divided by `devicePixelRatio` as the intake always did), the row
  lighting as the pointer moves, a tree row's own HTML drag beside the
  router (a drop with no paths lands nothing), the notice's look and place,
  `Import…` / ⌘⇧O on the real menu bar and the multi-select picker, and
  whether WebKit fires `paste` on the body for ⌘V with nothing focused (it
  does in Chromium; if WKWebView does not, a ⌘V keydown with a clipboard
  read is the fallback).

### Not done / open

- Several files: each opens in turn and each has a notice, but only the
  last notice's undo is held. A second asking file waits for the intake to
  empty, with no line saying so.
- A document row's folder can be a document's children directory (`a/`
  beside `a.md`); a file dropped on such a row lands as that document's
  child.
- The intake's own `pick a file →` reads one file into the intake as
  before rather than landing it.
- The folder lens's empty-space menu has the folder's rename, `move to…`,
  and delete (it is the folder's own menu); deleting the folder shown
  leaves the lens on `no longer in the vault`.

### Decisions worth knowing

- One subscriber, routes registered: the welcome and the intake register a
  handler in `dropRoutes` instead of subscribing, so a drop is handled
  once and the order is the router's (welcome, then intake, then rows).
- The `+` is on the root row, which is the vault's name; the sidebar's
  `workspace` heading stays a heading, and the `+` lives in `Tree` beside
  the selection it reads.
- `+ source` opens the intake rather than the picker: the intake takes a
  paste, a link, a drop, or a pick, so it is the whole add flow for a
  folder; `import a file…` is the picker.

### Handoff prompt

```
Read PLAN.md, FORMAT.md, BUILD-LOG.md, and spec/hashiyah/HANDOFF.md.
Every milestone in PLAN.md is ticked (0–29; 13 dropped). There is no
first unchecked milestone. If the window is yours (port 1420 free, the
screen unlocked), run `ILMI_SMOKE=land`, `ILMI_SMOKE=use`, and
`ILMI_SMOKE=blocks` on scratch copies of the corpus vault (copy
`src/import/__tests__/epub/three-chapters.epub` into it for `land`) and
read their captures by eye; then by hand drag a PDF and an EPUB from the
Finder onto a sidebar folder, a folder-lens row, and the reader, watch the
row light, try `undo` and `open` on the notice, press ⌘V with a link on
the clipboard and nothing focused, and try the File menu (the five items,
⌘⇧N ⌘O ⌘⇧O ⌘⇧W, Open Recent filling in). Fix what they show and record it
under 29's, 28's, and 27's entries. Then ask the user what is next: one
word (vault or collection), the polish list under "Notes for the next
session" in PLAN.md, the plugin directory they set aside, or something
new, and write it into PLAN.md as a milestone with a "done when" before
building. Tooling and verification are as the ground rules and the entries
below describe. If port 1420 is held by a run that is not yours, do not
kill it. Suite 539 (30 files), `cargo test` 12, and typecheck must be
green before a commit.
```

---

## 2026-10-19 — milestone 28: from use, the path in the queue, a context menu that works anywhere, a File menu

Done on main; commit `74243da` — *from use: the queue row names its file by its
path, the sidebar's menu opens anywhere in it and `move to…` on a click, a
File menu with the collection commands and Open Recent; the use smoke*.
Files: `src/app/items.ts` (`pathLabel`, `sourceLabel`'s `by`), `src/app/
Queue.tsx`, `src/app/queue.css`, `src/app/store.ts` (`queueTitles`),
`src/app/Tweaks.tsx`, `src/app/Tree.tsx` (the sidebar listener,
`placeMenu`, the click), `src/app/Lenses.tsx`, `src/app/menu.ts` (new),
`src/app/App.tsx`, `src/app/Palette.tsx`, `src-tauri/src/lib.rs` (the
File menu, the `menu` event, `set_recent_vaults`), `src/app/smoke.ts`
(`smokeUse`; the deck and welcome smokes), `src/app/vault.ts` (the
dispatch line), `README.md`, `src/app/__tests__/items.test.ts`,
`src/app/__tests__/tree.test.ts` (new), `src/app/__tests__/menu.test.ts`
(new).

### Done

- The queue row's source line is the kind tag and then the item's
  vault-relative path without its `.md`, the folders kept
  (`sources/attention`), in the line's mono at its size, read as written
  (the uppercase the line had is turned off for the path; the tag and
  `new` keep their caps); a card's section still follows after the dash.
  `sourceLabel(item, docs, by)` is the one place, `by` defaulting to
  `title`, so the session's source line, its tab, and the inspector keep
  the document's name. A tweak, `queue shows titles` (default off, kept
  with the other tweaks in the webview's storage), brings the old line
  back.
- The sidebar's context menu opens from a right-click anywhere in the
  sidebar: the `workspace` heading, the empty space under the rows, the
  saved queries. The tree's box ends at its last row, so `Tree.tsx` puts
  a native `contextmenu` listener on the nearest `.side` (its own box
  when there is none) that ignores a `.trow` and the menu itself and
  opens the root's menu, new items landing at the root and `add a
  source` into it; a row's own menu is unchanged. Escape and an outside
  press already closed it (kept, tested); the menu now also stays inside
  the window at the bottom edge (`placeMenu`, a layout effect on the menu
  state in the tree and the deck lens), as `MENU_W` keeps it at the
  right.
- `move to…` opens its list on a click in the tree and in the deck lens;
  nothing opens on `mouseenter` any more, and the pointer leaving the
  list no longer closes it (`onMouseLeave` on `.sub-wrap` gone): the list
  closes with the menu, on a choice, or from `◂ move to…`.
- A File menu in the native menu bar between `ilmi` and Edit: `New
  Collection…` ⌘⇧N, `Open Collection…` ⌘O, `Open Recent` (a submenu of
  the recents by name, newest first, rebuilt from the renderer whenever
  the recents change through the `set_recent_vaults` command; disabled
  when empty), a separator, `Close Collection` ⌘⇧W (⌘W stays the tab;
  `App.tsx`'s ⌘W now ignores shift). On Windows and Linux the same File
  (with a separator and Quit after) heads File, Edit, Window, set there
  too. Every item's id reaches the webview as one `menu` event
  (`Builder::on_menu_event` + `Emitter::emit`); `src/app/menu.ts`
  listens once (`listenForMenu`, from `App` beside `listenForClips`,
  guarded outside Tauri) and `runMenu(id, fx)` dispatches: Open → the
  folder picker then the vault; New → the parent picker, then the open
  vault closed with its tabs and the welcome's name field (a dismissed
  picker leaves the vault open); Close → the welcome; `recent:<path>` →
  `openVault(path)`. `menuAction(id)` is the pure half. The palette's
  three commands (`open collection…`, `new collection…`, `close
  collection`) carry the menu's ids and go through `runMenu`, and the
  recents are already its `vaults` group, so every item has a path
  without the native menu.
- README: the menu and its keys, the sidebar right-click, the tweak, the
  queue row. Smoke: `ILMI_SMOKE=use` written; the deck smoke clicks `move
  to…`; the welcome smoke runs `close collection`.
- Tests: 506 (+13), 28 files (+2); cargo 12, no warnings.

### Verified

- `npm run typecheck` clean, `npx vitest run` green (28 files, 506),
  `cd src-tauri && cargo check` clean with no warnings and `cargo test`
  12: the path label with and without `.md`, by path and by title and by
  default, a card's section after either; in jsdom with a real React root
  under a `.side` as `App.tsx` lays it out, the root's menu from the
  sidebar's empty space (`defaultPrevented`, the five entries, the x kept)
  and from the heading, a row's own with rename / `move to…` / delete and
  one menu at a time, `move to…` not opening on `mouseover` or
  `mouseenter` and opening on a click with the folders listed, the list
  surviving `mouseleave` and `mouseout`, `◂ move to…` back, Escape closing
  it with the list open, an outside mousedown closing it and one inside
  not, the right edge (`MENU_W`) and the bottom edge (a stubbed rect,
  the top moved up); the menu ids (`new`, `open`, `close`,
  `recent:<path>` with a colon in the path, the empties and strangers
  null) and the dispatch with the pickers stubbed (Open → `pickVault`;
  New → `pickVaultParent` then `closeVault`, nothing more when
  dismissed; Close; Recent → `openVault(path)`; a stranger does
  nothing), the recents as rows.
- `cargo check` compiles the menu: `MenuItemBuilder::with_id(...).
  accelerator(...)`, `SubmenuBuilder::with_id(...).enabled(false)`,
  `MenuBuilder::new(app).item(&app_menu).items(&[&file, &edit,
  &window])`, `Builder::on_menu_event`, `AppHandle::menu()` →
  `Menu::get("file")` → `Submenu::get("recent")` → `items` / `remove` /
  `append` / `set_enabled` (Tauri runs each on the main thread).

### Not verified

- Nothing in the window: port 1420 was held by the user's own `npm run
  tauri dev` for the whole session, so `ILMI_SMOKE=use` was written and
  not run. Unseen: the path line at 10px mono beside the uppercase tag;
  the real menu bar with its four items and shortcuts; Open Recent
  filling in at launch and after a vault opens (the command runs against
  `app.menu()`, which is set in `setup` before the webview's first
  `invoke`, so it should be there); ⌘⇧N / ⌘O / ⌘⇧W taken by the menu and
  not by the webview; the sidebar's right-click with the real layout
  (the listener is on `.side`, which the test reproduces); the menu
  shifted at the real bottom edge. The Windows and Linux branch (`quit`
  after a separator, no app menu) is written under `cfg` and not
  compiled here.

### Not done / open

- One word for it: the menu and the palette say collection (the user's
  word, the spec's), the welcome, its foot, the README, and every other
  string say vault. The user's to choose; then a sweep.
- Open Recent lists every recent including the open vault (the palette's
  `vaults` group leaves the open one out); choosing the open one closes
  and reopens it.
- A right-click on a saved query row opens the root's menu (it is in the
  sidebar and is not a tree row); harmless, possibly surprising.
- On Windows and Linux a menu bar now shows where there was none.

### Decisions worth knowing

- The handler moved up, not the tree down: the saved queries sit under
  the tree, and a tree filling the sidebar's height would have pinned
  them to the bottom. A native listener on the nearest `.side` keeps
  `App.tsx` untouched and lets a test mount the tree under a bare
  `.side`.
- Open Recent is dynamic rather than one `Open Recent…` item: Tauri's
  `Submenu::items` / `remove` / `append` are cheap and main-threaded, and
  the recents are already a store field, so one subscription keeps the
  submenu in step. If it misbehaves in the window, the fallback is the
  single item opening the palette on `vaults`.
- The palette's commands carry the menu's ids (`open`, `new`, `close`)
  and call `runMenu`, so there is one dispatch and the smoke can drive
  the menu's path (`runMenu('recent:<path>')`) without the native menu.

### Handoff prompt

```
Read PLAN.md, FORMAT.md, BUILD-LOG.md, and spec/hashiyah/HANDOFF.md.
Every milestone in PLAN.md is ticked (0–28; 13 dropped). There is no
first unchecked milestone. If the window is yours (port 1420 free, the
screen unlocked), run `ILMI_SMOKE=use` on a scratch copy of the corpus
vault and read its captures by eye: the queue's path line, the sidebar
menu from the empty space, `move to…` on a click, the welcome after
`close collection`, the tree back; then try the File menu by hand (the
four items, ⌘⇧N ⌘O ⌘⇧W, Open Recent filling in). Run `ILMI_SMOKE=blocks`
too; 27's look is still unseen. Fix what they show and record it under
28's and 27's entries. Then ask the user what is next: one word (vault or
collection) across the welcome, the menu, and the palette, the polish
list under "Notes for the next session" in PLAN.md, the plugin directory
they set aside, tables edited in place, or something new, and write it
into PLAN.md as a milestone with a "done when" before building. Tooling
and verification are as the ground rules and the entries below describe.
If port 1420 is held by a run that is not yours, do not kill it. Suite
506 (28 files), `cargo test` 12, and typecheck must be green before a
commit.
```

---

## 2026-10-18 — milestone 27: live blocks, lists, quotes, and code edited as themselves

Done on main; commit `05d9ead` — *live blocks: fenced code, lists, and quotes
edited as themselves through a lossless pair, the fence, the markers, and
the `> ` kept as attributes; the blocks smoke*. Files: `src/reader/
schema.ts` (`code_block`, `list` / `list_item`, `quote` / `quote_line`,
`langOf`, `indentWidth`), `src/reader/raw.ts` (new: `rawToNode`,
`nodeToRaw`, `isRawNode`, `itemLines`, the marker helpers),
`src/reader/convert.ts` (through the pair both ways), `src/reader/
plugins.ts` (`continueBlock`, `leaveBlock`, `joinBlock`, `indentBlock`,
`outdentBlock`, `toggleTask`, `taskRule`, `Mod-Enter`, `isCode`),
`src/reader/cards.ts` (`passage` over nested textblocks), `src/reader/
index.ts`, `src/app/Reader.tsx` (`ListItemView`), `src/app/reader.css`,
`src/app/smoke.ts` (`smokeBlocks`; `render`'s list click moved to the
table), `src/app/vault.ts` (the dispatch line), `README.md`,
`src/reader/__tests__/raw.test.ts` (new), `src/app/__tests__/reader-view.
test.ts`, `src/reader/__tests__/reader.test.ts`.

### Done

- A fenced code block is a `code_block` node: the lines between the
  fences are its text, edited in mono in place, ⏎ a newline, Tab two
  spaces, ⌘⏎ out to a paragraph after it; the opening fence line (with
  its info string) and the closing line are attributes and are written
  back as they were, a fence that never closed staying open. Nothing is
  drawn inside it: no markers, no chips, no marks, no heading rule.
  Indented code stays raw.
- A list is a `list` of `list_item` textblocks, flat, every item line an
  item with its own indentation and marker (`- `, `* `, `+ `, `1. `, `1)
  `, with the whitespace after it as written) and a task box character
  when it starts with `[ ] ` or `[x] `; nesting is read from the
  indentation and drawn as such. ⏎ at the end of an item makes the next
  with the same bullet or the number one up (the items after it moved on
  where they had fallen behind), in the middle splits it, on an empty
  item leaves the list to a paragraph; Tab and ⇧Tab move the items the
  selection touches in and out by the item's own marker width; Backspace
  at an item's start takes its box, then joins it into the item before,
  the first item of all becoming a paragraph before the list. The task
  box is drawn beside the marker, ticks on a click, and writes `[x]` or
  `[ ]`; `[ ] ` typed at an item's start becomes a box. Inline Markdown
  and math in an item follow 26 and 25.
- A quote is a `quote` of `quote_line` textblocks, the `> ` kept per line
  (`''` on a lazy line); ⏎ continues it with the same prefix, ⏎ on an
  empty line leaves it, Backspace at the first line's start steps out
  with the text.
- `rawToNode` is lossless by construction: it hands a node back only when
  `nodeToRaw` returns the text byte for byte, so a table, a rule, an HTML
  block, a comment, indented code, an empty fence, or a list with a lazy
  continuation stays a raw atom drawn as in 25. The format is unchanged.
- An extract or a card from a selection inside an item or a line takes
  the text without its marker; across items, one paragraph each.
- README: the rendering paragraph. Smoke: `ILMI_SMOKE=blocks`.
- Tests: 493 (+22), 26 files; cargo 12.

### Verified

- `npm run typecheck` clean, `npx vitest run` green (26 files, 493),
  `cargo test` 12: every raw block in the corpus (vault and mangled), in
  the fixture book's chapters, and in the clipped pages through the pair
  and back byte for byte, or kept as an atom, and through `toDoc` /
  `fromDoc`; the shapes read (a fence with its info string and close, an
  unterminated one, tilde and longer fences, an indented fence, items
  with indentation, marker, box, and continuation lines, a lazy or
  tab-indented continuation refused, a quote line by line); typing in a
  code block with ⏎, Tab, nothing drawn, `# ` not a heading, ⌘⏎ out, the
  fence as it was and the file reading one block; ⏎ at the end of an
  ordered item (`4. `), in the middle (`2. t` / `3. wo`, the rest moved
  on), on an empty item (out to a paragraph), a bullet list continuing
  with its bullet, an item's markers following the caret; the task box
  drawn, toggled from a mousedown and written, an unticked box after ⏎,
  Backspace taking the box then joining, the first item leaving as a
  paragraph, a frozen box staying, `[x] ` typed at the start becoming a
  box and `[ ] ` elsewhere staying text; Tab and ⇧Tab by the marker's
  width (2 for `- `, 3 for `1. `), down to none, two items at once, Tab
  in a paragraph not taken, the written list read back the same; the
  quote continued and left, its markers following the caret, the first
  line stepping out, an empty middle line splitting the quote, a lazy
  line continuing with the prefix before it; the passage over an item
  without its marker, across three items, from a paragraph into the
  list, a quote line, a code block's text.
- In the window, `ILMI_SMOKE=blocks` on a scratch copy of the corpus
  vault, one run to `done`: the sampler opened with two lists of `•@0`
  items, two quote lines, the code block `js` / `language-js`, the table
  the only atom; thawed, ⏎ at the end of the third item taken and `a
  fourth, typed live` written as line 13 (`- a fourth, typed live`), Tab
  → `  - a fourth, typed live` with the item at indent 2, ⇧Tab back; ⏎
  then `[ ] ` typed → a box drawn (`☐0`), `a task` → `- [ ] a task`, the
  box clicked → `☐1` and `- [x] a task` in the file; ⏎ after it → a new
  item with an empty box, ⏎ again → out of the list, `After the list.` a
  paragraph two lines under `- [x] a task`; the quote: ⏎ at the end of
  the second line and typing → three lines, `> A third line, typed
  live.` in the file, ⏎ ⏎ → out, `After the quote.` a paragraph after a
  blank; the code block: ⏎, Tab, `return *due*;` → `  return *due*;` as
  line 30 between the fences, nothing drawn inside, ⌘⏎ taken → `After
  the code.` after the closing fence; the file at the end 12 blocks, 5
  raw, no diagnostics, the reader showing 12. The captures were not of
  ilmi: the first shows the Mac's lock screen (the webview's timers
  stalled about two hours there and resumed on unlock), the other three
  another application's window covering ilmi, a sliver of the inspector
  and the code block's `js` label behind it. The Mac was in use, so the
  smoke was not run again over it.

### Not done / open

- The look in the window (the captures above): the bullets' column, the
  numbers, the task box and its tick, the quote's rule, the code label,
  the indent step. Run `ILMI_SMOKE=blocks` first next session when the
  window and the screen are free.
- Tables and HTML blocks stay as in 25: drawn, source on focus, not
  edited in place.
- A block nested inside an item or a quote (a fence, a heading, `> -
  item`) is text on that line; a quote's wrapped paragraph reads as
  lines; a fence with nothing between its lines stays raw; no code block
  is made in place (type the fence and the file re-reads it); ordered
  items are renumbered only on ⏎, and `1. 1. 1.` becomes `1. 2. 3.`
  then; Tab indents by the item's own marker width; a Shift-⏎ line in an
  item is a continuation line, a blank one splits the block on re-read;
  no colouring in code; Backspace at a code block's start joins it into
  the paragraph before, as a heading does.

### Decisions worth knowing

- The list is flat: every item line is an item with its own `indent`,
  nesting is a matter of drawing. A tree would have had to be rebuilt on
  every Tab and kept lossless against indentation the file already has;
  the flat model makes Tab an attribute change and the write-back a line
  per item.
- Losslessness is enforced, not trusted: `rawToNode` verifies itself
  through `nodeToRaw` and returns null otherwise, so the fixed point the
  "done when" asks for holds for any raw block, not only the corpus's.
  The corpus-wide test then checks the shapes and that enough convert.
- Markers, fences, and `> ` are attributes, so the caret never lands in
  them and `passage` takes an item's text without its marker for free;
  the inline marker rule of 26 applies to items and lines unchanged, and
  a code block is skipped by one `isCode` check in five places.
- Enter on an empty item leaves to a paragraph in the right place (after,
  before, or between the halves) rather than lifting through ProseMirror's
  list commands, which are not installed and would not keep the attrs.

### Window check, second run (after the hand-back, `af9a9db`)

`ILMI_SMOKE=blocks` run once more by the parent session with the screen
unlocked and the port free: clean to `done`, every write as the first
run had it (the bullet list continued, indented, outdented, the task box
typed and ticked, the list left; the quote continued and left; the code
block typed into with ⏎ and Tab, nothing drawn inside, ⌘⏎ out; 12
blocks, 5 raw, 0 diagnostics). The four captures were again covered by
another application's window the user was working in, with only the
inspector and a sliver of the page visible, so the look of the drawn
blocks (bullet column, numbers, task box and tick, quote rule, code
label, indent step) is still unseen by eye and stays an open item for a
moment when the window can be left in front.

### Handoff prompt

```
Read PLAN.md, FORMAT.md, BUILD-LOG.md, and spec/hashiyah/HANDOFF.md.
Every milestone in PLAN.md is ticked (0–27; 13 dropped). There is no
first unchecked milestone. If the window is yours and the screen is
unlocked, run `ILMI_SMOKE=blocks` on a scratch copy of the corpus vault
and read its captures by eye: the look of the live list, task box,
quote, and code block is the one check still unseen. Then ask the user
what is next: the polish list under "Notes for the next session" in
PLAN.md, the plugin directory they set aside, tables edited in place, or
something new, and write it into PLAN.md as a milestone with a "done
when" before building. Tooling and verification are as the ground rules
and the entries below describe. If port 1420 is held by a run that is
not yours, do not kill it. Suite 493 (26 files), `cargo test` 12, and
typecheck must be green before a commit.
```

---

## 2026-10-18 — milestone 26: live inline, markers around the caret, math edited in place

Done on main; commit `9c21047` — *live inline: markers shown only around the
caret and revealed before a backspace takes them, a formula edited in a
field under its chip*. Files: `src/reader/plugins.ts` (the marks plugin
redone over `{ set, edge }`, `mathEdit`, `openMath`, `revealBackward` /
`revealForward`, `editMath` removed), `src/reader/index.ts`,
`src/app/Reader.tsx` (`MathView` with its editor, `handleClickOn` /
`handleClick` as exported functions), `src/app/reader.css`,
`src/app/smoke.ts` (`rangeIn` / `caret`, `smokeLive`), `src/app/vault.ts`
(the dispatch line), `README.md`, `src/app/__tests__/reader-view.test.ts`,
`src/reader/__tests__/reader.test.ts`.

### Done

- Markers follow the caret: a range's `*`, `**`, `` ` ``, `[`, `](href)`,
  `![`, `](src)` show (dimmed, as before) only while the selection
  overlaps the range or a collapsed caret sits at an edge the plugin
  keeps — the range just typed closed, or the one a backspace revealed —
  and are hidden everywhere else, on editable and frozen documents alike.
  A selection change redraws the markers of the paragraphs that lost and
  gained the caret, not the document. Backspace (and forward delete) into
  a hidden marker reveals it without deleting; the next press is the
  browser's. Typing `*word*` lights as the closing `*` lands.
- Math stays rendered: a click on a chip, or ⏎ with it selected, opens a
  field under it set as the palette, holding the TeX between the dollars,
  mono, growing with its content; the chip is redrawn on every keystroke
  that parses, KaTeX's message sits quietly under the field when one does
  not and the chip stays as it was; ⏎ or a click outside writes the text
  in one transaction (one write through the reader's debounce), Escape
  puts the chip back and writes nothing, ⇧⏎ breaks a line in `$$` only,
  an arrow at the field's end leaves to that side of the chip. `$$` is
  kept as the span had it; an empty field removes the chip; a span the
  format would not read as math becomes plain text. Blanks inside math
  are plain TeX in the field. The faces, the deck, and the queue still
  hide every marker.
- README: the rendering paragraph says so. Smoke: `ILMI_SMOKE=live`.
- Tests: 471 (+11), 25 files; cargo 12.

### Verified

- `npm run typecheck` clean, `npx vitest run` green (25 files, 471),
  `cargo test` 12: markers shown only for the range under the caret and
  hidden elsewhere (the sampler's ten, two pairs at a time), the caret
  moving between two emphasised spans and between two paragraphs, a
  selection across two spans showing both, a caret moved to a span's
  edge keeping it rendered, Backspace and Delete into a hidden marker
  revealing it with the text unchanged and declining once shown, typing
  `*word*` lighting as it closes and settling after a space, every marker
  hidden on a frozen document and still hidden when thawed with the caret
  elsewhere, the selection-to-source mapping over hidden markers still
  yielding `is *very* important`; the editor opening from the click
  handler with the span's TeX and taking the focus, re-rendering on input
  with `data-tex` unchanged until ⏎, one doc-changing transaction on ⏎ and
  the caret after the chip, none on Escape with the chip restored, the
  KaTeX message under the field with the chip untouched until the TeX
  parses, ⏎ on a selected chip opening it, `$$` kept with a `\\` line
  break, ⇧⏎ refused in `$…$`, ←/→ at the field's ends leaving before or
  after, a mousedown outside writing, an empty field removing the chip, a
  leading space making text, a frozen document opening nothing; the
  state-level chip-editing position following an insert before it and
  clearing when the chip goes.
- Not in the window: port 1420 was held for the whole session by a run
  that was not this one (a `target/debug/ilmi` two hours old, with its
  vite), left alone as the ground rules say; the single-instance door
  would have handed a second launch to that window anyway. `ILMI_SMOKE=
  live` and its screenshots are owed, with what only a browser shows: a
  real click's focus landing in the field, the editor's width and place
  under an inline chip near the right edge, `execCommand('insertText')`
  reaching ProseMirror as typing.

### Not done / open

- The window check (above).
- The kickoff's "maxwell's inline formula" is a card's (`^cmx-area`), not
  prose; the smoke edits the binomial display chip, the only chip in
  maxwell's prose.
- Undo after ⏎ restores the chip's text in one step but the editor does
  not reopen; a rebuild of the view (the file changed under us) drops an
  open editor's unwritten TeX; a range straddling a math chip is still
  not found (per text node, as in 25).
- For 27: list, quote, and code nodes get the marker rule while their
  items are textblocks of text nodes; a code block should skip it (a node
  type check in `markDecorations` and `redrawMarkers`).

### Decisions worth knowing

- Typora's rule, not Obsidian's: a caret put at a span's edge by a move
  keeps it rendered; only a span the caret just typed closed, or one a
  backspace asked for, shows its markers from the edge. That is what
  makes "backspace reveals first" a real step rather than a side effect,
  and the plugin keeps the edge with the caret position that earned it so
  a jump to the other edge does not keep it.
- Escape writes nothing: the plan's bullet had it writing, its "done
  when" did not; the "done when" was followed.
- The editor lives in the node view but is driven by plugin state (a
  position and a node decoration), so a click, ⏎, and the tests all open
  it the same way and a doc change moves it along; the view never
  dispatches from inside `update`.
- Marker decorations carry a spec so a block's can be found and replaced
  on their own; everything else in the set stands across a selection
  change.

### Window check (after the hand-back, `3af0d4e`)

Three runs of `ILMI_SMOKE=live` once the user's own window was stopped
with their say-so; the first two stopped on the smoke (a prose-chip
selector, then the sampler's surface taken for maxwell's before the tab
had changed), both fixed in the smoke. The third ran through the markers
and the editor: frozen, 12 markers all hidden; thawed with the caret
elsewhere, still hidden; the caret inside *emphasis* → its two `*` shown
at 8px, `**strong**` → both `**`, the code span → both backticks, the
link → `[` and `](https://commonmark.org/)`, the rest hidden; the caret
after the span → hidden again; backspace into the hidden `*` → taken,
the markers shown, the text unchanged; the second backspace left to the
browser; the closing `*` deleted and the em gone from the file, retyped
and back; ` *live` typed with no markers shown until the closing `*`,
then `*live*` lit and written. Maxwell thawed, the binomial chip
clicked → the editor under it (440×75, focused) with the TeX; `+ 1`
typed → the chip re-rendered with it; a broken macro → the error line
under the field, the chip keeping the good render; ⏎ → the editor
closed, one line changed in the file (`+ 1` in the formula); the editor
reopened and Escape → closed, the file unchanged. Not seen: the arrow
key leaving the field (the smoke's chip reference went stale after the
file rewrite; the behaviour is unit-tested). Captures read: the sampler
with the caret in `strong` and only its `**` showing, dimmed; maxwell
with the chip highlighted and the TeX field beneath it. One thing seen
for the open items: the caret inside an inline image's alt shows no
markers, since the image range is treated as an atom there.

### Handoff prompt

```
Read PLAN.md, FORMAT.md, BUILD-LOG.md, and spec/hashiyah/HANDOFF.md.
Milestones 0–26 are ticked (13 dropped); 26's window check is recorded
under its entry. The first unchecked milestone is 27, "Live blocks",
under "## Live editing" in PLAN.md. Do only that one, stop at its "done
when", tick it, write notes, add an entry here with a fresh handoff
prompt, and commit. Tooling and verification are as the ground rules
and the entries below describe; `export
PATH=$HOME/.cargo/bin:/opt/homebrew/bin:$PATH` first. If port 1420 is
held by a run that is not yours, do not kill it: say so in your report
and leave the window check owed. Suite 471 (25 files), `cargo test` 12,
and typecheck must be green before a commit.
```

---

## 2026-10-18 — milestone 25: rendering, the reader shows Markdown as Markdown

Done on the branch `worktree-agent-a2df4fefff0acc940` (worktree
`.claude/worktrees/agent-a2df4fefff0acc940`) while milestone 21 ran on
main and 24 on another branch; commit `c574193` — *rendering: inline Markdown
and raw blocks drawn as themselves in the reader, the faces, the rows;
images from the vault and the web; a markdown sampler in the corpus*. The
sessions are likely to share `PLAN.md`, `BUILD-LOG.md`, `README.md` (the
`⌘,` line, a paragraph after the EPUB one), `src/app/smoke.ts` (the header
comment, the function appended at the end), `src/app/vault.ts` (the one
import line and the mode map in `openInitialVault`), `src/app/Tweaks.tsx`
(the header comment, a row under `reopen the last vault on start`),
`src/app/store.ts` (the `Tweaks` type and its load/save, `AppState`, the
initial state, the setters), `src/vault/__tests__/vault.test.ts` (the
document list), `src/app/Reader.tsx` (the imports, `richHTML` and what is
around it, the node views, the editor effect, the frozen effect, a
`handleClick` prop), `src/app/__tests__/reader-view.test.ts` (the imports
and the `mount` helper), `src/app/Queue.tsx` (the imports, `Body`), and
`src/app/reader.css` (a block before the editorial marks), so the merge
touches those by hand. New files, no conflict: `src/reader/inline.ts`,
`src/reader/blocks.ts`, `src/app/images.ts`,
`src/format/__tests__/corpus/vault/fleeting/markdown-sampler.md` and
`markdown-sampler/mark.png`. `src/app/CardText.tsx` is rewritten.

### Done

- `src/reader/inline.ts`: `inlineRanges` over raw text (emphasis, strong,
  code, link, image; nested; flanking rules reduced), `markerRanges`,
  `imageOnly`, `literalSpans`. `src/reader/blocks.ts`: `classifyRaw` (code
  with its language, lists with nested lines, quotes, GFM tables with
  alignment, rules), `splitBlocks`.
- Plugins: the marks plugin decorates inline Markdown (`md-*` classes, the
  markers `md-mark`, `hidden` when frozen, recomputed on `frozenKey`), and
  an images plugin resolves `![alt](src)` through `StateOptions.images`
  into widgets (`img.md-img`, `md-img-slot[data-state]`), the image-only
  paragraph a `dd-img` figure with the alt as caption.
- App: `images.ts` (vault files as blob URLs through `fs.readBytes`,
  released on unmount; remote addresses behind the toggle); `Reader.tsx`
  draws raw blocks as `ul`/`ol`/`blockquote`/`pre code.language-*`/
  `table`/`hr` inside the atom with the source behind for while it is
  selected, keeps HTML blocks and comments mono, opens a link on ⌘-click,
  and `richHTML` applies the same inline rules to the deck's rows, the
  queue's rows, and the session faces (`CardText`, `Queue`'s `Body`).
- Tweaks: `show remote images`, default on, kept with the other tweaks.
- Corpus: `fleeting/markdown-sampler.md` (frozen, no card, no `read:`)
  and its PNG; the document-list test lists it; the queue counts stand.
- README: the `⌘,` line, a paragraph on the rendering. Smoke:
  `ILMI_SMOKE=render`, written on the branch, not run.
- Tests: 420 (+21), 22 files.

### Verified

- `npm run typecheck` clean, `npx vitest run` green (22 files, 420):
  every inline form and block form from the sampler checked in the DOM
  (markers dimmed, hidden when frozen and back when thawed; the list a
  `ul`, the code a `pre code.language-js`, the table a `table` with its
  alignment, the image an `img` with the alt from a loader), a drawn
  block's source while selected, a broken image as its alt in mono, a
  remote one kept by the toggle, selection-to-source mapping over
  `*very*` yielding the raw text with its markers, the EPUB fixture's
  first chapter drawn, `richHTML` / `clozeHTML` / `cardHTML` with inline
  code and emphasis, `imagePath`.
- Not in the window: the window and port 1420 belonged to the other
  session, and no Rust changed. `ILMI_SMOKE=render` and the screenshots
  are owed, and with them the three things only a browser shows: the
  hidden markers' width, a blob URL drawing in WKWebView, and whether
  `window.open` hands a link to the system browser.

### Not done / open

- The window check (above).
- ⌘-click on a link uses `window.open`; if the webview swallows it, 24's
  `opener` plugin is the switch, in `openLink`.
- Emphasis spanning a math chip is not found (ranges are per text node);
  three mixed delimiters follow the simple rule; `[text]` without `(href)`
  is a note as before; a task list's `[ ]` is text; a `language-*` class
  is set and nothing colours code yet.
- A drawn raw block is still not editable in place; the queue's reading
  snippet and 19's `[figure: alt]` marks are untouched; copied text from
  a face carries the hidden markers.

### Decisions worth knowing

- Decorations, not a schema change: the paragraph's text stays the source,
  so the caret, the selection, `passage`, extracts, and cards are as they
  were; the markers are dimmed by class and hidden with `font-size: 0`,
  still in the DOM.
- `richHTML` hides its markers outright: the deck's rows, the queue, and
  the faces have no caret to keep honest.
- Raw blocks stay atoms; what changed is the node view. An HTML block or a
  comment is still mono, since drawing HTML from a file is a different
  decision.
- The images plugin never dispatches inside the view's construction (it
  would re-enter `updateState`); loads land later, one dispatch each.
- No dependency added: the inline parser and the block shapes are the
  project's own, a few hundred lines, so the format's rules and the
  reader's agree by construction.

### Window check (after the merge, `a5ae07d`)

Three runs of `ILMI_SMOKE=render`; the third clean, port 1420 free after.
The first two stopped on the smoke itself (a `select` helper that read
only the paragraph's first text node, now split over decorated spans; a
paragraph reference held across the extract that redrew it), both fixed
in the smoke. As logged: the sampler with 2 em, 2 strong, 2 code spans,
the link, 18 markers hidden at 0px while frozen and 8px on the dim colour
once thawed; the list, list, quote, code (`language-js`), and table drawn
(ul with 6 li, ol, blockquote, table 3×2), 0 mono blocks; both vault
images loaded from blob URLs; the list clicked → selected, its source
shown; an emphasised passage extracted with its markers in the extract's
text; a card with inline code made from the composer, drawn in the reader
and on the session's faces (markers hidden, the code span intact), the
blank revealed; the fixture book's first chapter with em, strong, list,
and quote drawn; `show remote images` turned off and stored. Captures
read: the sampler page (emphasis, strong, code, link, the inline mark,
both lists, the quote, the code block, the table). Not seen: the queue
row's inline code (the smoke's row selector found nothing; the row itself
was not read). Two things the first clipped page showed were fixed here:
`![](…)` with an empty alt drew nothing (the widget was skipped with the
empty inner span; now placed first) and `[^1]` lit as an editorial note
(excluded from the mark rule); an inline image also shows its alt beside
the picture, which reads doubled, left as an open item.

### Handoff prompt

```
Read PLAN.md, FORMAT.md, BUILD-LOG.md, and spec/hashiyah/HANDOFF.md.
Every milestone in PLAN.md is ticked (0–25; 13 dropped). Milestones 21–25
were done on main and on branches, merged, and their window checks are
recorded under their entries here, with the fixes those checks forced.
There is no first unchecked milestone. Ask the user whether the next
thing is the polish pass over the open items listed under "Notes for the
next session" in PLAN.md (the dictionary popover's height and anchor, an
inline image's alt shown twice, the queue row's inline code unverified,
`.html` drops still on the old pass, media for Anki and EPUB, the SM18
collection and their own `.apkg` / `.epub` / web pages), the plugin
directory they set aside, or something new; then write it into PLAN.md
as a milestone with a "done when" before building. Tooling and
verification are as the ground rules and the entries below describe. If
port 1420 is held by a run that is not yours, do not kill it. Suite 460
(25 files), `cargo test` 12, and typecheck must be green before a commit.
```

---

## 2026-10-18 — milestone 24: clipping, a pasted link lands as the clipper would write it

Done on the branch `worktree-agent-a6748a2448940aba8` (worktree
`.claude/worktrees/agent-a6748a2448940aba8`) while milestone 21 ran on
main; commit `ca68507` — *clipping: a pasted link read by Defuddle and
landed as the clipper writes it, with url, author, and published fields,
the images beside the file, and the address a link in the inspector*. The
sessions are likely to share `PLAN.md`, `BUILD-LOG.md`, `README.md`,
`package.json` / `package-lock.json`, `src/app/smoke.ts` (the header
comment, `smokeClipping` before `smokePlugins`), `src/app/vault.ts` (the
smoke import and dispatch line only), `src/app/store.ts` (the `Tweaks`
type and its load/save, `clipImages` in `AppState`, the setter),
`src/app/Tweaks.tsx` (the header comment, one hook, a row under the
reopen row), `src/app/Inspector.tsx` (an import, four helpers after
`words`, three rows after `imported`), `src-tauri/Cargo.toml` /
`Cargo.lock`, `src-tauri/src/lib.rs` (one `.plugin` line), and
`src-tauri/capabilities/default.json` (the description and one
permission), so the merge touches those by hand. Also changed here, less
likely to meet 21: `FORMAT.md`, `src/format/model.ts`,
`src/format/frontmatter.ts`, `src/format/__tests__/format.test.ts`,
`src/vault/vault.ts`, `src/vault/index.ts`,
`src/vault/__tests__/vault.test.ts`, `src/import/index.ts`,
`src/app/fetch.ts`, `src/app/Intake.tsx`, `src/app/clipper.ts`,
`src/app/app.css`, `src/app/chrome.css`. New files, no conflict:
`src/import/page.ts`, `src/app/clipping.ts`,
`src/import/__tests__/clip-page.test.ts`,
`src/import/__tests__/long-selectors.ts`,
`src/import/__tests__/pages/{article,worksheet,syntax}.html`,
`src/format/__tests__/corpus/vault/fleeting/clipped-page.md`.

### Done

- `src/import/page.ts`: `clipPage` (Defuddle 0.19.5, core bundle,
  `new Defuddle(doc, { url, useAsync: false }).parse()`; its metadata,
  its content HTML through the walker), `markdownOf` (links, emphasis,
  code spans and fences with the language, GFM tables, lists, quotes,
  MathML and `\(…\)` as `$…$`, images, footnotes under `## notes`),
  `escapeProse` (`{ {`, the whitespace off a ` :: `, `\?`, ` \^id`,
  `<!- -`), `normalizeWhen`; the fallback through Readability or the
  whole body into the same walker.
- Format: `url`, `author`, `published` (FORMAT.md §3, `model.ts`,
  `frontmatter.ts`, `meta()`); the corpus file; §1 says a document's
  folder may hold its images and the walk ignores them.
- Vault: `ImportSpec.url/author/published` written by `importDoc`;
  `attachImages` with an injected getter, `imageExt`.
- App: `fetchReadable` returns the page's fields and images;
  `fetchImage`; `clipping.ts` `importClipNode`; the intake's `.page-meta`
  line, the image count and `via …` in the stats, the fields on place;
  the inspector's `url` link (opener plugin), `author`, `published`;
  the `download images when clipping` tweak; `ilmi://new?url=` writes
  the same fields and lands the images, and keeps `url` when a selection
  is the content (closing 22's open item).
- Rust: `tauri-plugin-opener`, `opener:default`. npm: `defuddle`,
  `@tauri-apps/plugin-opener`.
- README: the clipping paragraph, the `ilmi://` paragraph, the tweaks
  line, the layout line. Smoke: `ILMI_SMOKE=clipping`, written, not run.
- Tests: vitest 415 (+16), 23 files; cargo 12.

### Verified

- `npm run typecheck` clean, `npx vitest run` green (23 files, 415),
  `cargo test` green (12, the opener plugin compiled in), `vite build`
  builds with Defuddle bundled.
- The three fixture pages under jsdom (with the selector shim): the
  article's chrome gone (nav, byline, related list, footer, the title
  heading), every field read, the Markdown pinned line for line and
  parsed with no diagnostics and no card; the worksheet falling back;
  every card mark in the syntax page escaped.
- Not in the window: the window and port 1420 belonged to the other
  session. `ILMI_SMOKE=clipping` and its three shots are owed, after a
  Rust rebuild (`npm run tauri dev` does it: the opener plugin is new).

### Not done / open

- The window check: the preview line, the place, the images landing in
  `<stem>/`, the inspector's `url` opening the browser; whether the
  opener's default scope opens an `http(s)` address from the webview
  (the capability has `opener:default`; if the click does nothing, add
  `opener:allow-open-url`).
- A dropped `.html` file still goes through the old `readable()` pass.
- Images are fetched one after another once the file has landed, with no
  cap on count or size; the document shows with remote addresses until
  then. `data:` images are dropped uncounted.
- Defuddle's standardization takes the space before a `::`, so `std ::
  vector` lands as `std:: vector`; a `figcaption` lands as a paragraph;
  a form's labels leak into the whole-body fallback; callouts land as
  paragraphs.

### Decisions worth knowing

- One walker for both passes rather than Defuddle's Markdown: the core
  bundle has no converter, the full one would still need the escapes,
  and a reduction of our own is what the tests can pin line for line.
- The fallback keeps Readability as the finder but feeds the new walker,
  so a fallback page gets links and emphasis too; the plan's "old pass"
  is read as the finder, not the reduction.
- The images are fetched through a getter the vault is handed
  (`ImageGet`), so the landing is tested against `nodeFs` with no http
  plugin, and the app passes the plugin's `fetch`.
- `published` is normalized on the way in (`normalizeWhen`) rather than
  the format learning more date forms; the format keeps its two.
- The jsdom selector limit is worked around in the test harness, not in
  `clipPage`: the webview never hits it, and `clipPage` stays plain.
### Window check (after the merge, `4c0cf0a`)

Four runs of `ILMI_SMOKE=clipping` against Wikipedia's spaced repetition
page, the Rust side rebuilt for the opener plugin. The first found a real
bug: the fetched article was read as 53 cards by milestone 16's comma
rule, the preview showed the card row in place of the page's metadata,
and the page landed as a deck with no images. Fixed in two places: the
intake never runs card detection over a fetched page unless the user asks
with `as cards →`, and the comma and dash rule now also requires the back
to read as a gloss (≤ 120 chars, no sentence inside, no link), with a test
over four article lines and a vocabulary list. The second run placed the
page right: `frozen`, `imported`, `url`, `author: Wikipedia`,
`published: 2001-08-09T02:05:34Z`, 91 blocks, 0 cards, 0 diagnostics,
four images landed as `img-01.png` … `img-04.gif` and the links rewritten
to them, the inspector rows, the `url` click opening the browser. The
reader capture showed the image lines as text, since the folder's name
has a space and Markdown reads no bare space in a destination: the
clipper now percent-encodes each path segment (`Spaced%20repetition/
img-01.png`, decoded by the loader; the clip-page test updated). The
fourth run, after the rendering fix for an empty alt, drew all four
images from blob URLs, and the file with the space in its folder read
back (10,904 bytes). Captures read: the intake preview with
`Wikipedia · Spaced repetition`, the author and date line, `3,784 words ·
91 paragraphs · ~17 min · 4 images · via defuddle`; the reader with the
title, strong text, underlined links, and the inspector's `url`,
`author`, `published`.

### Handoff prompt

```
Read PLAN.md, FORMAT.md, BUILD-LOG.md, and spec/hashiyah/HANDOFF.md.
Milestones 0–20 and 22–24 are ticked (13 dropped). 24 (clipping) was
done on the branch `worktree-agent-a6748a2448940aba8` beside 21 and its
window check is owed: after the merge, rebuild the Rust side (the opener
plugin is new), run `ILMI_VAULT=<scratch> ILMI_SMOKE=clipping npm run
tauri dev` (online; `ILMI_URL=` for another page), read its log (the
preview line, the twenty lines, the images in `<stem>/`, the inspector
rows, the browser opening on the `url` click), take its three shots, and
record them under its entry here. The first unchecked milestone is 21,
"Dictionary", under "## Plugins" in PLAN.md, unless a branch holds it
(`git worktree list`); after it, 25, "Rendering". Do only the first
unchecked milestone no branch holds, stop at its "done when", tick it,
write notes, add an entry here with a fresh handoff prompt, and commit.
Tooling and verification are as the ground rules and the entries below
describe; `export PATH=$HOME/.cargo/bin:/opt/homebrew/bin:$PATH` first.
If port 1420 is held by a run that is not yours, do not kill it: say so
in your report and leave the window check owed. Suite 415 (23 files),
`cargo test` 12, and typecheck must be green before a commit.
```

---

## 2026-10-18 — milestone 21: dictionary, a word looked up from the selection and added to a vocab deck

Commit `6ffabf5` — *dictionary: the first real plugin, `look up` on the cue
(d) through Wiktionary with Arabic clitics stripped, `add to deck` (a)
from the popover, its tests over saved responses, and four handle gaps
closed*. Done on `main` while milestone 24 ran on a branch; the files
shared with it are likely `PLAN.md`, `BUILD-LOG.md`, `README.md` (the
plugins paragraph), `src/app/smoke.ts` (the header comment and the
function appended at the end), and `src/app/vault.ts` (the smoke import
and dispatch line).

### Done

- `plugins/dictionary/`: `plugin.json`, `main.ts` (the pure pieces
  exported — `trimWord`, `bare`, `candidates`, `vocalized`, `languageFor`,
  `requestUrl`, `htmlToText`, `wiktionarySection`, `stringsAt`/`entriesAt`,
  `firstDefinition`, `cardText`, `lookup` — and `activate` with the five
  settings, the `look up` action on `d`, and the popover), `style.css`,
  `__tests__/dictionary.test.ts` with four real responses from
  `en.wiktionary.org/api/rest_v1/page/definition/<word>` (`ذكر`, `كتاب`,
  `memory`, the 404 body for `الذكر`), fetched once with curl while
  building.
- Handle gaps, in `src/plugins/` (api stays 1): `addCard` makes the
  folders on the way to a new deck (`runtime.ts`, `ensureDoc` via
  `vault.folderIn`); keys inside a popover or modal stay inside
  (`surfaces.ts`); a popover is placed again as it grows (`surfaces.ts`,
  `ResizeObserver`); `onPluginAction` in `index.ts`, used by `Reader.tsx`
  and `Pdf.tsx` to put the cue away when a verb runs from its key.
- `scripts/plugins.ts`: `CORPUS_COPY` beside `CORPUS_ON`, so the corpus
  vault carries `.ilmi/plugins/dictionary/` off; `vite.config.ts` runs
  `plugins/**/*.test.ts`; `tsconfig.json` includes `plugins`;
  `src/plugins/__tests__/memfs.ts` holds what the plugin tests share.
- Corpus: `papers/archive/sutton-2019.md` gained one paragraph with an
  Arabic sentence (`الذِّكْرُ يَحْفَظُ العِلْمَ، وَالْكِتَابُ يَحْفَظُ
  الذِّكْرَ.`); no card or document added.
- `PLUGINS.md` (the shipped plugins, the notes on `addCard`, `ui.popover`,
  and tests), README (one sentence), the smoke `ILMI_SMOKE=dictionary`.
- Tests: vitest 419 (+20), 23 files; cargo 12.

### Verified

- `npm run typecheck` clean, `npx vitest run` green (23 files, 419),
  `cargo test` green (12).
- In the window (`ILMI_VAULT=<scratch copy> ILMI_SMOKE=dictionary npm run
  tauri dev`, one run, 14:41 local): the runtime listed `dictionary 0.1.0
  off` beside `hello on`; the toggle turned it on, `plugins.json` became
  `["hello","dictionary"]`, the row showed `dictionary 0.1.0 ilmi · reload
  · on` and the five settings — `dictionary url` (placeholder the
  Wiktionary template), `definitions at` (`wiktionary`), `language` (`by
  script`), `deck` (`vocab`), `context on the back` (`on`) — with
  `data.json {"context":true}` written and the plugin's style on the page.
  The one capture (`dictionary-tweaks`) showed the Mac's lock screen: the
  session was locked, so the window was covered, and the webview's timers
  stalled under the lock — no line after the shot, and the run was cut at
  the 12-minute cap. The screen stayed locked for the twenty minutes waited
  afterwards, so **the lookup, the popover, the add, the queue count, and
  the deck were not seen in the window**; they are exercised in jsdom over
  the saved responses (`dictionary.test.ts`, *in the app*: the article
  stripped, six entries for `ذكر`, `ذِكْر :: to mention` plus the sentence
  in `vocab.md`, the notice, `words/english.md` for `memory`, nothing
  found, offline). Owed to the next session: `ILMI_SMOKE=dictionary` with
  the screen unlocked, its five captures read (`dictionary-tweaks`, `-cue`,
  `-popover`, `-added`, `-english`, `-deck`).
- Also found and fixed on the way: vite's watcher followed the other
  agent's worktree under `.claude/` (a `tsconfig.json` change there forced
  full reloads of the page), so `vite.config.ts` ignores `**/.claude/**`.

### Not done / open

- See the PLAN notes: no cue on a card face or in the deck lens, so no
  `look up` there; the headword's vowels come from the selection, the
  endpoint having none; the first meaning is the card's back, no picking;
  no duplicate check; a custom dictionary's path tested on a synthetic
  response only.

### Decisions worth knowing

- The headword's vowels are the selection's, not the entry's: the REST
  definitions endpoint returns definitions only, and the `form-of`
  mentions inside them name other lemmas, so the article and the case
  ending come off the selected word instead (`الذِّكْرُ` → `ذِكْر`).
- The card's back is the first *meaning*: Wiktionary lists `verbal noun of
  …` and `plural of …` first for many Arabic nouns, and those are marked
  `form-of-definition` in the HTML, so they are skipped for the card and
  dimmed in the popover.
- `context: true` is written to `data.json` on the first activation,
  because a toggle reads the file and would otherwise show `off` while
  the plugin behaved as on.
- A plugin's own tests live beside it and run through the runtime over the
  corpus copy of its *built* bundle, so `npm run plugins` is part of
  changing a plugin; the pure pieces are tested from the source.
- `when` hides `look up` for selections over three words: the cue stays
  a passage's cue, and `d` on a passage keeps its meaning elsewhere.

### Window check (after the merge, `fb3cdc6` on main)

Two runs of `ILMI_SMOKE=dictionary` with the screen unlocked. The first
reached the English step and timed out because the smoke pressed the
cue's first plugin verb, the sample's `hello: count`, not `look up`; the
smoke now picks the verb by name. The second was clean, port 1420 free
after. As logged: the plugin's row off then on, `plugins.json` with both,
the five settings, `data.json {"context":true}`; the cue over
`الذِّكْرُ` reading `extract e | make a card m | hello: count | look up d`
with the sentence as context; `d` → the popover, the cue gone, focus in
the box; the live Wiktionary entry: headword `ذِكْر`, `arabic`, verb (to
mention; to remember, to recall; to bear in mind …), verb (to remind, to
point out), noun (verbal noun of ذَكَرَ; recollection, remembrance;
reputation, renown …), noun, noun, verb; `add to deck` → notice `added to
vocab`, `vocab.md` written as `type: deck` with `ذِكْر :: to mention` and
the sentence on the second line, 0 diagnostics, the queue 37 → 38 with
the card due today; `scaffolding` from the cue's verb → the English
entry (noun: a temporary modular system of tubes …; verb), added as a
second card, queue 39; the deck lens with two rows. Capture read: the
popover over the sutton page with the headword top right, `arabic`, the
numbered senses right-aligned. The popover sat at the top of the pane
rather than under the word, since the entry is taller than the room
below the selection; `add to deck` was below its fold, reached by `a`.
Open item: cap the popover's height and anchor it to the word.

### Handoff prompt

Paste into a fresh session:

```
Read PLAN.md, FORMAT.md, BUILD-LOG.md, and spec/hashiyah/HANDOFF.md.

Context: milestones 0-23 are done. src/plugins/ is the plugin runtime
(api.ts the typed handle, api 1, published as plugins/ilmi.d.ts;
runtime.ts the loader; index.ts the app side; surfaces.ts the popover
and modal). Two plugins ship under plugins/: hello (the sample) and
dictionary (look up on the cue, add to deck from the popover); `npm run
plugins` builds them with esbuild and copies them into the corpus vault
(.ilmi/plugins/, hello on, dictionary off), and a plugin's tests live in
plugins/<id>/__tests__/ over src/plugins/__tests__/memfs.ts. PLUGINS.md
documents the API and the shipped plugins.

Tooling: node is in /opt/homebrew/bin and cargo in ~/.cargo/bin; prefix
every command with export PATH=$HOME/.cargo/bin:/opt/homebrew/bin:$PATH
npx vitest run, npm run typecheck, and cargo test (in src-tauri) must be
green before a commit. For the window, copy the corpus vault to a
scratch directory, run `caffeinate -d -u -i` in the background, then
ILMI_VAULT=<scratch> ILMI_SMOKE=<mode> npm run tauri dev in the
background with a tail loop that screencaptures on `shot: <name>` and
kills the app on `done` or `failed` (lsof -ti:1420 | xargs kill; pkill
-f target/debug/ilmi). The log plugin's lines reach the file about 5 s
late. Milestone 24 may be on a branch waiting to merge; it edits
smoke.ts, vault.ts, the intake, and the build log.

Do the first unchecked milestone in PLAN.md (24, clipping, under
*Clipping and rendering*, unless it has been merged, then 25) and only
that one. Follow the brief's copy rules for every string. Stop at the
milestone's "done when". Then tick it, write notes for the next session
under it, add an entry to BUILD-LOG.md with a fresh handoff prompt, and
commit.
```

---

## 2026-10-18 — milestone 23: opening, a welcome that remembers and the last vault reopened on start

Done on the branch `worktree-agent-a34f19b66a3b6da95` (worktree
`.claude/worktrees/agent-a34f19b66a3b6da95`) while milestone 20 ran on
main; commit `f52d36e` — *opening: a welcome with the vaults opened
before, the newest reopened on start, a new vault with a starter, vault
commands in the palette*. The sessions are likely to share `PLAN.md`,
`BUILD-LOG.md`, `README.md`, `src/app/smoke.ts` (the header comment, the
import line, the function appended at the end), `src/app/vault.ts` (the
import lines, the end of `openVault`, everything between it and the view
section, `openInitialVault` rewritten), `src/app/store.ts` (the `Tweaks`
type and its load/save, the `AppState` fields and the initial state, the
setters), `src/app/Tweaks.tsx` (the header comment, a row under density),
`src/app/Palette.tsx` (the import line, `COMMANDS`, `runCommand`, the
hooks, `run`), `src/app/App.tsx` (the imports, the ⌘K branch, the
`vault === null` branch), `src/app/chrome.ts` (`EntryTag`, `Entry.target`,
`ENTRY_GLYPH`, `buildIndex`), `src/app/app.css` (the welcome block at the
top), `src/app/items.ts` (`agoLabel` after `dueLabel`), and
`src-tauri/capabilities/default.json` (one permission line), so the merge
touches those by hand. New files, no conflict: `src/app/Welcome.tsx`,
`src/app/recents.ts`, `src/app/starter.ts`,
`src/app/__tests__/welcome.test.ts`.

### Done

- `src/app/recents.ts`: `Recent`, `addRecent`, `forgetRecent`,
  `cleanRecents`, `vaultName`, `openedLabel`, `GONE`, `decideStart`.
  `agoLabel` in `items.ts`: `dueLabel`'s words looking back.
- Store: the `reopen` tweak (default on), the `recents` list under
  `ilmi.recents` with the tweaks' load/save pattern, `gone`, `started`,
  `newVaultIn`.
- `vault.ts`: `openVault` remembers the vault and sets the window title;
  `closeVault`, `forgetVault`, `pickVaultParent`, `newVault` (the folder,
  `start here.md` from `starter.ts`, enrolled for reading, opened),
  `probeVaults`, `startFromRecents`; `openInitialVault` runs in release
  and dispatches `ILMI_SMOKE=welcome` before any vault opens.
- `Welcome.tsx` replaces the one button: the palette's panel, the
  wordmark and the README's first sentence, two buttons, the name field,
  the rows with `opened <when>` or `not where it was` and `forget`, the
  keys, a dropped folder.
- Palette: `open vault…`, `new vault…`, `close vault`; recents under
  `vaults`. Tweaks: `reopen the last vault on start`. Title
  `<name> · ilmi`; `core:window:allow-set-title`.
- README: the opening paragraph, the tweaks line, the welcome keys, the
  smoke mode. Smoke: `ILMI_SMOKE=welcome`, written on the branch, run
  after the merge (see *Window check* below).
- Tests: 368 (+14), 21 files.

### Verified

- `npm run typecheck` clean, `npx vitest run` green (21 files, 368),
  `vite build` builds.
- Not in the window: the window and port 1420 belonged to the other
  session, and cargo was not run here. `ILMI_SMOKE=welcome` and the
  screenshots are owed; the capability change means the Rust side must
  be rebuilt first (`npm run tauri dev` does).

### Window check (after the merge, `f4e419f`)

One run, clean, port 1420 free after; the Rust side rebuilt by `tauri
dev` for the title capability. As logged: the welcome with the mark
`ilmi`, the README's line, `open vault` / `new vault`, the foot `↵ open ·
j k move · o open vault · n new vault`; rows `welcome-vault · opened
today` and `gone-vault · not where it was` dimmed; `j` moving the mark
and showing `forget`; ⏎ opening the vault, title `welcome-vault · ilmi`,
the recents stored; the palette's `close vault` → the welcome again;
`new vault` naming in the scratch directory, a bad name refused on the
welcome, then `welcome-smoke-191906` made with `start here.md` (frozen,
imported, enrolled for reading, eight blocks, one card, 0 diagnostics,
queue `read, card`), opened on its first tab; the palette's `vaults`
row switching back; the Tweaks row `reopen the last vault on start`
turned on and stored; `location.reload()`; after the reload the vault
opened itself with no welcome shown. Six captures taken, two read in
full: the welcome panel centred, palette-styled, with the mark and line,
the two buttons, the two rows (the gone one dimmed with `NOT WHERE IT
WAS`), and the keys foot; the new vault open on `start here` with the
window title `welcome-smoke-191906 · ilmi`, the three headings, the q&a
card, and `1 card · 1 due` in the tree. One thing seen for milestone 25:
the starter's `` `e` `` and `` `m` `` show their backticks, since inline
code is not yet rendered.

### Not done / open

- The window check: the welcome's look at the three themes, the drop of
  a folder (a Tauri event, not faked), the picker flows (`o`, `n`), and
  the reload half of the smoke.
- The smoke leaves its `welcome-smoke-<hhmmss>` vault on disk beside the
  scratch vault.
- `new vault…` from the palette closes the open vault before the name is
  typed; esc on the field then leaves the welcome up.
- A reopen that fails for any reason (an unreadable `.ilmi`, not only a
  missing folder) dims the row as gone.
- No key or palette command forgets a recent; only the hover button.

### Decisions worth knowing

- The recents are probed on start by `allow_vault` then `stat`, because a
  remembered path is outside the fs scope until it is let in; eight
  `allow_vault` calls at most, for directories the user chose before.
- Only the newest vault is a candidate to reopen: with the newest gone
  the welcome shows rather than the next one opening unasked.
- The starter is written through `importDoc` (frozen, `imported` today)
  and then enrolled for reading, so the first queue holds a reading
  element and a new card.
- `started` gates the welcome so a vault reopening itself shows no
  welcome first; in the smoke the welcome appears only after
  `startFromRecents` decides.
- ⌘K does nothing on the welcome: the palette is the open vault's, and
  the welcome has its own keys.

### Handoff prompt

```
Read PLAN.md, FORMAT.md, BUILD-LOG.md, and spec/hashiyah/HANDOFF.md.
Milestones 0–20, 22, and 23 are ticked (13 dropped; 22 and 23 were done
on branches and merged, their window checks recorded under them). The
first unchecked milestone is 21, "Dictionary", under "## Plugins" in
PLAN.md; 24, "Clipping", may be running beside it on a branch (check
`git worktree list`), and 25 follows 24. Do only the first unchecked
milestone no branch holds, stop at its "done when", tick it, write
notes, add an entry here with a fresh handoff prompt, and commit.
Tooling and verification are as the ground rules and the entries below
describe; `export PATH=$HOME/.cargo/bin:/opt/homebrew/bin:$PATH` first.
If port 1420 is held by a run that is not yours, do not kill it: say so
in your report and leave the window check owed. Suite 399 (22 files),
`cargo test` 12, and typecheck must be green before a commit. The user's
own `.epub` and `.apkg` are still untried.
```

---

## 2026-10-18 — milestone 20: plugin runtime, the loader, the enable list, the `ilmi` handle, a settings section

Commit `91326a0` — *plugins: a runtime over `.ilmi/plugins/`, the typed `ilmi`
handle (api 1), a tweaks section with a toggle, settings, and `add a
plugin`, the sample plugin, esbuild build, PLUGINS.md*. Done on `main`
beside milestone 23, which runs on a branch and will meet this in
`App.tsx` (untouched here), `store.ts` (untouched), `Tweaks.tsx` (one
import and one `<PluginsSection />` line), `Palette.tsx` (one import, a
`usePlugins()` line, the `commands` memo, the `default:` case),
`vault.ts` (the import, `stopPlugins()` and `startPlugins(vault)` in
`openVault`, the `plugins` smoke entry), and `smoke.ts` (a header
paragraph and `smokePlugins` at the end).

### Done

- `src/plugins/`: `api.ts` (the typed handle, published as
  `plugins/ilmi.d.ts`), `runtime.ts` (`PluginHost`: enable list, scan,
  activate through `new Function` with a `require` that throws, guard,
  fail, teardown, hot reload from the vault's new `hidden` event,
  `install`, settings bound to `data.json`), `context.ts` (the sentence
  around a selection; key specs), `surfaces.ts` (popover and modal as
  plain DOM), `index.ts` (the app's bridge, the key map, what the lenses
  hand over), `CueActions.tsx`, `PluginsSection.tsx`, `plugins.css`.
- The lenses: the reader and the PDF lens publish their selection and
  show the plugins' verbs on the cue; the reader, the deck lens, and the
  session's card faces run the block hooks; the session emits `grade`,
  `read-on`, `worked-on`.
- `src/vault/vault.ts`: `apply` emits `{ kind: 'hidden', paths }` for
  dot-directory paths instead of dropping them.
- Rust: `plugin.rs`, `read_plugin_zip`; 3 tests.
- `plugins/hello/` (the sample), `scripts/plugins.ts` (`npm run plugins`:
  esbuild, a stored zip, the corpus copy, `ilmi.d.ts`), esbuild as a dev
  dependency, `plugins/dist/` ignored, the corpus vault's
  `.ilmi/plugins/hello/` and `.ilmi/plugins.json`.
- `PLUGINS.md`; README lines (layout, keys, the script).
- Tests: vitest 385 (+31), 21 files; cargo 12 (+3).

### Verified

- `npm run typecheck` clean, `npx vitest run` green (21 files, 385),
  `cargo test` green (12).
- In the window (`ILMI_VAULT=<scratch copy> ILMI_SMOKE=plugins
  ILMI_PLUGIN_ZIP=<repo>/plugins/dist/hello.zip npm run tauri dev`, four
  runs, the fourth clean, 14:12 local): `csp none; new Function runs`;
  the row `hello 0.1.0 ilmi · reload · on` under `plugins` and its note;
  off → `plugins.json []`, 0 commands, the style gone; on → back;
  `hello: say hi` found in the palette as a `command` and run → notice
  `hi`; the cue on a wozniak sentence `extract e | make a card m | hello:
  count` → notice `7 words`; a new source with `[hello]` twice → 2 lit
  spans in the reader (background the soft accent) and one in a deck's
  q&a row; the `greeting` field (placeholder `hi`) set to `salaam` →
  `data.json {"greeting":"salaam"}` and the command's notice `salaam`;
  a card graded `3` in the session → notice `hello saw a 3`; `main.js`
  touched on disk → `reloaded · hello`, the setting kept; the folder
  removed → `removed · hello`, 0 rows, 0 commands, the style gone; the
  zip through the section's hook → `added · hello`, the row on, the three
  files, `plugins.json ["hello"]`, the command back; the same zip again →
  `hello 0.1.0 is already here`.
- Seven captures read: tweaks with the section (heading, note, the row
  with `reload` and `on`, `greeting` with placeholder `hi`, `add a
  plugin · from a folder`); the palette filtered to `hello: say hi`
  tagged COMMAND; the cue under the highlighted sentence in §4 with the
  three verbs; `hello test` with both `[hello]` in soft accent boxes;
  the deck lens with `say [hello]` lit in the q&a row and tweaks showing
  `greeting salaam`; the session on the card after the grade; tweaks
  after the zip re-add with the row `on` and the field empty again. No
  capture was covered.
- The first three runs stopped at the lit `[hello]`: the reader's
  animation frame was cancelled by StrictMode's double mount and the
  slot never freed, so the walk never ran; run two also added the
  observer pause, which the hand-run diagnostics in run three showed to
  be needed as well (a hook's span was redrawn away without it).

### Not done / open

- See the PLAN notes: the folder picker, an OS drop, and the `replace`
  row unseen in the window; popover and modal exercised in jsdom only
  until a plugin opens one (21 will); some events wired but not
  exercised in the window; a plugin's DOM change outlives its
  deactivation until the block redraws; the `greeting` row's gap added
  after the captures.

### Decisions worth knowing

- Settings are bound to keys of `data.json` and read by the plugin with
  `store.get`, instead of each control carrying its own value and
  handler: the dictionary reads its four settings at use time, not at
  registration.
- `onBlock` runs once per element per hook until the element's text
  changes, so a hook may see an element it already changed after a
  reload; the sample skips text inside its own class.
- Plugin surfaces are plain DOM, not React, so the runtime's tests open
  them in jsdom and a plugin's own element is appended as it is.
- A failed plugin stays in `plugins.json`: the failure is this session's,
  and the next launch tries again.
- The host's own file writes are ignored by path for 2.5 s rather than
  by content, since the fs adapter's stamps are not readable before the
  watcher's echo.

### Handoff prompt

Paste into a fresh session:

```
Read PLAN.md, FORMAT.md, BUILD-LOG.md, and spec/hashiyah/HANDOFF.md.

Context: milestones 0-20 and 22 are done. src/plugins/ is the plugin
runtime: api.ts is the typed `ilmi` handle (api 1; copied to
plugins/ilmi.d.ts by `npm run plugins`), runtime.ts the loader, index.ts
the app side. A plugin lives in plugins/<id>/ as TypeScript against
../ilmi.js, is built by `npm run plugins` (esbuild → plugins/dist/<id>/
and <id>.zip), and the ones in CORPUS_ON (scripts/plugins.ts) are copied
into the corpus vault's .ilmi/plugins/ with .ilmi/plugins.json. The
sample, plugins/hello/, shows every API: a command, a selection action
(sel.text, sel.context is the sentence around it, sel.rect), a block
hook, a settings builder bound to data.json (read with store.get), and
session.on('grade'). ui.popover(rect, el) returns the box styled as the
palette; key handling inside it is the plugin's. net.fetch goes through
the http plugin, no CORS. vault.addCard(deck, text) creates the deck
when missing. PLUGINS.md documents all of it.

Tooling: node is in /opt/homebrew/bin and cargo in ~/.cargo/bin; prefix
every command with export PATH=$HOME/.cargo/bin:/opt/homebrew/bin:$PATH
npx vitest run, npm run typecheck, and cargo test (in src-tauri) must be
green before a commit. For the window, copy the corpus vault to a
scratch directory, run `caffeinate -d -u -i` in the background, then
ILMI_VAULT=<scratch> ILMI_SMOKE=<mode> npm run tauri dev in the
background with a tail loop that screencaptures on `shot: <name>` and
kills the app on `done` or `failed` (lsof -ti:1420 | xargs kill; pkill
-f target/debug/ilmi). The log plugin's lines reach the file about 5 s
late. Milestone 23 may be running on a branch beside you; it edits
App.tsx, store.ts, Tweaks.tsx, Palette.tsx, vault.ts, smoke.ts.

Do milestone 21 in PLAN.md (the dictionary plugin) and only that one:
plugins/dictionary/, written against the API, with its tests in
src/plugins/__tests__/dictionary.test.ts or beside the plugin as the
plan says; add it to CORPUS_ON only if the smoke needs it on in the
corpus. Fix API gaps in src/plugins/ as you find them and note each.
Follow the brief's copy rules for every string. Stop at the milestone's
"done when". Then tick it, write notes for the next session under it,
add an entry to BUILD-LOG.md with a fresh handoff prompt, and commit.
```

---

## 2026-10-18 — milestone 22: clipper, `ilmi://` opens a door the web clipper can use

Done on the branch `worktree-agent-ad643755f471ccef6` (worktree
`.claude/worktrees/agent-ad643755f471ccef6`) while milestones 19 and 20
ran on main; commit `3a60270` — *clipper: ilmi://new and ilmi://open
through the deep-link plugin, a second launch handed to the running window,
clippings go to a folder set in tweaks*. The sessions are likely to share `PLAN.md`, `BUILD-LOG.md`, `README.md`,
`src/app/smoke.ts`, `src/app/vault.ts` (the smoke dispatch line, the
`openVault` state line, a setter), `src/app/Tweaks.tsx`, `src/app/store.ts`,
`src/vault/vault.ts` (`VaultState`), `src/app/App.tsx` (the mount effect),
`src/app/chrome.css`, `package.json` / `package-lock.json`,
`src-tauri/Cargo.toml` / `Cargo.lock`, `src-tauri/src/lib.rs`,
`src-tauri/tauri.conf.json`, and `src-tauri/capabilities/default.json`, so
the merge touches those by hand.

### Done

- `src/app/clip.ts`: `parseClipUri` reads `ilmi://new?name=&content=&
  folder=&url=&vault=` and `ilmi://open?path=&vault=` (also `file=`) into
  an action, or a refusal whose reason is the notice; folders and paths
  are cleaned so a link never climbs out of the vault; `vaultMatches`,
  `clipTitle`, `openCandidates`, `cleanClipDir`.
- `src/app/clipper.ts`: `handleUri(uri)`, the plain function; a `new` link
  lands a frozen source through the intake's import path (`fetchReadable`
  for an address, `importNode` for the file), opens it, notes `clipped ·
  <title>`; `open` opens a document; a foreign vault, a missing path, and
  garbage are notices; a link before any vault is open is held until one
  is. `listenForClips()` wires `getCurrent` and `onOpenUrl` once.
- The `clippings go to` setting: `clippings` in `.ilmi/state.json`,
  `clipDir` in the store, `setClipDir` in `vault.ts`, a `select` row in
  Tweaks under the budget row.
- Rust: `tauri-plugin-single-instance` (with `deep-link`) first, then
  `tauri-plugin-deep-link`; the `ilmi` scheme in `tauri.conf.json`;
  `register_all` on Windows and Linux; `deep-link:default`,
  `core:window:allow-set-focus`, `core:window:allow-unminimize`.
- npm: `@tauri-apps/plugin-deep-link`. README: the paragraph, the
  bookmarklet, the Obsidian Web Clipper statement, the macOS note; the
  tweaks line in *Keys*; the shell line in *Layout*.
- Smoke: `ILMI_SMOKE=clip`, written on the branch, run after the merge
  (see *Window check* below).
- Tests: 337 (+10), 19 files.

### Verified

- `npm run typecheck` clean, `npx vitest run` green (19 files, 337),
  `vite build` builds, `cargo test` in `src-tauri` green (5) with the two
  plugins compiled in.
- Not in the window: the window and port 1420 belonged to the other
  sessions. `ILMI_SMOKE=clip` and the shell's `open 'ilmi://new?name=t&
  content=hi'` are owed.

### Window check (after the merge, `94262db`)

Two runs. The first ran the smoke twice: Vite reloaded the page once to
pre-bundle the newly installed deep-link package, so a second `clip test`
landed as `clip test 2.md` and the `open` step then timed out waiting on
a title the wozniak file does not have. The smoke now waits on the active
tab's id. The second run was clean, port 1420 free after: `new` with
content → `clip test.md` (frozen, imported, two paragraphs, 0
diagnostics, the tab and h1 `clip test`, notice `clipped · clip test`);
with a folder → `fleeting/web/in a new folder.md`, the folder made; with
`url=https://example.com/` → `Example Domain.md` with the page's text;
`open` with the path → the wozniak tab, without `.md` → maxwell, a
missing path → `nothing at papers/nothing-here`; a foreign vault → `that
link is for the vault someone-else`; the own vault by name → `own
vault.md`; `garbage` → `not an ilmi link`; an empty `new` → `nothing to
clip`; Tweaks `clippings go to` listing the folders, set to `fleeting`,
and the next link landing in `fleeting/to the setting.md`. Three
captures read: the clipped source open with the tree row; the notices
run's end with `own vault` open; Tweaks with the `clippings go to` row
under the budget row. The OS handoff from the shell, `open 'ilmi://new?
…'` with the dev window up, was refused by macOS (`kLSApplicationNotFound
Err`: no application claims the scheme): the dev binary is not a bundle,
so the scheme is registered only when the built app (`npm run tauri
build`) has been launched once. Owed: that build and launch.

### Not done / open

- The window check and the OS-level handoff. On macOS the scheme comes
  from the bundle's Info.plist, which Tauri writes from the config, so the
  dev binary may not own it; if `open 'ilmi://…'` lands nothing, `npm run
  tauri build` and open the built app once, then try again.
- A bookmarklet clip of a selection carries the page's address as `url=`
  but the brief takes `content` *as* the text, so the address is not kept
  in the file; a `url` front-matter field would be a FORMAT.md change.
- A link held before a vault opens lands silently once one does.
- Nothing Rust-side gained a unit test; the plugins are registration only.

### Decisions worth knowing

- The pure parse and the handler are two files (`clip.ts`, `clipper.ts`)
  so `vault.ts` can import `cleanClipDir` without a cycle and the tests
  need no Tauri.
- The verb is read as the URL host or the first path segment, so the
  three spellings a browser or shell may produce all work; the scheme and
  verb are case-insensitive, the parameters are not.
- A `folder=` that does not exist is made (Obsidian's `new` does the
  same); the setting's folder too, since the user chose it.
- The same link twice within two seconds is one link: a launch link can
  arrive both as `getCurrent()` and as the event.
## 2026-10-18 — milestone 19: EPUB, a dropped book lands as a folder of chapter sources in reading order

Commit `57bbc85` — *epub: a dropped book read on the Rust side, its
chapters landing as frozen sources in a folder, in reading order*. Done on
`main` at `dc2067c` (the plan commit that added milestones 20–22 landed
after this session started; a parallel session works on 20 in a worktree
and touches `Cargo.toml`, `lib.rs`, and `package.json` too, so the merge
will meet both sides there).

### Done

- `src-tauri/src/epub.rs` and the `read_epub` command: the zip opened
  with `zip`, `META-INF/container.xml` → the OPF (`quick-xml` 0.42, read
  leniently; entities resolved by hand), its metadata, manifest, and
  spine; the toc from the `nav` item's `<nav epub:type="toc">`, else the
  NCX; hrefs resolved against each document's directory, fragments off,
  percent-escapes decoded; the spine's XHTML items in order with their
  toc title and a `nav` flag; images listed by href.
- `src/import/epub.ts`: `reduceChapter` (the DOM tidied, then the intake's
  own `textOf`: back-references out, `[figure: alt]` where an image with
  alt text stood, `*em*` / `**strong**`), `withoutTitleHeading`,
  `mapBook` (nav skipped, pages under 30 words skipped and counted, the
  title from the toc, else the first heading, else `chapter NN`; `NN
  title` names padded to the count's width), `readingLabel`.
- `ImportSpec.name`; `importBookNode` (a new folder by `createFolder`,
  one `importDoc` per chapter); `readEpub` / `EPUB_EXT`.
- The intake takes `.epub` from a drop and the picker: h1 `Add a book`,
  the creators and the chapter rows where the text would be, the count
  line (`3 chapters · 217 words · ~1 min · 1 short page skipped · 2
  images dropped`) with `not this →`, the title field defaulting to
  `dc:title`; `place & open` writes the folder, one notice, opens the
  first chapter. The hint names `.epub`.
- Fixture: `npm run fixture:epub` (byte-stable). README: a paragraph, the
  script, the layout lines. Smoke: `ILMI_SMOKE=epub` with
  `ILMI_EPUB=<path>`.
- Tests: vitest 344 (+17 in `epub.test.ts`: the fixture's shape, the
  reduction's cases, the title-heading drop, the three chapters line for
  line and parsed with no diagnostics, the wide numbering, the skips,
  the reading label, and the folder written into a scratch vault);
  `cargo test` 9 (+4: the three-chapter book built and read back, an
  EPUB 2 with an NCX and a percent-escaped href, refusals, path
  resolution).

### Verified

- `npm run typecheck` clean, `npx vitest run` green (19 files, 344),
  `cargo test` green (9), no warnings.
- In the window (`ILMI_VAULT=<scratch copy> ILMI_SMOKE=epub
  ILMI_EPUB=<repo>/src/import/__tests__/epub/three-chapters.epub npm run
  tauri dev`, 13:33 local, two runs, both clean), as logged: the book
  dropped through `intakeHooks.ingestFile` → h1 `Add a book`, `A.
  Author`, rows `01 One: the premise (86 words)`, `02 Two: the middle (74
  words)`, `03 Three: the close (57 words)`, the count line `3 chapters ·
  217 words · ~1 min · 1 short page skipped · 2 images dropped · not this
  →`, the title field `The Small Book`, no textarea → `place & open` →
  `The Small Book/01 One the premise.md`, `02 Two the middle.md`, `03
  Three the close.md`, each `frozen: true`, `imported: 2026-10-18`,
  `title: "…"`, 0 diagnostics (blocks `paragraph, paragraph, raw, raw,
  paragraph`; `paragraph ×4` with the figure mark; `paragraph, paragraph,
  heading, paragraph`); the notice `placed · 3 chapters in The Small
  Book`; the intake cleared; the reader on the first chapter with crumb
  `The Small Book`, 5 blocks, `frozen`, `start reading r`; tree rows `The
  Small Book 3` and the three `¶` chapters; `r` → `read: due=2026-10-18
  ivl=1 reps=0 pos=0`, the queries at `due today 38` (one more) and
  `reading 7`; `done`; port 1420 free after.
- Captures read (first run): the intake with `Add a book`, the author in
  mono under it, the three chapter rows in serif with the grey numbers at
  the left and `N words` in mono at the right, the count line with `not
  this →` on the accent, the title field, `lives in`, the two place
  buttons; the reader on `One: the premise` with the chapter's paragraphs
  in serif (the asterisks of `*small wager*` and `**minimum information
  principle**` visible, `afternoon.1` glued), the list and the quote as
  mono raw blocks, the footnote paragraph, the tree with `The Small Book
  3` open over the three chapters, the inspector with the path,
  `imported`, `86 words`, `priority 50`, `frozen THAW`; its top-right
  corner was covered by a notification from another application. The
  reading capture of the first run was covered by another application's
  window; the second run's two later captures were mostly covered too,
  the visible part of the inspector showing `reading 0 of 5, today`,
  `growth 1.6 · 2d · 3d · 5d`, and `38 due` in the strip after `r`.
- Before the run, port 1420 and an ilmi window belonged to a `npm run
  tauri dev` started from this directory at 13:18 with no smoke mode, not
  this session's; after a wait of eight minutes it was stopped to free
  the port, as the ground rules ask. The dev log's `Error Found version
  mismatched Tauri packages` (`tauri-plugin-http` 2.7.0 against
  `@tauri-apps/plugin-http` 2.6.1) predates this work; `Cargo.lock`
  changed by the one `quick-xml` line.

### Not done / open

- The user's own book: none provided. Drop one on the intake, or run
  `ILMI_SMOKE=epub ILMI_EPUB=<path>`.
- The reader shows `*emphasis*` with its asterisks; nothing renders
  Markdown emphasis yet. The plan asked for emphasis kept, and the format
  calls it literal text the app renders as it sees fit, so the rendering
  is a polish item, not a format change.
- A footnote reference's number lands glued to its word (`afternoon.1`);
  the note's text stays as a paragraph where the `aside` was.
- Images are counted, not copied; `linear="no"` items land like the rest;
  the chapter list is not capped; `dc:language` is read and unused.

### Decisions worth knowing

- `quick-xml` over a hand-rolled scanner: it was already in the lock
  through Tauri, and an EPUB's XML is real XML. Read leniently all the
  same, since nav documents carry HTML entities XML does not define.
- The DOM is tidied before `textOf` rather than `textOf` growing options:
  the walker stays the one the pages and the Anki fields use, and the
  book's rules (figures, back-references, emphasis) live in `epub.ts`.
- `createFolder` for the book, not `folderIn`: a second import of the
  same book should not interleave its chapters with the first's.
- The heading is dropped only when it reads as the title with case,
  punctuation, and spacing set aside; `Chapter 1: The premise` under a
  toc entry `Chapter 1` is kept, since the body would lose words.

### Handoff prompt

```
Read PLAN.md, FORMAT.md, BUILD-LOG.md, and spec/hashiyah/HANDOFF.md.
Milestones 0–19 and 22 are ticked (13 dropped); 22 (clipper) was done
on a branch and merged as a merge commit on main; its window check and
the OS-level `open 'ilmi://…'` handoff are recorded under its entry when
run. The first unchecked milestone is 20, "Plugin runtime", under
"## Plugins" in PLAN.md; 23, "Opening", may be running beside it on a
branch (check `git worktree list`). Do only the first unchecked
milestone no branch holds, stop at its "done when", tick it, write
notes, add an entry here with a fresh handoff prompt, and commit.
Tooling and verification are as the ground rules and the entries below
describe; `export PATH=$HOME/.cargo/bin:/opt/homebrew/bin:$PATH` first.
If port 1420 is held by a run that is not yours, do not kill it: say so
in your report and leave the window check owed. Suite 354 (20 files),
`cargo test` 9, and typecheck must be green before a commit. The user's
own `.epub` and `.apkg` are still untried: `ILMI_SMOKE=epub
ILMI_EPUB=<path>` and `ILMI_SMOKE=anki ILMI_APKG=<path>` take them.
```

---

## 2026-10-18 — milestone 18: blanks inside math, `{{cN::…}}` in a formula closed by the balanced `}}`

Done on the branch `worktree-agent-aa0c5ff44353b39cb` (worktree
`.claude/worktrees/agent-aa0c5ff44353b39cb`) while milestone 17 ran on
main; commit `5716742` — *math: a numbered blank inside a formula, closed
by the balanced braces, rendered by KaTeX once per state*. The two sessions share `PLAN.md`, `BUILD-LOG.md`,
`src/app/smoke.ts`, and `src/app/vault.ts` (the smoke dispatch line), so
the merge touches those four by hand.

### Done

- FORMAT.md §5.1: inside `$…$` / `$$…$$` only the numbered form opens a
  blank, closed at the `}}` that balances the braces opened since `::`;
  the unnumbered `{{x}}`, a blank whose braces never balance, and one
  whose answer closes the formula early are TeX. §11's note on the `$$`
  block rewritten.
- `src/format/cloze.ts`: `clozeSegments` (new; `MathSeg` / `CardSeg`
  exported) finds blanks inside math spans; `clozeParts` is its
  flattening, so every caller of `blanks` and the group indices are
  unchanged; a blank inside math carries `math: true`. `mathSpanEnd` is
  untouched.
- `src/app/Reader.tsx`: `mathBlanksHTML` renders a formula with blanks
  once per state through KaTeX (`throwOnError`, `output: 'html'`): hidden
  as `\colorbox` over a `\phantom` of the answer, revealed as `\colorbox`
  over the answer, another group's blank plain; sentinel colours become
  `var(--fg-5)` / `var(--accent-soft)`; an answer is boxed between its
  top-level `&` and `\\` so an `align` line works. The chip carries
  `data-blanks` and `data-revealed`, and `data-tex` only while nothing is
  hidden. `clozeHTML` renders a cloze card, `answerHTML` an answer alone;
  `cardHTML` shows a formula's blanks on the accent in the reader and the
  deck. A refused formula falls back to its source as text.
- `src/app/Session.tsx`: the cloze front is one `clozeHTML` string with
  one click handler; a click on a chip holding this card's blanks
  reveals; the answer face renders a math answer as math.
- `src/app/Composer.tsx`: `⌘B` on a selection inside a formula writes
  `{{cN::…}}` (`insideMath`, `withBlank`).
- Corpus: `vault/papers/maxwell.md`, `mangled/math-blanks.md`. Queue
  counts: upcoming 17 → 20, cards 26 → 29, today 17 unchanged.
- README: a paragraph. Smoke: `ILMI_SMOKE=math`, written on the branch,
  run after the merge (see *Window check* below).
- Tests: 308 (+9).

### Verified

- `npm run typecheck` clean, `npx vitest run` green (17 files, 308),
  `vite build` builds.
- Not in the window: the window and port 1420 belonged to milestone 17's
  session. `ILMI_SMOKE=math` opens maxwell, logs the two chips, walks a
  session over its three blanks (the first revealed by a click on the
  chip, the others by space), grades each, and logs the `sr` lines;
  shots `math-reader`, `math-1-hidden` … `math-3-revealed`. Owed.

### Not done / open

- `m` on a selection inside a math chip is not mapped into the TeX: the
  chip is an atom whose `leafText` is its source, so the composer gets the
  formula and `⌘B` in the textarea makes the blank. How `posAtDOM` lands
  inside KaTeX output is unverified without the window.
- The phantom's glyphs stay in the DOM with `color:transparent`, as a text
  blank's answer does; the TeX source and the MathML are kept out.
- Queue rows, the composer preview, and `CardText` show a math blank as
  text, the `$` and TeX literal around it.
- The box is KaTeX's `\colorbox` padding, tighter than the text blank's.
- `mangled/code-and-math.md`'s `$$` block with `{{c1::x_i}}` reads as a
  card now, on purpose.

### Decisions worth knowing

- The balanced close only inside math. Outside, the first `}}` still
  closes, as §5.1 always said; changing that would move answers in
  existing files.
- One KaTeX run per state rather than a text overlay: an `align` block's
  layout is KaTeX's, and a box placed by CSS over a rendered line would
  not follow it. The sentinel-colour swap is the `trust`-free way to a
  theme colour.
- `clozeParts` kept its shape by flattening the segments, so the
  scheduler, the queue, `numberBlank`, and `ownBlank` did not change.

### Window check (after the merge, `bfcc00d`)

Merged onto milestones 16 and 17 as `bfcc00d` (both sides had appended a
smoke mode, a README paragraph, and a log entry; all kept). Suite 327,
typecheck clean. Then `ILMI_VAULT=<scratch copy> ILMI_SMOKE=math npm run
tauri dev`, one run, clean, port 1420 free after. As logged: the reader
with 6 blocks, 2 cards, two chips with blanks (`data-blanks` 2 and 1,
every blank revealed there, 3 and 1 boxes, display and inline, KaTeX, no
fallback) and 2 prose formulas; the session over 3 blanks: each card
hidden with `data-revealed 0`, one box per own blank (two for the align
line, split at `&=`), no TeX in the face's HTML, the hint shown; revealed
(the first by a click on the chip, the others by space) with the chip at
`data-revealed 1`, the TeX kept, the answer face reading `x2`, `ϵ0 ρ`, and
the curl line; `done, 3 elements`; three `sr` lines rewritten with `g=3`.
Four captures read: the reader with the align block numbered (1)–(4), the
right-hand side of (1) and the whole of (3) on the accent, `x²` boxed
inline, the binomial plain; the session on blank 1 of 2 with a grey box
the size of the fraction in place of (1)'s right-hand side, (2)–(4) plain,
the answer face blurred; the revealed captures were partly covered by
another window, the visible part showing the formula and the grades.

### Handoff prompt

```
Read PLAN.md, FORMAT.md, BUILD-LOG.md, and spec/hashiyah/HANDOFF.md.
Every milestone in PLAN.md is ticked (0–18; 13 dropped). There is no
first unchecked milestone. Ask the user whether the next thing is the
polish pass over the open items listed under "Notes for the next
session" in PLAN.md, their own Anki export through the intake
(`ILMI_SMOKE=anki ILMI_APKG=<path>` or a drop in the window), their
SuperMemo collection through `npm run import-sm`, or something new; then
write it into PLAN.md as a milestone with a "done when" before building.
Tooling and verification are as the ground rules and the entries below
describe. Suite 327 and typecheck must be green before a commit.
```

---

## 2026-10-18 — milestone 17: cards from Anki, a dropped `.apkg` lands as deck files with their progress

Commit `cec823b` — *anki: a dropped .apkg read on the Rust side, each deck
landing as a deck file with its review cards' progress seeded*.

### Done

- `src-tauri/src/anki.rs` and the `read_anki_package` command: the zip
  opened with `zip` (deflate only), the newest collection taken
  (`collection.anki21b` through `zstd`, else `.anki21`, else `.anki2`),
  written to a temporary file and opened read-only with `rusqlite`
  (`bundled`, `collation`; a `unicase` collation registered so Anki's
  schema 18 tables load). Schema 11 is read from the `col` row's JSON,
  schema 18 from `notetypes` / `fields` / `templates` / `decks`, a
  template's question format out of its protobuf `config` blob by a
  schemaless field scanner. Cards come back with their home deck and
  original due when they sit in a filtered deck. The `media` entry is
  classified (`json` / `zstd` / `other` / `none`), not read.
- `src/import/anki.ts`: `creationDay`, `difficultyOf` (2500 → 5, 1300 → 8,
  clamped), `seedOf` for review cards (the SuperMemo seed's shape:
  `due`, `st=review`, `s=ivl`, `d`, `r`, `l`, `ivl`, `last = due − ivl`),
  `kindOf` (basic / reversed / cloze / other), `cardOf` (fields through
  `reduceCell`; a cloze written whole with `sr cN` per group, or the bare
  line for one group; a pair `::`, or `:::` when the reversed note has
  its reverse card, the forward schedule kept, the rest counted; `null`
  when nothing survives), `mapPackage` → decks in name order with
  `Parent::Child` as `Parent/Child.md`, empty decks, other notetypes, and
  the dropped counts. `deckDoc` formats cards with `formatBlock` so the
  schedules ride along; `droppedLabel` takes extra counts.
- `Vault.folderIn`, `importAnkiNode`, `readAnkiPackage` / `APKG_EXT`.
- The intake takes `.apkg` from a drop and the picker: the paste field
  gives way to the deck list (`Languages / German` · `2 cards, 2
  scheduled`), the count line (`4 cards in 2 decks · 1 empty deck skipped
  · 1 hint, 1 sound, 1 image, 1 schedule, 1 empty note dropped`) with
  `not this →`, no title field; `place & open` writes every deck, a notice
  per deck, and opens the first. The hint names `.apkg`.
- Fixture: `npm run fixture:anki` (the Rust test with `ILMI_ANKI_FIXTURE`
  set writes `src/import/__tests__/anki/two-decks.apkg` and
  `two-decks.json`; byte-stable). README: a paragraph, the script, the
  layout lines. Smoke: `ILMI_SMOKE=anki` with `ILMI_APKG=<path>`.
- Tests: vitest 318 (+19 in `anki.test.ts`: the fixture, the creation day,
  the difficulty line, the seed and its line, no line for new / learning /
  relearning, the four notetype kinds, each card shape, the single-group
  bare line, the other-notetype path, HTML / sound / image reduction, the
  multi-line form, the refusals, the whole package to two documents
  checked line for line and parsed with no diagnostics, the empty and
  missing-note cases, and `folderIn` + `importDeck` into a scratch vault);
  `cargo test` 5 (the two-deck package built and read back, the
  compressed collection preferred over the stub, a schema 18 database with
  a filtered-deck card, refusals, the protobuf scanner).

### Verified

- `npm run typecheck` clean, `npx vitest run` green (18 files, 318),
  `cargo test` green (5), no warnings.
- In the window (`ILMI_VAULT=<scratch copy> ILMI_SMOKE=anki
  ILMI_APKG=<repo>/src/import/__tests__/anki/two-decks.apkg npm run tauri
  dev`, 12:33 local, one run, clean), as logged: the package dropped
  through `intakeHooks.ingestFile` → h1 `Add decks`, rows `Languages /
  German (2 cards, 2 scheduled)` and `Science (2 cards, 1 scheduled)`,
  the count line `4 cards in 2 decks · 1 empty deck skipped · 1 hint, 1
  sound, 1 image, 1 schedule, 1 empty note dropped · not this →`, no
  title field, no textarea → `place & open` → `Languages/German.md`:
  `type: deck`, `imported: 2026-10-18`, `What is the capital of France?
  :: Paris` + `<!-- sr due=2026-07-20 st=review s=30 d=5 r=7 l=1 ivl=30
  last=2026-06-20 -->`, `der Vorsatz ::: resolution; intention` + `<!-- sr
  due=2026-05-31 st=review s=45 d=6 r=9 l=0 ivl=45 last=2026-04-16 -->`,
  0 diagnostics; `Science.md`: the cloze with `<!-- sr c1 due=2026-04-11
  st=review s=10 d=8 r=3 l=2 ivl=10 last=2026-04-01 -->` and `Which planet
  is nearest the sun? :: Mercury` bare, 0 diagnostics; notices `placed · 2
  cards in German`, `placed · 2 cards in Science`; the intake cleared; the
  deck lens `German`, `2 cards · 2 due`, two rows; tree rows `Languages 1`
  and `Science 2 · 2 due`; the Science lens with the cloze row selected,
  inspector `type cloze · in Science`.
- Three captures read: the intake with `Add decks`, the two deck rows in
  serif with their mono counts at the right, the count line (wrapped to a
  second line for the dropped phrase, `not this →` in gold at the right),
  `LIVES IN vault …`, both place buttons; the German deck lens with the
  `Q What is the capital of France? / A Paris` row and the `der Vorsatz ⇄
  resolution; intention` row, `2 cards · 2 due`, the inspector's cards
  list reading `OVERDUE 90D` and `OVERDUE 140D`, `Languages 1` and
  `Science 2 · 2 due` in the tree; the Science lens with the cloze's two
  blanks underlined in gold and the row selected, the inspector's card
  editor showing `{{c1::mitochondrion}}` … `{{c2::powerhouse}}`,
  `schedule per blank`, the cards list `mitochondrion OVERDUE 190D` and
  `Which planet is nearest the sun? NEW`. One CSS fix after the captures
  (the deck list's last row drew a rule right above the detail's).
  Port 1420 free afterwards.

### Not done / open

- The user's own export was not tried; none was provided. The "done when"
  clause stays open for them: drop a real `.apkg` on the intake and read
  the deck list and the dropped counts before placing.
- Media is not copied; `[sound:…]` and `<img>` are counted and dropped.
  The `media` form is read and carried in the mapping but not shown.
- Suspended and buried cards (`queue` < 0) import as ordinary cards; the
  format has no suspension. Relearning cards (type 3) get no line.
- Tags are read on the Rust side and dropped silently in the mapping.
- A note whose cards sit in two decks makes one card per deck.
- No per-deck pick on the intake; it is all the decks or `not this →`.
- The count line wraps when many things were dropped.

### Decisions worth knowing

- The fixture is written by the Rust test rather than a `node:sqlite`
  script: the package builder already lived in the test, and the JSON the
  TypeScript tests read is then exactly what the command returns.
- A reversed notetype writes `:::` only when the note has its reverse
  card, so Anki's "Basic (optional reversed card)" without the reverse
  lands one-directional, as Anki has it.
- A single-group cloze's schedule goes on the bare line, FORMAT.md §6.2;
  only a multi-group cloze gets `sr cN` lines.
- `crt` is read at noon rather than midnight so the collection's first
  day does not slip by one across time zones.
- The paste field gives way to the deck list rather than sitting empty
  above it; the intake grows no section.

### Handoff prompt

Paste into a fresh session:

```
Read PLAN.md, FORMAT.md, BUILD-LOG.md, and spec/hashiyah/HANDOFF.md.
Milestones 0–17 are all ticked (17, cards from Anki, BUILD-LOG
2026-10-18); PLAN.md has no unchecked milestone. Do not start a new
feature. With the user, decide what comes next: a polish pass over the
open items the milestone notes record (10: no palette command or key for
priority, no stepper; 11: no growth row before enrolment, the preview
ignores lateness; 12: the sidebar and inspector counts are the whole day
while the strip folds, no key for `postpone the rest`; 13: a due-day
field on the draft's inspector; 14: the user's real SuperMemo collection,
with their say-so; 15: the extracts list under a PDF, editing a card from
the session's faces; 16: the Anki text row fixed to its header; 17: the
user's own .apkg untried, media not copied, suspended cards import as
ordinary ones), the margin-gloss text flow the ground rules keep out of
the plan, or something new. If the user drops a real .apkg, read it with
ILMI_SMOKE=anki ILMI_APKG=<path> or in the window and report the deck list
and the dropped counts. Add any new milestone to PLAN.md before building
it. Copy rules of spec/hashiyah/BUILD-PROMPT.md for every string.

Tooling: export PATH=$HOME/.cargo/bin:/opt/homebrew/bin:$PATH before every
command. npx vitest run (318 tests, 18 files), npm run typecheck, and
cargo test in src-tauri (5) must be green before a commit. Window checks:
copy src/format/__tests__/corpus/vault to a scratch directory, run
caffeinate -d -u -i in the background, then ILMI_VAULT=<copy>
ILMI_SMOKE=<mode> npm run tauri dev with a tail loop that screencaptures
on `shot: <name>` (sleep 2 first) and kills the app on `done` / `failed`;
free port 1420 before and after; do not edit src/ or src-tauri/ while it
runs.
```

---

## 2026-10-18 — milestone 16: cards from text, a list pasted on the intake lands as a deck

Commit `b4724d2` — *cards: a pasted or dropped list split by two
delimiters lands as a deck, an Anki text export read by its header*.

### Done

- `src/import/cards.ts`, exported through `src/import/index.ts`: the two
  delimiters (`SideDelim`: the `Q:`/`A:` prefix pair, a tab, ` :: `, a
  dash, a comma, or a custom string; `CardDelim`: a blank line, a newline,
  a semicolon, or a custom string), `chunksOf`, `splitCards` → `Split`
  (`Found` pairs and clozes, leftovers verbatim, `Dropped` counts, the Anki
  header when there is one), `detect` (every pair, most cards, fewest
  leftover lines, then order; a text without blank lines tries `newline`
  first), `ankiHeader` / `records` / `reduceCell` for Anki's export (the
  separator from the header, the guid / notetype / deck / tags columns out,
  quoted cells read, HTML through the intake's `textOf`, `[sound:…]`,
  `<img>`, and cloze hints dropped and counted), `cardText` (`::` / `:::`,
  the `?` / `??` form for a line break or when the inline form would not
  read back as itself), `toCards`, `deckDoc` (built as text, parsed,
  `type: deck`, leftovers under `## not cards`), `droppedLabel`. A guard
  keeps commas and dashes in sentences from reading as cards (a front over
  80 characters, with sentence punctuation, a tab, ` :: `, or a `Q:`
  prefix is prose).
- `Vault.importDeck(dir, { title, doc, today })` and `importDeckNode`:
  named after the title through `fileName` / `freeName`, `imported` set,
  `title` written when it differs, as `importDoc`.
- The intake: `detect` over the text; at two cards or more the h1 reads
  `Add a deck`, the stats row gives way to the delimiter row (`sides` /
  `cards` / `write`, small mono buttons as the inspector's `default-card`
  row, a `custom` field per row, `one direction` / `both directions`), the
  first three cards as `.card-span` rows through `CardText` (now
  `src/app/CardText.tsx`, shared with the deck lens), the count line
  (`N cards · M lines not cards · … dropped`) with `as a source →`; the
  ordinary stats row carries `as cards →` to summon the row when detection
  found fewer. An Anki export shows `from an anki export, fields split by
  tab` in place of the two delimiter rows. The title defaults to `cards`;
  `place & open` opens the deck lens. `.csv` / `.tsv` join the text
  extensions and the picker.
- README: a paragraph on the cards mode. Smoke: `ILMI_SMOKE=cards-text`.
- Tests: 299 (+23 in `src/import/__tests__/cards.test.ts`).

### Verified

- `npm run typecheck` clean, `npx vitest run` green (17 files, 299).
- In the window (`ILMI_VAULT=<scratch copy> ILMI_SMOKE=cards-text npm run
  tauri dev`, 11:46 local, one run, clean), as logged: the `Q:`/`A:` list
  typed into the intake → h1 `Add a deck`, the row `sides: Q: A:; cards:
  blank line; write: one direction`, the preview's three rows, the count
  `3 cards`, the title `cards` → `newline` clicked: the same three cards →
  `tab` clicked: `0 cards · 6 lines not cards`, `place & open` disabled →
  back to `Q: A:`, `both directions`: the preview's rows with `⇄` →
  `place & open` → `cards.md`: `type: deck`, `imported: 2026-10-18`, three
  `:::` paragraphs, blocks `card,card,card`, 0 diagnostics → the deck lens:
  h1 `cards`, meta `3 cards · 3 due`, three rows, the inspector's deck
  block → the intake again, the tab list typed: the row `tab` / `newline`,
  three `Q`/`A` preview rows, `4 cards`; the title typed `german nouns`,
  `place & leave it` → `german nouns.md` with four `::` paragraphs, 0
  diagnostics, the intake cleared → the sample prose typed: no row, stats
  `136 words · 4 paragraphs · ~1 min` with `as cards →`, h1 `Add a source`
  → `as cards →`: the row with `tab` / `newline`, `0 cards · 4 lines not
  cards`, place disabled.
- Five captures read: the intake with the `Q:`/`A:` list, the three rows
  `SIDES Q: A: tab :: – , custom`, `CARDS blank line newline ; custom`,
  `WRITE one direction both directions`, the chosen ones underlined, and
  the preview's `Q` / `A` rows beneath; the same with `newline` and `both
  directions` underlined, the preview's `⇄` rows, `3 cards` with `as a
  source →` at the right, `TITLE cards`; the deck lens `cards` with its
  three `⇄` rows, `3 cards · 3 due`, the inspector's `new cards CLOZE Q&A
  BIDIR` and the three cards marked `NEW`, `cards 3 · 3 due` in the tree;
  the tab list with `tab` and `newline` underlined and `Q der Vorsatz / A
  resolution, intention` rows; the prose after `as cards →`: the row,
  `0 cards · 4 lines not cards`, `as a source →`, the title and folder
  rows, both place buttons greyed, `german nouns 4 · 4 due` in the tree.
  One spacing fix after the captures (the count line sat tight under the
  `write` row when there is no preview). Port 1420 free afterwards.

### Not done / open

- An Anki export's delimiters cannot be overridden; the header is trusted
  and the row shows a line in place of the buttons. `#columns:` field
  names are read past, not used.
- Non-empty cells beside a cloze cell are dropped and counted as `extra
  field`; Anki's "Back Extra" among them.
- Leftovers are paragraphs by intent, not by force: one that begins with
  `#` or `- ` reads back as a heading or a list, and one that holds ` :: `
  under the prefix pair reads back as a card under `## not cards`.
- Detection runs fifteen splits on every keystroke; fine for a paste,
  untried on a very long text.
- The preview shows the first three cards only, not the leftovers; the
  count says how many.
- `as a source →` is a say-so for the current text only; once placed, a
  source is a source.

### Decisions worth knowing

- The weak delimiters (comma, dash) are guarded rather than ranked lower,
  since the plan's rule is "most cards": without the guard the intake
  sample's commas out-counted everything, and a `Q:`/`A:` list whose
  lines hold commas out-counted the prefix pair.
- The deck is built as text and parsed, not assembled from blocks, so what
  the preview and the tests see is what the file reads back as.
- `cardText` tries the `?` form before giving up: a front holding ` :: `
  is a fine multi-line card, and only a side with a blank in it (which
  the cloze rule would take) is refused and kept as a leftover.
- The row sits where the stats row was, and the stats row returns with a
  link to it, so the intake grows no section when the text is prose.

### Handoff prompt

Paste into a fresh session:

```
Read PLAN.md, FORMAT.md, BUILD-LOG.md, and spec/hashiyah/HANDOFF.md.
Milestones 0–16 are ticked (16, cards from text, BUILD-LOG 2026-10-18).
Do milestone 17 in PLAN.md (cards from Anki: a dropped .apkg, read on the
Rust side with rusqlite, each deck landing as a deck file with its
progress) and only that one. Reuse src/import/cards.ts: reduceCell for
field HTML, hints, sounds, and images; cardText for `front :: back` /
`:::` / the `?` forms; deckDoc and Vault.importDeck for the files. Follow
src/import/supermemo/docs.ts (seedOf) for the seeded `sr` lines and the
intake's .pdf path (src/app/Intake.tsx, fetch.ts, read_dropped_bytes in
src-tauri/src/lib.rs) for the drop. Copy rules of
spec/hashiyah/BUILD-PROMPT.md for every string. Stop at the milestone's
"done when". Then tick it, write notes for the next session under it, add
an entry to BUILD-LOG.md with a fresh handoff prompt, and commit.

Tooling: export PATH=$HOME/.cargo/bin:/opt/homebrew/bin:$PATH before every
command. npx vitest run (299 tests, 17 files) and npm run typecheck must be
green before a commit; cargo test in src-tauri too once anki.rs exists.
Window checks: copy src/format/__tests__/corpus/vault to a scratch
directory, run caffeinate -d -u -i in the background, then ILMI_VAULT=<copy>
ILMI_SMOKE=<mode> npm run tauri dev with a tail loop that screencaptures
on `shot: <name>` (sleep 2 first) and kills the app on `done` / `failed`;
free port 1420 before and after; do not edit src/ while it runs.
```

---

## 2026-10-18 — polish: the card as two faces

The session card redrawn after SuperMemo's element window: the question
fills the upper half of the pane, the answer the lower, each its own
bordered face, the grades beneath. The answer face is blurred until
revealed (space, or a click on it); on e-ink it is simply absent until
then. A cloze's answer face holds the deleted text alone, its blank in
the question filling in at the same moment; q&a and bidir put their two
halves on the two faces. The card editor in the inspector is unchanged.

Verified in the window with a new `ILMI_SMOKE=faces` mode, which walks
the session to a card of each form and pauses hidden and revealed, then
in the dark and e-ink themes: faces 261px each, filter `blur(9px)` hidden
and `none` revealed, the hint gone on reveal, the cloze's blank shown and
"graded" alone below; eight screenshots read. Suite 276, typecheck clean.

Open: the faces' width is capped at 920px; editing a card in place from
the faces, as SuperMemo allows, is not there, the inspector's one
textarea still does that.

---

## 2026-10-17 — milestone 15: the PDF lens, a PDF read in place with the three loops over it

Three commits: `83a8a3f` — *pdf: the pairing in FORMAT.md, the pdf field
and the page attribute, the corpus pair, the vault's pages*; `11f628f` —
*pdf: the lens over pdf.js, a PDF dropped on the intake lands as the pair,
the session reads pages*; `a51fdbd` — *pdf: smart jump, ⏎ on a selected
reference peeks at its target*. The plan is complete with this one.

### Done

- `FORMAT.md` §1, §3, §10: `name.pdf` beside `name.md` is the document's
  pages, paired by stem; a `pdf` field names the file relative to the
  document and wins when its file exists; `page` (int ≥ 1) on an extract's
  `read` line; `pos` on a document with pages is the page the ruler is on;
  what came out of a page sits under `## p. <n>`, a heading the app adds
  once per page; a `pdf` naming a missing file is kept and the document
  reads as text; nothing is ever written into a PDF.
- `src/format`: the `pdf` field (plain or quoted like `title`), `page`
  through `specIntMin`, `Meta.pdf`. Corpus: `vault/papers/two-pages.pdf`
  from `corpus/make-pdf.ts` (`npm run fixture:pdf`; two US-letter pages of
  Helvetica set with text operators, 1603 bytes, no dates, nobody's paper:
  a title and a few lines each, a `Figure 1` reference and a `[1]` citation
  on page 1, the caption, a `References` line, and the entry on page 2),
  `two-pages.md` (`pdf:`, a `## p. 1` paragraph with its backref, a
  two-blank cloze under `## p. 2`), `two-pages/the ruler in the margin.md`
  (`page=1`), `mangled/pdf-missing.md`. `pdf.test.ts` holds the file on
  disk to the generator byte for byte and reads the words back through
  `pdfjs-dist/legacy` in node.
- `src/vault`: `Fs.readBytes` / `writeBytes` (node and Tauri); the walk
  attaches `DocNode.pdf` by stem; `pagesOf`, `importPdf`, `extract` with
  `page` (the child's line, the passage as a paragraph with the backref
  under `## p. <n>` in the parent, the marker untouched), rename and move
  carrying the `.pdf` and a field that named the old stem, remove deleting
  it, `taken` counting `name.pdf`, a `.pdf` change rewalking the tree;
  `pages.ts` (`pageHeading`, `pageOf`, `pageOfBlock`, `pageSection`,
  `addToPage`).
- `src/pdf`: `text.ts` (a page's lines and paragraphs from pdf.js items),
  `find.ts` (a passage found in a text layer with whitespace ignored),
  `jump.ts` (`refOf`, `jumpTarget`, `bibliographyStart`, `stemShared`).
- `src/app`: `pdfjs.ts` (pdfjs-dist 6.4.299 pinned, the worker through
  Vite's `?url`, a `ReadableStream` async-iterator shim for WebKit),
  `Pdf.tsx` and `pdf.css` (the lens: pages rendered lazily with the text
  layer on, the rail, the `text` / `pages` toggle, the ruler, `e` `m` `r`
  `/` `g` `[` `]` `⏎`, highlights through the CSS Custom Highlight API, the
  peek), the intake's `.pdf` drop and `pick a file →` through the Rust
  command `read_dropped_bytes` and `pdfText`, `pages` in its stats,
  `importPdfNode`; `Lenses` routing a document with pages to the lens;
  `Session` rendering it for a reading element and passing the page in view
  to `read on`, its keys deferring to one the lens took; the inspector's
  `pages` row, `reading` as `p. N`, a card's `in` as `title, p. N`;
  `ReadItem.page` and `p. N` on queue rows; the bottom strip's `pages`
  hints; `fs:allow-read-file` / `fs:allow-write-file`. README: the keys, a
  paragraph on the pair, `src/pdf/` in the layout, `fixture:pdf`.
- Tests: 276 (+23). The corpus counts pinned in `schedule.test.ts` moved
  deliberately: upcoming 13 → 17, cards 24 → 26, reading 4 → 6, the day's
  17 unchanged (every new due is after 2026-05-27, so the order tests held);
  `vault.test.ts` lists the pair and its extract; the `af=2` pass test
  allows `page=` on the line. Smoke: `ILMI_SMOKE=pdf`.

### Verified

- `npm run typecheck` clean, `npx vitest run` green (16 files, 276).
  `npx vite build` passes: `pdf.worker.min` 1.26 MB as its own asset, the
  main chunk 1.40 MB (gzip 423 kB), pdf.js in it.
- In the window (`ILMI_VAULT=<scratch copy> ILMI_SMOKE=pdf npm run tauri
  dev`, 19:40 local, seven runs in all, the last clean), as logged: the
  corpus PDF dropped on the intake (through `intakeHooks.ingestFile`, since
  the OS drop cannot be faked) → `read: 1603 bytes, 2 pages, title
  "two-pages", text 613 chars`; stats `2 pages · 121 words · ~1 min` →
  `place & open` → `papers/two-pages 2.md` + `papers/two-pages 2.pdf`
  (1603 bytes on disk), front-matter `frozen: true / imported / pdf:
  two-pages 2.pdf / title: two-pages`, body `heading, paragraph ×4`, 0
  diagnostics → the lens: `pages 2, canvases 2, text spans 14`, meta
  `papers · text · start reading r · 2 pages`, strip `e extract · m card ·
  ⏎ jump · r start reading · / search · g page · [ ] pages`, inspector
  `pages two-pages 2.pdf` → `r`: `read: due=2026-10-17 ivl=1 reps=0 pos=0`,
  rule height 0 → a line of page 1 selected on the text layer, cue `extract
  e · make a card m`, `e` → `papers/two-pages 2/The ruler in the margin.md`
  with `read: due=2026-10-17 ivl=1 reps=0 pos=0 page=1`, the parent gained
  `## p. 1`, the paragraph, and `<!-- extract The ruler in the margin -->`,
  0 diagnostics, `highlights 1`, rail `p. 1 ↳ The ruler in the margin` → a
  line of page 2 selected, `m`, composer seeded with it, a blank typed, ⌘↵
  → `## p. 2` + `Spaced practice beats {{massed}} practice, …`, 1 card, 0
  diagnostics, rail `p. 2 ◆ massed`; the rail's card row selects it and the
  inspector reads `in two-pages, p. 2` → `/` `written` ⏎: bar `p. 2, 1 /
  1`, 1 hit highlighted, page 2 in view → `g` 1: page 1; `]`: page 2 →
  `Figure 1` selected on page 1, ⏎: peek `p. 2 · Figure 1. A ruler drawn in
  the margin of a page. · esc`, a 960×293 canvas, still on page 1; `[1]`, ⏎:
  peek `p. 2 · [1] Nobody. A paper that does not exist. 2026.`; ⏎ on prose:
  no peek → `text`: the reader with 9 blocks, meta `papers · pages ·
  frozen · 1 card, 1 due`, and back → the session on the new element
  (picked from the queue by path, since the corpus pair has the same title
  and is due too): bar `1 / 37 READING · read on ⏎ · postpone p · done d`,
  page 2 scrolled into view, `highlights 1`, ⏎ → `read: due=2026-10-19
  ivl=2 reps=1 pos=2`, log `read · read on`, the corpus pair untouched, the
  session moved on to the extract → reopened: `highlights 1`, rule height
  1289px (both pages), rail with both rows, inspector `reading p. 2, +2d`.
- Nine captures read one by one: the intake with `2 pages · 121 words · ~1
  min`, the title, and `place & open`; the pages with the page's text
  drawn, the meta row `papers text start reading r · 2 pages`, the `pages`
  row in the inspector; the extract's line in gold on page 1, the rail `P.
  1 — The ruler in the margin`, the child in the tree, the extract in the
  inspector; the card's block in the inspector with `in two-pages, p. 2`
  and the editor; the find bar `/ written · p. 2, 1 / 1` over page 2 with
  the hit in blue and the rail `P. 2 ◆ massed`; the peek under the
  `Figure 1` selection on page 1: its header `p. 2 · Figure 1. A ruler drawn
  in … · esc` over a band of page 2 showing the caption, `References`, and
  the `[1]` entry, the extract's line still gold above; the text view with `## text`, `p.
  1` with its `EXTRACT` paragraph, `p. 2` with the cloze; the session on
  page 2 with the bar `1 / 37 READING`; the reopened lens with the rule
  down the whole margin and the highlight back. A macOS "can't connect to
  iCloud" dialog sat over the middle of the window in every capture;
  nothing of ours was under it that the log does not cover. Capture loop
  as before (ten-second pause after each `shot:`, two-second shell delay).
  Port 1420 free afterwards.

### Not done / open

- pdf.js's standard fonts and CMaps are not bundled: `useSystemFonts`
  draws the standard 14 fonts with the system's; a PDF needing a CMap
  (CJK, some symbol fonts) draws without it. ~2.4 MB of assets if wanted.
- A page once drawn stays drawn; a long PDF holds every canvas it has
  scrolled past. Letting far pages go is the obvious next step.
- The lens does not reload when the `.pdf` file itself changes on disk;
  the tree does (a `.pdf` change rewalks), the open lens does not.
- `d` on an extract from a page drops its `read` line and with it `page`,
  so a done extract leaves the rail and loses its highlight. The format
  puts `page` on the `read` line as the plan said; a field of its own would
  keep it.
- `[` `]` page only outside a session; inside one they stay the session's
  prev / next, as the bottom strip says.
- The queue row's snippet for a PDF is the Markdown's first prose block
  (the `## text` fallback's first paragraph), not the page's text.
- No zoom, rotation, or two-page spread; the page fits the column.
- The peek draws the whole target page afresh each time; the main chunk
  carries pdf.js (1.4 MB) rather than loading it on first use.
- Smart jump's author rule reads `Smith 2019` as a name and a year only
  because the number is year-shaped; `Table 2019` would be read the same.
  The `is_dot_index_end_of_a_reference` and `remove_et_al` parts of sioyek
  were not reached in reading; the citation rules are ours alone.
- `scripts/` is still outside `tsconfig`'s `include`, as in 14.

### Decisions worth knowing

- The parent of a page extract keeps the passage as a paragraph under the
  page heading, the way the text reader's parent keeps the passage in
  place: the backref needs a paragraph to hang on, and "the Markdown
  holding what came out" is the point of the pair.
- `pagesOf` trusts the field only when its file exists and stays inside
  the vault; otherwise the stem's file, so a bad field degrades to the
  pairing rather than to nothing.
- Highlights are the CSS Custom Highlight API over the text layer's nodes,
  not drawn boxes: a webview without it shows the rail and nothing else,
  and nothing is positioned by hand.
- The intake needed no new screen: a PDF is another thing dropped on it,
  and the stats row changes one word.
- The smoke drops through a dev-only hook on the intake, since Tauri's OS
  drag-drop event cannot be synthesised from the page.
- Smart jump was built last, after the rest was verified, as the plan
  asked, and verified in the same run.

### Handoff prompt

Paste into a fresh session:

```
Read PLAN.md, FORMAT.md, BUILD-LOG.md, and spec/hashiyah/HANDOFF.md. The
plan is complete: every milestone in PLAN.md is ticked (15, the PDF lens,
was the last; BUILD-LOG 2026-10-17). Do not start a new milestone on your
own; agree the next step with the user. The candidates: a polish pass over
the open items the sessions left, or whatever the user names.

Open items worth a polish pass, by milestone:
- 10 priority: no palette command or key sets a priority; the inspector's
  field has no stepper; committing a priority on a card selected in the
  reader drops the reader's selection; items.test.ts fixtures still say
  `pri: 2`.
- 11 growth: no growth row before a source is enrolled; the preview counts
  from the stored interval, not from lateness; queue rows and the session
  bar do not show `af`.
- 12 overload: the sidebar's `due today` count and the query's inspector
  counts are the whole day while the top strip folds; rows below the fold
  stay visible and `j k` / `o` reach them; no key for `postpone the rest`;
  nothing marks the fold inside a session; no end-of-day automation;
  Escape in the budget field leaves the tweaks panel open.
- 13 tasks (dropped): a due-day field on the draft's inspector, so a date
  can be set without `p`; a fresh draft's `p` lands two days out.
- 14 import: the user's real SM18 collection (in a Duplicati backup under
  Box) has not been imported and needs their go-ahead; grades are seeded,
  not replayed; scripts/ is outside tsconfig's include.
- 15 PDF: standard fonts and CMaps not bundled; drawn pages never let go;
  the lens does not reload a changed .pdf; a done extract loses its page;
  `[ ]` page only outside a session; the queue snippet for a PDF is the
  Markdown's first block; no zoom or spread; pdf.js in the main chunk.

Tooling: export PATH=$HOME/.cargo/bin:/opt/homebrew/bin:$PATH; npm test and
npm run typecheck must be green before a commit; caffeinate -d -u -i, then
ILMI_VAULT=<scratch copy> ILMI_SMOKE=<mode> npm run tauri dev drives the
window (pdf is the newest mode; the smoke pauses ten seconds after each
`shot:` line and the shell shoots two seconds after reading it; free port
1420 afterwards). npm run fixture:pdf regenerates the corpus PDF.
```

---

## 2026-10-17 — milestone 14: import, a SuperMemo collection into a vault

Commit `e93bb46` — *import: a SuperMemo collection into a vault, from its
data files, by the layout notes*.

### Done

- `src/import/supermemo/LAYOUT.md`, written before any code: every file of
  a collection, every record size and field offset the importer uses, each
  with its source (SuperMemo's help on `super-memory.com`, the SuperMemo 2002
  and SM16 FAQ pages, SuperMemo Assistant's MIT `SuperMemo17/Files` structs,
  freememo's MIT-0 measured fields, SuperMemo-Toolkit's GPL file read for
  facts only, a SuperMemo 20 directory listing, and the file list of the
  user's own SM18 backup, whose sizes divide by 37 / 118 / 39 / 30 exactly),
  and every unknown as unknown. `help.supermemo.org` and `supermemopedia`
  answered 403 to every tool; `super-memory.com` carries the same help text.
  The decompilation repos on GitHub (`sm18-re`, `sm20-re`) were not opened.
- `src/import/supermemo/`: `bytes.ts`, `records.ts`, `collection.ts`,
  `docs.ts`, `index.ts`, `node-fs.ts`, pure over bytes and an `SmFs`; see
  the notes under milestone 14 in PLAN.md for what each holds. The tree
  lands as folders, topics as sources (frozen, imported) and extracts under
  their parent, items as q&a or cloze cards (`^smN`) at the end of the
  nearest topic-document or in a `cards.md` deck under a folder, tasks as
  drafts; `pri` from the rank in `priority.sub`; `read:` and the seeded
  `sr` line from the interval, the last repetition day, the A-factor, and
  the dated rows of the repetition history. A record, kind, type, or trailer
  the notes do not cover is a diagnostic; nothing is written for it.
- `scripts/import-sm.ts` and `npm run import-sm -- <collection.kno>
  <vault-dir> [--today DAY]`, through `tsx` (new dev dependency) with jsdom's
  `DOMParser` for `readable`; `npm run fixture:sm` regenerates the fixture.
- Fixture `src/import/supermemo/__tests__/collection/`: 22 files written by
  `make-collection.ts` from LAYOUT.md, 16 elements, nobody's notes.
- README: the command and `src/import/` in the layout. FORMAT.md untouched.
- Tests: 253 (+8: the primitives round-trip; the fixture on disk is the
  generator's output byte for byte; the collection reads as the layout
  says; the import's tree, five files verbatim, and every file parsing
  clean; the queue for the fixture's last day; the variants with an unknown
  type, an unknown component kind, a bad trailer, and no history; what is
  not a collection).

### Verified

- `npm run typecheck` clean, `npx vitest run` green (14 files, 253).
- `npm run import-sm -- src/import/supermemo/__tests__/collection/fixture.Kno
  <scratch> --today 2024-02-05` prints `fixture → <scratch>`, `4 folders · 2
  sources · 1 extract · 1 deck · 5 cards · 1 draft`, `1 deleted · 1 template
  · 1 media component dropped`, no diagnostics; `Vault.open(nodeFs, dir)`
  over the result lists `ideas/notes on reading.md`, `papers/german/cards.md`,
  `papers/Wozniak 1990.md`, `papers/Wozniak 1990/spacing effect.md`,
  `tasks/write the intro.md`, each with no parse diagnostics; the queue at
  2024-02-05 noon holds the eight items the fixture makes due: the six
  SuperMemo had outstanding (`Outstanding.sub`) and the two never-repeated
  cards, in priority order 0 0 20 40 50 60 80 100. This is the test, and
  the same run from the command line into the scratchpad.
- The fixture exercises the documented layout, not a real collection: the
  round trip proves the importer reads what the notes say a collection
  holds, not that a collection holds it. Port 1420 free.

### Not done / open

- **A real collection has not been imported.** No SuperMemo executable or
  Wine prefix is on this machine, and the only collection is the user's own
  "cognitive canopy" (SM18, 190 elements, backed up 2024-02-05) inside a
  Duplicati backup set at `~/Library/CloudStorage/Box-Box/99 supermemo/`
  (plain zip volumes). Its file list was read; copying the block volumes
  to restore it was refused by the permission rules this session ran under,
  and the session did not try another way. So the done-when's "a real
  collection, when one is at hand, imports with no unknown-record
  diagnostic" is unverified. Next session, with the user's say-so: restore
  `cognitive canopy.Kno` + `cognitive canopy/` from the newest `dlist` (the
  block volumes are keyed by base64 SHA-256 in the `dindex` files), run the
  CLI on it into the scratchpad, and read the diagnostics.
- Grades are not in any readable layout (freememo: "not recoverable"), so
  the plan's replay of the history through `grade` is not done; every
  scheduled item is seeded `st=review s=<ivl> d=5`. If a grade offset in the
  39-byte history record is ever established, `seedOf` is the one function
  to replace.
- Unknown and not written: lapses, the forgetting index, the element status
  (a pending element with an interval would be enrolled), priority as a
  percentage, tasklist deadlines (`tasks/*.dat` is reported when
  non-empty), the `.kno` record, `repetitions.dat`'s epoch, SuperMemo's
  cloze markup beyond the literal `[...]`, an extract's back-reference to its
  parent and the reference block SuperMemo appends to topics (left as prose).
- An item is question then answer in component order; images, sounds, and
  video are dropped with a count. RTF components are read only when they
  have a file slot or an `.rtx` text.
- Readability drops an `<h1>` that repeats the page `<title>`, as the intake
  does; the fixture's source therefore has no heading.
- `scripts/` is outside `tsconfig`'s `include`, so `npm run typecheck` does
  not cover the CLI (jsdom has no types installed); the test covers
  everything under it but the argument parsing.

### Decisions worth knowing

- The layout notes are the only thing that crosses: the importer was written
  from LAYOUT.md, the fixture generator from the same, and the test holds
  the committed fixture to the generator byte for byte so the two cannot
  drift. Facts from a GPL file (component headers, link types, the slot
  rule) are cited as facts; no code or structure from it is used, and the
  slot rule is not even computed (the `elements/` tree is walked instead).
- Every file goes through `Vault.createDoc` + `Vault.write` and cards through
  one `Vault.update` per document, so an imported file is one the app would
  have written and parses with no diagnostics by construction.
- A topic with children and no text is a folder; one with text is a
  document whose child topics are extracts. Items under a folder get a
  `cards.md` deck rather than a document with no prose.
- A card takes its own `pri` line only when its rank differs from its
  document's; an unranked card inherits the document's, as the format says.
- `tsx` rather than node's own type stripping: node 26 neither maps `./x.js`
  imports to `.ts` nor transforms the parameter properties in `vault.ts`.

### Handoff prompt

Paste into a fresh session:

```
Read PLAN.md, FORMAT.md, BUILD-LOG.md, and spec/hashiyah/HANDOFF.md. Do the
first unchecked milestone in PLAN.md and only that one. Stop at its "done
when". Then tick it, write notes for the next session under it, add an entry
to BUILD-LOG.md with a fresh handoff prompt, and commit.

Context: milestone 14 (the SuperMemo import) is done (BUILD-LOG 2026-10-17)
against a fixture only; a real collection sits in a Duplicati backup under
Box and importing it is an open item that needs the user's go-ahead, not
part of the next milestone. The next is 15, the PDF lens over pdf.js with
sioyek as the behaviour reference. Tooling: export
PATH=$HOME/.cargo/bin:/opt/homebrew/bin:$PATH; npm test and npm run
typecheck must be green before a commit; caffeinate -d -u -i, then
ILMI_VAULT=<scratch copy> ILMI_SMOKE=<mode> npm run tauri dev drives the
window (overload is the newest mode; the smoke pauses ten seconds after
each `shot:` line and the shell shoots two seconds after reading it;
free port 1420 afterwards). npm run import-sm -- <collection.kno>
<vault-dir> is the import.
```

---

## 2026-10-17 — milestone 13: tasks, dropped

Commit `010e8f0` — *tasks: dropped, a task is a draft whose body is the
to-do*.

### Done

- No code. Milestone 13 carried its own hedge ("if this starts to look
  like a second drafts lens, stop and ask; dropping it is the likelier
  answer"); with nobody to ask, the session judged it before writing
  anything and dropped it. PLAN.md ticks it as `13. Tasks — dropped` with
  the reasoning under it, so the kickoff rule moves to 14.
- The judgment: the milestone describes a task as "the same shape [as a
  draft] with no interval: due, priority, done". Every part of the asked
  build already exists on the draft: a file whose body is the text, a
  line with `due` and `done`, the document `pri` ranking it in the day
  (the tasklist's actual function), a queue row, a session with `p` and
  `d` and no grades or marker, done / reopen in the inspector, a glyph,
  `new draft`, the `writing` query. The build would have removed `ivl` /
  `reps` / `af` and the ⏎ pass and changed `p` from `postponed(ivl)` to
  tomorrow, at the price of a fourth branch through the format
  (`NodeType`, `Field`, the line specs, `setField`, `meta`, the round
  trip), the queue (`QueueItem`, `Scope`, `inScope`, `counts`,
  `overflow`, `summary`, `El`), the session, the inspector, the tree, the
  folder lens, `metaOf`, the CSS, `createDoc`, and milestone 14's
  importer. The prototype has no task node, and the ground rules say to
  ask before adding a kind it lacks. That is a second drafts lens.
- What a task is instead: a draft. The to-do is the body, `d` when done,
  `p` when not today, a `tasks/` folder to group them in the tree. For
  milestone 14, a tasklist is a folder of drafts, `write: due=<deadline,
  else the import day> ivl=1 reps=0 done=false`, priority on `pri`.

### Verified

- `npm run typecheck` clean, `npx vitest run` green (13 files, 245),
  unchanged from milestone 12. Nothing to run in the window; port 1420
  free.

### Not done / open

- The one thing a to-do lacks as a draft is a due-day field on the
  draft's inspector, so a date can be set without `p`. A row for a polish
  pass, if wanted; not a type.
- "To tomorrow" is not a draft action: a fresh draft's `p` is
  `postponed(1)`, two days out, and ⏎ on it is `grow(1, 1.5)`, also two.
  Accepted; the due-day field above would cover it.
- Milestone 14's text still says "tasklists → milestone 13 tasks"; it was
  left as written, and the note under 13 says what it now means.

### Decisions worth knowing

- Dropped rather than built-then-asked: the milestone named dropping as
  the likelier answer, the gain was one function, and the cost would have
  reached into 14.
- Ticked `[x]` with "dropped" in the heading rather than left unchecked,
  so the next session's "first unchecked milestone" is 14 without a
  special case; the original bullets stay under the note as the record of
  what was asked.

### Handoff prompt

Paste into a fresh session:

```
Read PLAN.md, FORMAT.md, BUILD-LOG.md, and spec/hashiyah/HANDOFF.md. Do the
first unchecked milestone in PLAN.md and only that one. Stop at its "done
when". Then tick it, write notes for the next session under it, add an entry
to BUILD-LOG.md with a fresh handoff prompt, and commit.

Context: milestone 13 (tasks) was dropped (BUILD-LOG 2026-10-17): a task
is a draft, see the note under 13 in PLAN.md. The next is 14, the
SuperMemo import: one-shot from the command line, from the data files
only, with the layout verified and written into
src/import/supermemo/LAYOUT.md before any importer code; its "tasklists →
milestone 13 tasks" line now means a folder of drafts. Tooling: export
PATH=$HOME/.cargo/bin:/opt/homebrew/bin:$PATH; npm test and npm run
typecheck must be green before a commit; caffeinate -d -u -i, then
ILMI_VAULT=<scratch copy> ILMI_SMOKE=<mode> npm run tauri dev drives the
window (overload is the newest mode; the smoke pauses ten seconds after
each `shot:` line and the shell shoots two seconds after reading it;
free port 1420 afterwards).
```

---

## 2026-10-17 — milestone 12: overload, a budget for the day and postponing the rest

Commit `5eaa5f5` — *overload: a day budget in the vault's state, the fold in
due today, postpone the rest over the reading and writing below it*.

### Done

- `src/schedule/queue.ts`: `fold(items, n)` splits a sorted list into
  `{ above, below }` (`n ≤ 0` is no fold); `overflow(items, now, budget)`
  keeps what is due, sorts, folds, and returns the reading and writing
  below the fold, highest `pri` number (lowest priority) first, never a
  card; `postponeOverflow(vault, items, now, budget)` runs
  `advanceRead` / `advanceWrite` with `'postpone'` on each through one
  `vault.update` per file and resolves to what it postponed. Exported
  through `src/schedule/index.ts` with the `Fold` type.
- `src/vault/vault.ts`: `VaultState.budget` (int, 0 or absent is none)
  beside `folders`, `tab`, `sidebar`, `inspector`. FORMAT.md untouched: no
  vault file changes shape.
- `src/app`: `budget` in the store; `cleanBudget` and `dueToday(items,
  now, budget)` in `items.ts`; `setBudget` (debounced `queueSave`) and
  `postponeRest()` (notes `postponed · N elements`) in `vault.ts`;
  `openVault` reads the budget back; `startSession` and `openSession`
  walk `dueToday`, so a session is the part above the fold. `TopStrip`
  counts `dueToday`. `Queue.tsx`: in `due today`, rows past the budget
  carry `data-below="1"` and sit dimmed under `li.fold`: a `--line-1`
  rule, `N more` left, and while a topic or draft is below, the
  `postpone the rest` button right with `2 to read · 1 to write` beside
  it. `Palette.tsx`: the `postpone the rest` command, listed only while
  `overflow` is non-empty. `Tweaks.tsx`: a `budget` row (`BudgetField`:
  commits on blur or ⏎, escape restores, empty is none) while a vault is
  open. `queue.css` / `chrome.css`: the fold and the number field.
- README: the tweaks line names the budget; one sentence on the fold.
  Dev: `ILMI_SMOKE=overload`.
- Tests: 245 (schedule: `fold` over small docs, `overflow` ignoring cards
  and the not-yet-due and taking an unsorted list, the corpus day at
  budget 5 postponing its three reading topics with one `read:` line each
  and every other file byte-identical, tomorrow's queue without them, six
  topics at budget 3 opening within budget the next day with intervals
  `4 → 5, 5 → 6, 6 → 7`; app: `dueToday` and `cleanBudget`; vault: the
  state file round-trips `budget`).

### Verified

- `npm run typecheck` clean, `npx vitest run` green (13 files, 245).
- In the window (`ILMI_VAULT=<scratch copy> ILMI_SMOKE=overload npm run
  tauri dev`, 18:16 local, every corpus date past so all 30 elements are
  due), as logged: no budget → `rows 30 above, 0 below; fold none; top
  strip "30 due"` → the tweaks field, empty, set to 5 → `rows 5 above, 25
  below; fold "25 more · postpone the rest · 4 to read · 1 to write"; top
  strip "5 due"; state.json {"tab":":queue/today","budget":5}` → the
  palette on `postpone` lists `[command] postpone the rest` → the row
  clicked: `5 files changed`, each one line, each a `read:` or `write:`
  line (`talk-incremental` `due=2026-05-30 ivl=3` → `due=2026-10-21
  ivl=4`; `sutton-2019` `ivl=1` → `due=2026-10-19 ivl=2`; `crick-1995`
  `ivl=2` → `due=2026-10-20 ivl=3`, `af=2` kept; `wozniak-1990` `ivl=9` →
  `due=2026-10-28 ivl=11`; `woz-ex1` `ivl=1` → `due=2026-10-19 ivl=2`),
  no card file touched, log `postponed · 5 elements` → `rows 5 above, 20
  below; fold "20 more"`, the palette on `postpone` now `nothing` →
  tomorrow's queue from the files: `25 due, 1 topics` (spaced-composition,
  above the fold, untouched) → ⏎: `session: 5 elements; count "1 / 5"` →
  the field cleared: `rows 25 above, 0 below; fold none; top strip "25
  due"; state.json {"tab":":queue/today","budget":0}`.
- Five captures read one by one: the day with the fold rule after five
  rows, `25 more` at its left, `postpone the rest  4 to read · 1 to write`
  at its right, the rows below dimmed, `5 due` in the top strip while the
  sidebar and the inspector still say 30; the tweaks panel with `budget
  · a day` and `5` in a mono field under the density slider; the palette
  with the one command row; the queue after the click with `postponed ·
  5 elements` in the log, `0 to read 1 to write 24 to review`, `20 more`
  and no button; the session on `die Lücke` reading `1 / 5` with `5 due`
  above. A system notification banner sat over the inspector's header
  in the fourth capture; nothing of ours was under it. Capture loop as
  before: ten-second pause after each `shot:` line, two-second shell
  delay; port 1420 free afterwards.

### Not done / open

- The sidebar's `due today` count and the query's inspector counts are
  the whole day (30), not what is above the fold (5); only the top strip
  was asked to fold. Worth a look if the two numbers side by side read
  as a bug.
- Rows below the fold stay visible, dimmed, so what the button will
  touch is in view; the plan's "`N more` under it" could also be read as
  hiding them. `j k` walk the whole list and `o` on a row below opens it
  as a one-element session.
- No key for `postpone the rest`; nothing marks the fold inside a
  session; no end-of-day automation, the row and the command are the
  only triggers.
- `Escape` in the budget field restores the field and, by stopping the
  key, leaves the panel open; the panel's own `esc` still closes it from
  anywhere else.
- Not re-run in the window: a budget larger than the day (no fold drawn,
  by the same branch the suite covers).

### Decisions worth knowing

- The budget is in `.ilmi/state.json`, not in the tweaks' `localStorage`,
  because a day's size belongs to a vault, not to a webview; the tweaks
  panel is only where it is set, so the row shows only with a vault open.
- `overflow` takes the whole queue and does its own due filter and sort,
  so the queue, the palette, and the postpone share one answer whatever
  list they hold.
- Lowest priority first is the highest `pri` number first; it only
  orders the writes and the log, since each file is postponed on its own.
- The command leaves the palette when nothing is below the fold rather
  than sitting there doing nothing.
- `dueToday` replaced `dueNow` in the session and the strip; `dueNow`
  stays for the query, which shows the whole day with the fold drawn in.

### Handoff prompt

Paste into a fresh session:

```
Read PLAN.md, FORMAT.md, BUILD-LOG.md, and spec/hashiyah/HANDOFF.md. Do the
first unchecked milestone in PLAN.md and only that one. Stop at its "done
when". Then tick it, write notes for the next session under it, add an entry
to BUILD-LOG.md with a fresh handoff prompt, and commit.

Context: milestone 12 (overload) is done (BUILD-LOG 2026-10-17); the next
is 13, tasks, which is optional and says dropping it is the likelier
answer: decide first, and if it is dropped, say so under it and move to
14 (the SuperMemo import, from the data files only). Tooling: export
PATH=$HOME/.cargo/bin:/opt/homebrew/bin:$PATH; npm test and npm run
typecheck must be green before a commit; caffeinate -d -u -i, then
ILMI_VAULT=<scratch copy> ILMI_SMOKE=<mode> npm run tauri dev drives the
window (overload is the newest mode; the smoke pauses ten seconds after
each `shot:` line and the shell shoots two seconds after reading it;
free port 1420 afterwards).
```

---

## 2026-10-17 — milestone 11: growth, a factor per document for reading and writing

Commit `cafcd16` — *growth: an af factor on the read and write lines, postpone
multiplies, the inspector previews the next intervals*.

### Done

- `FORMAT.md` §3, §8: `af` on the `read` / `write` line, a number ≥ 1.1,
  default 1.6 on `read` and 1.5 on `write`, written only when it is not
  the default; the default written by hand goes on the first write, a
  value below the floor is dropped with a diagnostic.
- `src/format`: `ReadSchedule.af` / `WriteSchedule.af`; `specNumMin` in
  `attrs.ts`; `AF_MIN` / `READ_AF` / `WRITE_AF` / `parseAf` in
  `frontmatter.ts`, the spec after `pos` (read) and `reps` (write);
  `withoutDefaultAf` applied in the parser, in `setField`, and in
  `formatField`, so the in-memory document never carries the default and
  parse → serialize → parse stays a fixed point.
- `src/schedule/growth.ts`: `grow`, `nextIntervals`, `postponed`,
  `POSTPONE_FACTOR` (1.2). `read.ts` / `write.ts`: `readOn` / `workedOn`
  take the line's `af`; `postpone(s, now, factor?)` sets `ivl` to
  `max(round(ivl × factor), ivl + 1)` and `due` that many days from today,
  `reps` untouched. Exported through `src/schedule/index.ts`.
- Corpus: `af=2` on crick-1995's read line, `af=1.2` on
  talk-incremental's write line (same line count, so no test line
  numbers moved); new `mangled/growth.md`.
- Inspector: `NumField` (the number field behind `PriField`, with `min`,
  `max`, `step`, `parse`, and `none`), `growthRow` with the `af-field`
  and the next three intervals dimmed beside it; on sources and extracts
  under `priority` when enrolled, on drafts inside `spaced composition`.
  `chrome.css`: the `af-field` shares the `pri-field` rules, `af-next`.
- Session: the postpone note says how far, `wrote · +3d`.
- README: one sentence on growth and postpone. Dev: `ILMI_SMOKE=growth`.
- Tests: 239 (format: the growth corpus file, the corpus's two factors,
  the default set in memory is not written, `parseAf`; schedule: read on
  and worked on with the line's factor, postpone's arithmetic and its
  floor over a grid of intervals and factors, `nextIntervals`, the
  corpus's reading topics with `af=2` on disk, crick's postpone keeping
  its factor).

### Verified

- `npm run typecheck` clean, `npx vitest run` green (13 files, 239).
- In the window (`ILMI_VAULT=<scratch copy> ILMI_SMOKE=growth npm run
  tauri dev`, 17:52 local), as logged: crick-1995's inspector reads
  `growth 2`, placeholder 1.6, next `4d · 8d · 16d` → set to 3: one line
  changed on disk (`af=2` → `af=3`, 25 lines → 25), next `6d · 18d · 54d`,
  diagnostics 0 → cleared: `af` gone from the line, next `3d · 5d · 8d` →
  `1.6` typed: file unchanged → `1` typed: file unchanged, field back to
  empty → talk-incremental's `spaced composition` block reads `passes 0 ·
  interval 3 d · growth 1.2 (4d · 5d · 6d) · due overdue 140d` → in the
  session on spaced-composition (`ivl=2`, no `af`), `p` rewrote one line,
  `due=2026-05-27 ivl=2` → `due=2026-10-20 ivl=3`, 30 lines → 30, the
  note `wrote · +3d`.
- Three captures read one by one: the crick reader with `growth 2` and
  the dim preview under `priority`; the draft with the row inside
  `spaced composition`; the writing session on spaced-composition with
  the bar `worked on it ⏎ · postpone p · done d`. The desktop's
  picture-in-picture window was gone this time; every value column was
  visible. Capture loop as before: the smoke pauses ten seconds after
  each `shot:` line, the shell shoots two seconds after reading it.

### Not done / open

- The first run of the field showed `1.6` after typing the default, since
  nothing on disk changed and the field only follows the prop; fixed with
  `none` on `NumField` (typing the value that means empty clears the
  field), verified by the suite and typecheck, not re-run in the window.
- No growth row on an unenrolled source: there is no line to carry `af`
  until `r` enrols it.
- The preview counts from the stored `ivl`, not from lateness; an
  overdue topic's next interval is the same as an on-time one's.
- Queue rows and the session bar do not show `af`; only the inspector.
- The plan's "pass over the corpus's reading topics with `af=2`" is a
  test that sets the factor on each topic in a scratch copy and reads the
  line back; the corpus files themselves carry one factor each.

### Decisions worth knowing

- The default is dropped at parse time as well as at write time, the way
  the line `pri` fallback is, so a hand-written `af=1.6` and an absent
  `af` are the same document in memory and on disk after one write.
- Postpone writes the new interval, not just the due day, so a topic
  postponed twice keeps drifting out instead of snapping back to its old
  interval on the next pass. The pass count stays, since nothing was read.
- Growth lives in `src/schedule/growth.ts` rather than in each loop so
  the inspector's preview and both loops share one rounding rule.
- The key order puts `af` before `pri` on both lines: `pri` on the line
  is a fallback the format is retiring, `af` is permanent.

### Handoff prompt

Paste into a fresh session:

```
Read PLAN.md, FORMAT.md, BUILD-LOG.md, and spec/hashiyah/HANDOFF.md. Do the
first unchecked milestone in PLAN.md and only that one. Stop at its "done
when". Then tick it, write notes for the next session under it, add an entry
to BUILD-LOG.md with a fresh handoff prompt, and commit.

Context: milestone 11 (growth) is done (BUILD-LOG 2026-10-17); the next
is 12, overload: a day budget in .ilmi/state.json, the fold in the due
today query, and "postpone the rest" over reading and writing items below
it (postpone(s, now, factor?) from milestone 11 is the primitive; cards are
never postponed). Tooling: export PATH=$HOME/.cargo/bin:/opt/homebrew/bin:$PATH;
npm test and npm run typecheck must be green before a commit; caffeinate
-d -u -i, then ILMI_VAULT=<scratch copy> ILMI_SMOKE=<mode> npm run tauri
dev drives the window (growth is the newest mode; the smoke pauses ten
seconds after each `shot:` line and the shell shoots two seconds after
reading it).
```

---

## 2026-10-17 — milestone 10: priority, one scale at document level, the queue sorted by it

Commit `2849ca8` — *priority: one 0–100 scale on the document, a card's own on
its line, the queue sorted by it*.

### Done

- `FORMAT.md` §2, §3, §6.2, §8: a `pri` front-matter field (int 0–100,
  lower first, default 50) for the document's reading, writing, and every
  card in it; `pri` on a `read` / `write` line is read as a fallback for
  that loop while there is no field and dropped on write once there is
  one; a card's own `pri` on its bare `sr` line, never on a group line.
- `src/format`: `model.ts` (`CardSchedule.pri`, the `pri` field, the
  field key list), `frontmatter.ts` (`PRI_MIN` / `PRI_MAX` / `PRI_DEFAULT`,
  `parsePri`, `Meta.pri`, `docPri`; `specIntRange` on the line specs; the
  parser drops a line `pri` once the field exists, `setField(doc, 'pri',
  n)` drops it too, and `formatFrontmatter` formats a copy without it, so
  serialize stays pure and a file with both reaches the fixed point),
  `parse.ts` (`pri` last in `SR_SPECS`; on an `sr cN` line it is dropped
  with `"pri" on a group line is ignored`).
- `src/schedule/card.ts`: `fromFsrs(c, grade, prev)` carries `pri` and
  `extra` across a grade and a preview. `src/schedule/queue.ts`: an
  item's `pri` is the card's own, else the document's field, else 50 (a
  line fallback counts for its loop); `sortQueue(items, now)` puts what is
  due first by priority, then due, then document order, and the rest
  after by due, then priority. The 2 / 3 card rule is gone.
- `src/vault/vault.ts`: `extract` gives the child the parent's field (or
  the parent's line fallback) as a `pri` field; `resetCard` keeps a card's
  own `pri` as a bare `<!-- sr pri=N -->`.
- Corpus: `pri=1..3` on the six vault files moved onto the field as 10 /
  50 / 80 (one line longer each, so the line-number expectations in
  `schedule.test.ts`, `vault.test.ts`, `tree.test.ts`, `reader.test.ts`
  moved by one); new `mangled/priority.md` with a bad field value, the
  field over a line value, an out-of-range line value, a card override, a
  group-line `pri`, and a bare line carrying only `pri`.
- App: `DocInfo.pri`. Inspector: a `priority` row (`PriField`, a number
  input that commits on blur or ⏎, empty clears, escape restores) for
  source / extract / draft / deck through `setField`, and for the selected
  or under-review card on its bare line through `cardAt`, the lookup the
  card editor now shares; `hasSchedule` keeps a `pri`-only line from
  reading as scheduled. Composer: the prototype's priority picker is back
  as a `priority` number, default the document's; a differing value
  becomes `sched: { pri }` on the new card, in the reader and in the deck.
  Queue rows, the session's card strip, and the reading / writing bar
  show `p NN` only when it is not 50, live from the document.
- README: one sentence on priority. Dev: `ILMI_SMOKE=pri`.
- Tests: 232 (format: the priority corpus file, `setField` with the
  field, bad values; schedule: `pri` through grade and preview, the
  card's override and the line fallback, the day's full order, the
  due-then-upcoming bands; vault: a reset keeps `pri`; the extract tests
  expect the field).

### Verified

- `npm run typecheck` clean, `npx vitest run` green (13 files, 232).
- In the window (`ILMI_VAULT=<scratch copy of the corpus> ILMI_SMOKE=pri
  npm run tauri dev`, 22:42 UTC), as logged: the inspector's priority
  field reads `50` for crick-1995 → set to `10`: one line changed on
  disk (`pri: 50` → `pri: 10`, 25 lines → 25) → cleared: the line is gone
  (25 → 24) → `10` again → the day's queue reads `READ crick-1995 p 10`
  first, its card `p 10` second, the rest with no `p` → landing on
  wozniak-1990's `cw1-paths` from the palette, the card's field is empty
  with `80` as the hint → set to `5`: line 16 alone changed, now ending
  `g=3 pri=5` → the queue leads with that card, `p 5` → entering the
  queue, the card strip reads `q&a · 9 reviews · stability 22d · p 5 ·
  overdue 135d` and the inspector's card field reads `5` → space, 3: the
  rewritten line keeps `pri=5`, still one line changed. Diagnostics 0
  throughout.
- Four captures read one by one: the crick reader with the `priority`
  row in the inspector; the day's queue with `p 10` on crick's two rows
  and nothing on the others; the wozniak reader on the selected card; the
  session on that card with `p 5` in the strip and `priority 5` in the
  inspector's card block. The first run's late captures also showed the
  reading bar as `2 / 30 · READING · p 10`. A picture-in-picture window
  on the desktop covered the inspector's value column in every capture;
  the log lines carry the values.
- Shot timing that works: the smoke pauses ten seconds after each `shot:`
  line and the shell captures two seconds after reading it (the line
  arrives about five seconds late); the first run's 1.8 s pause and 9 s
  shell delay landed every capture on a later screen.

### Not done / open

- The plan's "queue order for 2026-05-27 is unchanged" held for topics
  and drafts, not cards: the old rule put every due card at 2, ahead of
  every pri-3 topic, and wozniak-1990's cards now sit with their document
  at 80. The order test pins the new order and says so.
- Committing a priority on a card selected in the reader drops the
  reader's selection (the reader rebuilds its view on any external change
  and republishes nothing), so the inspector falls back to the document;
  the deck lens and the session keep the card. Prior behaviour, the card
  editor does the same.
- No palette command or key sets a priority; the field has no stepper.
- `items.test.ts` fixtures still say `pri: 2`; harmless, it is a number.
- A `pri` field on a deck applies to its cards, which is the only thing a
  deck has; the row sits with `cards` and `due`.

### Decisions worth knowing

- The line fallback is dropped at parse time once the field exists, not
  only at write time, so the in-memory document never carries two
  answers and the round-trip fixed point holds for a file with both.
- `pri` on a card is schedule-line data the scheduler does not own:
  `fromFsrs` copies it from the previous schedule the way it copies
  unknown attributes, and a reset keeps it.
- The queue sorts in two bands, due then not due, rather than one
  priority sort, so a low-priority card due next week never leads today.
- `p NN` is shown only when it is not 50: the default says nothing.

### Handoff prompt

Paste into a fresh session:

```
Read PLAN.md, FORMAT.md, BUILD-LOG.md, and spec/hashiyah/HANDOFF.md. Do the
first unchecked milestone in PLAN.md and only that one. Stop at its "done
when". Then tick it, write notes for the next session under it, add an entry
to BUILD-LOG.md with a fresh handoff prompt, and commit.

Context: milestone 10 (priority) is done (BUILD-LOG 2026-10-17); the next
is 11, growth. Tooling: export PATH=$HOME/.cargo/bin:/opt/homebrew/bin:$PATH;
npm test and npm run typecheck must be green before a commit; caffeinate
-d -u -i, then ILMI_VAULT=<scratch copy> ILMI_SMOKE=<mode> npm run tauri
dev drives the window (pri is the newest mode; see "Shot timing" above).
```

---

## 2026-09-23 — cards in a deck: select, delete, reset, move, and land on one

Seven commits, one per feature, each green on typecheck and the suite:
`a104658` *vault: card block operations: remove, reset, and move*,
`87ceb38` *deck: delete a card from its row*, `b49115a` *deck: select a
row; j k move, ⌫ deletes, escape lets go, the inspector edits it*,
`a065dcb` *inspector: reset a card's schedule*, `ecd1a4e` *deck: move a
card to another deck from the row's menu*, `94583df` *palette, queue:
opening a card lands on it*, `9199392` *smoke: the deck run checks the
selection carried through the deletes, then walks the keys*.

The work was built by a nine-agent workflow (two foundations in
parallel, three features in series, three review lenses, a fix pass, a
window run), then split into the commits above from the final tree.

### Done

- `src/vault/vault.ts`: `resetCard(path, index, id?, text?)` drops a
  card's `sched` and `blanks` and keeps text, id, and extracts;
  `moveCard(from, index, to, id?, text?)` reads the card fresh from
  disk, appends it to the destination (extracts dropped, id re-minted
  only on collision), then removes it from the source, comparing the
  card against the copy it wrote so a card that changed under the move
  is left in both files (`VaultConflict`). Both run under `serial()`,
  write the destination first, and emit the normal `doc` events. The
  lookup shared with `removeCard` is one `cardIn(doc, path, index, id?,
  text?)`: the block at the index when it is the same card, else by
  id, else by text, so an id-less card is found after a row slides
  into its slot. `freshId` / `usedIds` are private copies of the
  schedule's, since vault cannot import schedule.
- `src/app/vault.ts`: `resetCard` (notes `reset · card`), `moveCard`
  (clears `selectedCard` when it pointed at the card, notes `moved ·
  card`), `openCard(path, index, id?, opts)` (sets `reveal`, then
  `openNode`). `removeCard` / `resetCard` / `moveCard` pass the card's
  text through.
- `src/app/store.ts`: transient `reveal: {path, index, id?} | null`,
  reset on `openVault`.
- `src/app/Lenses.tsx` `DeckLens`: click or right-click selects a row
  (`selectedCard = {path, index}`, the row drawn like the reader's
  selected card); `j` `k` / arrows move through the rows and scroll
  the row into view; `⌫` / `Delete` removes the selected card and
  selects the row that took its place (or the new last row, or
  nothing); deleting or moving a row above the selection keeps the
  same card selected; `Escape` clears it; `m` still opens the
  composer. The right-click menu gained `→ move to… ▸` with the
  tree's submenu (every other deck, sorted; omitted when there is
  none), above `⌫ delete card`; its x is clamped to the window like
  the tree's (`MENU_W` exported from `Tree.tsx`). A `reveal` for this
  deck selects and centers the row once the doc is loaded
  (`revealIndex` in `chrome.ts`: the index when the card with that id
  is still there, else the card with the id, else -1) and clears it.
  The selection clears on unmount and whenever the block at the index
  stops being a card.
- `src/app/Reader.tsx`: a `reveal` for this document dispatches a
  `NodeSelection` on the card node (child index first, id fallback),
  scrolls it to center, and clears `reveal`; `publishSelection` then
  puts it in the inspector as before.
- `src/app/Inspector.tsx` `CardBlock`: the schedule block ends in a
  `scheduled · reset` row (the freeze row's look) whenever the card
  has `sched` or `blanks`; after the reset the block reads `new`. A
  cloze with only per-blank lines and no group now reads `per blank`
  instead of `new`. The card editor's debounced write resolves its
  target from the card it knew (id, or text when id-less), not the
  bare index.
- `src/app/Palette.tsx` / `chrome.ts`: card entries carry `{open,
  index, id?}` and open through `openCard`; `src/app/Queue.tsx`: in
  the `cards` scope, ⏎ / `o` / click open the card in its document
  instead of a one-item session. `src/app/Session.tsx`: the card strip
  falls back to the queue item's schedule only while the document is
  not loaded, so a card reset mid-session reads `new`.
- `src/app/Canvas.tsx`: lenses go quiet under the tweaks panel as
  they do under the palette.
- `hintsFor('deck')` is `j k move · ⌫ delete · m card · ⌘k palette`;
  README Keys "in a deck" says so and names the × and the right-click
  delete and move.
- Dev: `ILMI_SMOKE=deck` deletes from the menu and from the ×, checks
  the selection those left behind, then presses the keys: escape, j j
  k, an edit typed into the inspector's editor, j and backspace, a ×
  above the selection, escape again; then resets from the inspector,
  moves a card to a deck it creates, and lands on a deck card from the
  queue tab, on another with the deck already showing, and on a source
  card, taking a shot at each step. Each key step reports the state it
  saw on a timeout.
- Tests: `vault.test.ts` (removeCard ×3 incl. an id-less card found by
  text at a stale index; resetCard; moveCard ×6 incl. the fresh-read
  and changed-under-move guards, id collision, extract backrefs);
  `chrome.test.ts` (deck hints, the card target shape, `revealIndex`).
  225 in all.

### Verified

- `npm run typecheck` clean, `npx vitest run` green (13 files, 225).
- In the window (`ILMI_VAULT=<scratch copy> ILMI_SMOKE=deck npm run
  tauri dev`, 17:41 UTC), every line as logged: `rows 7; header "7
  cards · 7 due"` → `menu: ⌫delete card; row marked 1` → `menu delete:
  rows 6; menu gone true; "das Gedächtnis ⇄ mem" on disk false;
  ^cv-gedacht on disk false; lines 26 → 23; cards 6; diagnostics 0` →
  `inspector: typebidiringerman · A1; log "removed · card"` → `× delete:
  rows 5; "der Vorsatz ⇄ resolu" on disk false; first row now "die
  Wiederholung ⇄ repet"; header "5 cards · 5 due"; front-matter intact
  true` → `after the deletes: selected "vergessen ⇄ to forget" at
  {"path":"german.md","index":1}, row 1; selected rows 1` (the
  right-click selected the third row, the menu delete moved the
  selection to the row that took its place, the × above left it on
  that card) → `keys: j j k → selected {"path":"german.md","index":0}
  "die Wiederholung ⇄ repet"; selected rows 1; inspector editor "die
  Wiederholung ::: rep"; strip "j k move⌫ deletem card⌘k palette"` →
  `inspector edit: row 0 "die Wiederholung ⇄ repetition; review;
  edite"; on disk true; sr line kept true; still selected true;
  diagnostics 0` → `backspace: rows 5 → 4; "vergessen ⇄ to forget" on
  disk false; selected {"path":"german.md","index":1} "die Lücke ⇄
  gap; blank" took its place; selected rows 1; log "removed · card"` →
  `delete above: the selection stays on its card: "spaced repetition
  is ver" → "spaced repetition is ver" at
  {"path":"german.md","index":1}; rows 3` → `escape: selected null;
  selected rows 0; inspector editor gone` → `selected:
  {"path":"german.md","index":0}; schedule block
  "schedulereviews9lapses4stability0.50 ddi"; sr line for ^cv-luecke
  on disk "<!-- sr due=2026-05-25 s"` → `reset: schedule block
  "schedulenew"; reset button gone true; sr lines 2 → 1; line after
  ^cv-luecke now ""; still selected true {"path":"german.md","index":0};
  rows 3; log "reset · card"; diagnostics 0` → `move: dest untitled
  deck.md "untitled deck"; menu: →move to…▸ | ⌫delete card; selected
  {"path":"german.md","index":1}` → `move: submenu: ◫untitled deck;
  back "◂move to…"` → `move: rows 3 → 2; menu gone true; "spaced
  repetition is" here false, there true; ^cv-cloze here false, there
  true; sr line "<!-- sr due=2026-06-15 s" here false, there true; dest
  cards 1, last block card; selected {"path":"german.md","index":1};
  log "moved · card"; diagnostics 0 0` → `landed deck: tab "german ·
  A1"; selected {"path":"german.md","index":1} = "ein Wort ohne Karte
  ⇄ a " (…block 1 of 2 rows); inspector card "ein Wort ohne Karte :::
  a word"; reveal null` → `landed again: selected
  {"path":"german.md","index":0} = "die Lücke ⇄ gap; blank"; selected
  rows 1; inspector card "die Lücke ::: gap; blank"` → `landed source:
  tab "wozniak-1990"; selected
  {"path":"papers/wozniak-1990.md","index":3} (wanted 3); node "what is
  the framework’s " in view true; inspector card "what is the
  framework’s pictur"; reveal null` → `done`.
- Real keystrokes too: two `j` sent through System Events to the
  window moved the selection and the inspector followed.
- On disk afterwards: `german.md` is the front matter, `die Lücke :::
  gap; blank ^cv-luecke` with no `sr` line under it, and `ein Wort ohne
  Karte ::: a word without a card`; `untitled deck.md` is `type: deck`
  plus the cloze with `^cv-cloze` and its full `sr` line, one blank
  line between blocks, trailing newline.
- Eight captures of the window, read one by one: the delete menu over
  the selected row with the hover × on the first row and the
  inspector's card block, editor, schedule numbers, and `scheduled ·
  reset`; the deck after both deletes with the surviving selection;
  the deck after the key walk with nothing selected and the deck block
  back in the inspector; the reset card reading `new` in the schedule
  block and in the deck's card list; the `◂ move to…` submenu listing
  the new deck, drawn like the sidebar's; the deck after the move with
  the next row selected and `untitled deck 1 · 1 due` in the tree; the
  palette landing with one selected row; the reader with the q&a card
  selected, centered, and in the inspector. The strip reads `j k move
  · ⌫ delete · m card · ⌘k palette` in the deck. Nothing overlapped or
  clipped.
- Notes for the next run: `caffeinate -d -u -i` first, a sleeping
  display freezes the webview and captures come back black; the app's
  log lines reach the terminal about five seconds late, so a shot
  pause is ten seconds; raising the window with System Events can
  count as an outside press and close an open menu, which the smoke
  now notices and reopens.

### Not done / open

- No DOM unit test drives the deck keys, the post-delete reselect, or
  the landing; only `hintsFor`, `revealIndex`, the palette target
  shape, and the vault ops are unit tested. The window smoke covers
  the rest, keys included.
- Move is mouse only; no key, no palette command.
- A move whose source write fails after the destination write leaves
  the card in both decks and surfaces only in `console.error`; the
  wrapper does not say so in the log.
- `reveal` is left set when the document is gone, or when another
  pane's lens for the same path consumes it first.
- `freshId` / `usedIds` are duplicated between `src/vault/vault.ts` and
  `src/schedule/queue.ts`; moving them into `src/format` is a later
  layering cleanup.
- The reader's and the deck's `.card-span.selected` rules live in two
  stylesheets.
- The smoke leaves `untitled deck.md` in the scratch vault on purpose.

### Decisions worth knowing

- Delete and move write the destination or the removal in the order
  that duplicates rather than loses on a crash, and the move refuses
  to remove a source card that no longer matches what it copied.
- The card lookup keys on identity (id, or text when there is none)
  and uses the index only as the first guess, so a stale index from a
  row that slid never removes a neighbour.
- The deck menu omits `move to…` when there is no other deck, as the
  tree omits items that do not apply, rather than disabling it.
- Landing recenters the row or node (`block: 'center'`); the deck's
  key navigation still scrolls `nearest`.

### Handoff prompt

Paste into a fresh session:

```
Read PLAN.md, FORMAT.md, BUILD-LOG.md, and spec/hashiyah/HANDOFF.md.

Context: every milestone is done and the deck lens now selects,
deletes, resets, and moves cards, and the palette lands on a card
(BUILD-LOG 2026-09-23, commits a104658..9199392). Tooling: export
PATH=$HOME/.cargo/bin:/opt/homebrew/bin:$PATH; npm test and npm run
typecheck must be green before a commit; caffeinate -d -u -i, then
ILMI_VAULT=<scratch copy> ILMI_SMOKE=deck npm run tauri dev exercises
the deck end to end.

Resume with: pick from "Not done / open" above or ask what to do next.
```

---

## 2026-09-23 — fsrs checked against ts-fsrs by simulation; full precision on disk

Commit `c7d8fcb` — *schedule: store stability and difficulty at full precision;
a simulation holds every step to ts-fsrs*.

### Done

- `src/schedule/__tests__/fsrs-sim.test.ts`: 300 cards × 40 reviews with a
  seeded grade mix (again 10%, hard 15%, good 60%, easy 15%) and reviews
  at the due moment or up to two days late. Each review goes through our
  path (grade → the `sr` line → parse → grade) and through ts-fsrs 5.4.2
  on its own card; state, reps, lapses, stability, difficulty, interval,
  learning step, last and due must be equal at every one of the 12,000
  steps, and the line read back must give ts-fsrs the card it would have
  held. Also: the algorithm's shape (1 min / 10 min / days for a new
  card; again lapses into relearning; again < hard < good < easy;
  retrievability at due averaging 0.90 over a hundred cards, never under
  0.85) and ten reviews of a corpus card through `gradeItem` and the
  vault, one line changed each time, equal to ts-fsrs throughout.
- The finding: rounding stability and difficulty to two decimals before
  storing (milestone 3's choice) drifted intervals from ts-fsrs's own in
  36% of steps, by up to 8% of stability over forty reviews; the loss is
  largest after a lapse, when stability is a fraction of a day. Measured
  with ts-fsrs alone as well, so it was the rounding and not the mapping.
  Four decimals would leave 3% of steps and 0.06%; six, 0.03%.
- The fix: `fromFsrs` no longer rounds. The format already writes the
  shortest round-trip decimal (FORMAT.md §7), so the number read back is
  the number ts-fsrs produced, and the simulation is exact. FORMAT.md's
  note on rounding updated; the inspector shows two decimals; two older
  tests that spelled out a two-decimal line now match the pattern.

### Verified

- `npm test` green (212, the simulation included), `npm run typecheck`
  clean, `npm run build` ok.
- In the window (`ILMI_SMOKE=loop`), the graded card's line as written:
  `<!-- sr c1 due=2026-09-23T12:44:41Z st=learning s=2.3065 d=2.11810397
  r=1 l=0 steps=1 ivl=0 last=2026-09-23T12:34:41Z g=3 -->`.

### Not verified

- Long-run behaviour with the fuzz on or with fitted parameters; both
  are off / default, as milestone 3 decided.

### Decisions worth knowing

- Full precision over four or six decimals: the lines get longer
  (`d=2.11810397`) but the card on disk is exactly ts-fsrs's, and
  "matches" was the bar set. Existing two-decimal lines in a vault stay
  valid input.

---

## 2026-09-22 — milestone 9: chrome and polish

Commit `2a99c0e` — *chrome: the strips, the inspector with its card editor,
the palette, the keyboard router, the tweaks, and the loop end to end*.

### Done

- The shell: `TopStrip.tsx`, `BottomStrip.tsx`, `Inspector.tsx` with an
  `insp-resize` handle (drag past the edge closes it), the full grid from
  `tokens.css` (the two-column override in `app.css` removed), `--insp-w`
  live. The inspector's width and open state persist per vault in
  `.ilmi/state.json` beside the sidebar's (`VaultState.inspector`).
- `chrome.ts`, pure: `hintsFor` (the bottom strip's keys per surface),
  `cardLabel` (first blank, question, or `a ⇄ b`), `fuzzy`, `buildIndex`,
  `search`, `ENTRY_GLYPH`.
- `Inspector.tsx` per kind, read from the vault through `useDoc`: folder
  (items, by type), source / extract (of, path, imported, length, cards,
  reading; freeze / thaw; extracts; cards), deck (cards, due; the
  default-card toggle writes `default-card`; cards), draft (path, length,
  cards; done / reopen; passes, interval, due; cards), intake (into),
  a query (the five counts), the session (the card under review with a
  `CardEditor` and its schedule: reviews, lapses, stability, difficulty,
  due, last; or the topic's / draft's own inspector), a document with a
  selected card (the card block above the document's).
- The card editor writes the block's text through `vault.update` after
  400 ms when the text still reads as one card, and notes `not a card`
  otherwise. The reader publishes a card `NodeSelection` as
  `selectedCard`, and now selects a card on click on frozen documents
  too.
- `Palette.tsx`: ⌘K over saved queries, folders, documents by title,
  every card, and eight commands; ↑↓ / ⌃n ⌃p / ⏎ / esc (esc from
  anywhere). `Tweaks.tsx`: ⌘, with theme, accent, density, in
  `localStorage` (`ilmi.tweaks`); `App.tsx` maps them to CSS.
- Reading enrolment: `r`, or `start reading r` in the meta row, on a
  source or extract not yet enrolled (`enrolReading`); the bottom strip
  offers it only then.
- Global keys: ⌘K, ⌘\, ⌘W, ⌘⇧E, ⌘⇧I, ⌘,. `Reader` takes `active`; the
  canvas passes `active` as false under the palette.
- Store: `accent`, `inspector`, `paletteOpen`, `tweaksOpen`,
  `selectedCard`, `sessionEl.item`; `setAccent`; density clamped to
  0.6–1.6; the console `ilmi.*` still works.
- Copy: `open or run` in the palette, `⌕ ⌘k` on its button, one count in
  the top strip, `due today` / `overdue 2d` / `new` in the card strip.
- README: the keys, the tweaks.
- Dev: `ILMI_SMOKE=loop` (import → start reading → extract → card → edit
  it in the inspector → palette → queue → session → grade) and
  `ILMI_SMOKE=shots` (every screen, `shot: <name>` in the log for a
  shell loop to `screencapture`).
- Tests: `src/app/__tests__/chrome.test.ts`, 6 tests (hints, card names,
  the index, the match, the search, the tweaks' bounds). 209 in all.

### Verified

- `npm test` green (209), `npm run typecheck` clean, `npm run build` ok.
  Rust untouched.
- The loop, in the window (`ILMI_VAULT=<scratch copy> ILMI_SMOKE=loop npm
  run tauri dev`): `imported papers/Spaced repetition and the economics
  of attention.md; frozen; enrol button "start reading r"; bottom strip
  "e extract m card r start reading ⌘\ split pane"; inspector "source"`
  → `r`: `read: due=2026-09-22 ivl=1 reps=0 pos=0` → `e`: `extract
  papers/Spaced repetition …/The mistake most learners make.md; read
  line read: due=2026-09-22 ivl=1 reps=0 pos=0; parent marker … pos=3`
  → `m`: `cards 1; diagnostics 0; inspector cards "The mistake most
  learners make | gardener"` → a click on the card: `selected card
  {"path":…,"index":4}; editor "A good system spends your attention
  the "; note cloze` → typed in the inspector: `edited card: "A good
  system spends your {{attention}} the way a "; surface blanks 2` →
  ⌘K `spaced`: `[draft] spaced composition · essays / [source] Spaced
  repetition and the economics of attention · papers / [card] graded ·
  spaced composition / [card] attention · Spaced repetition …` → the
  day: `34 rows; ours [read] Spaced repetition … / [read] The mistake
  most learners make / [card] cloze … / [card] cloze …` → a session
  from our row: `bar read on ⏎ | postpone p | done d; inspector
  "source, extracts, cards"; strip "⏎ read on p postpone d done e
  extract m card [ ] prev / next"` → on to our card: `meta "‹› 6 / 34
  cloze Spaced repetition …"; inspector editor "A good system spends
  your {{at"; strip "space reveal 1 2 3 4 grade [ ] prev / next"` →
  space, 3: `<!-- sr c1 due=2026-09-23T01:07:22Z st=learning s=2.31
  d=2.12 r=1 l=0 steps=1 ivl=0 last=2026-09-23T00:57:22Z g=3 -->`. So
  import → read → extract → card → review runs end to end, every step
  on disk.
- Screenshots, for the first time (`ILMI_SMOKE=shots` + `screencapture`
  from the shell; the first shot made macOS ask the terminal's host app
  for screen-recording permission, and that dialog sat over the middle
  of the later shots, the chrome around it clear): the day's queue,
  the reader with the marker and the inspector's source block, the
  selection cue and the composer, the draft with its row, the deck with
  the default-card toggle, the intake, a card under review with the
  editor and schedule beside it, a writing element with the bar, the
  palette, the tweaks panel, and the same screen in dark and e-ink.
  Read against the brief: paper not sepia, one accent, hairlines,
  2px, mono labels, serif reading, no fills doing decoration, every
  string lowercase and short. They pass the "maintained for years"
  test to my eye; the reader's word, not a pixel diff.

### Not verified

- Dragging the inspector's handle, the palette's scroll-into-view, the
  tweaks' persistence across a relaunch (the write path is the same
  `localStorage` call; no relaunch was done).
- The card editor while the reader is mid-edit on the same document.
- (Closed 2026-09-23: with screen recording allowed, `ILMI_SMOKE=shots`
  was run again and all fifteen captures came back clean; the reader,
  the card under review, the writing element with its bar, the palette,
  the composer, e-ink, the folder lens, and the draft were re-read and
  hold up.)

### Decisions worth knowing

- The prototype's `fuzzy` returned -1 for a miss and its palette kept
  scores ≥ 0, which threw away its best matches (a full match scores
  negative); ours returns null and keeps everything that matched.
- The card editor edits through the vault, not through the reader's
  `setCardText`: the reader treats the write as external and rebuilds,
  which is right for a card (an atom) and needs no plumbing between the
  panels. `setCardText` stays tested and unused.
- `r` starts reading. The prototype never implemented it (one line of
  empty-state copy mentioned it), but without it a source can only
  reach the reading queue through its extracts, so it is here, and
  offered in the strip and the meta row only while it applies.
- The accent presets are the prototype's six, since the plan names
  accent as a tweak; the brief calls gold the one accent, and gold is
  the default.
- The tweaks live in `localStorage`, the first state kept outside a
  vault; a remembered last vault could live there too.
- The top strip shows one number, `N due`, and the day; the
  prototype's `N sources · N cards · N due` was a middot pileup.
- The palette's card entries open the card's document; the prototype
  opened a one-card browse session. Selecting the card there is a
  later nicety.

### Handoff prompt

Paste into a fresh session:

```
Read PLAN.md, FORMAT.md, BUILD-LOG.md, and spec/hashiyah/HANDOFF.md.

Context: every milestone (0-9) is done; the first real milestone from
spec/hashiyah/BUILD-PROMPT.md ships. src/format/ parses and serializes
vault files (parse / serialize / meta / setField; never string-edit a
file). src/vault/ opens, walks, reads, writes, watches, and reshapes a
vault over an Fs interface; change a file with vault.update(path,
mutate). src/schedule/ grades cards with ts-fsrs, runs the reading and
writing loops, and builds the queue. src/reader/ is the ProseMirror model
and src/app/Reader.tsx the editor. src/app/ holds the shell: App.tsx
(grid, global keys), TopStrip, BottomStrip (hints from chrome.ts),
Tree + SavedQueries, Canvas (panes, tabs), Lenses (folder, deck, reader,
intake, queue, session), Inspector (with the card editor), Palette,
Tweaks; items.ts and chrome.ts are the pure sides; store.ts mirrors the
vault and holds view state; vault.ts is the one open vault and every
operation on it. Tests run in vitest over a temp copy of
src/format/__tests__/corpus/vault. ILMI_VAULT=/path npm run tauri dev
opens a vault; ILMI_SMOKE=1 / reader / cards / intake / queue / loop /
shots exercise the parts and log to the terminal.

Tooling: node is in /opt/homebrew/bin and cargo in ~/.cargo/bin; neither is
on the tool-shell PATH. Prefix every command with
export PATH=$HOME/.cargo/bin:/opt/homebrew/bin:$PATH
npm test and npm run typecheck must be green before a commit.

There is no unchecked milestone. Read "Notes for the next session" in
PLAN.md for the known edges, then ask what to do next, or, if a task
was given with this prompt, do that one thing, verify it in the window,
log it in BUILD-LOG.md, and commit.
```

---

## 2026-09-22 — milestone 8: queue and review session

Commit `fc62c94` — *queue: the saved queries, the session over them, cards
graded, topics read on, drafts worked on, every result on disk*.

### Done

- The queue in the store: `src/app/vault.ts` keeps every document's
  parsed form (`bodies`) and publishes `queue` (every item, sorted) and
  `queueAt` on each publish, `doc`, and `gone` event; `refreshQueue()`
  for the present moment; `DocInfo` derived from the same items.
  `openSession(item)` (today rotated to start there, or the item alone),
  `startSession()` (from the top), `note(line)` for the log.
- `src/schedule/queue.ts`: `sortQueue`, `sameItem`, `ReadItem.next`,
  `WriteItem.lead`.
- `names.ts`: `SESSION`, `queueId` / `queueScope`, `SCOPES`,
  `QUEUE_TITLE`, `tabKindOf` and `titleOf` for both, glyphs `≡` and `◆`.
  A saved query is restored across launches; nothing remembered opens
  `due today`.
- `src/app/items.ts`, pure: `dueLabel` (from `Reader.tsx`), `dayLabel`,
  `fmtDays`, `gapLabel` / `gapLabels` over `preview`, `sourceLabel`,
  `firstWords`, `isFresh`, `kindTag`, `refLine`, `intervalLabel`,
  `snippetOf`, `ownBlank`, `sessionItems`, `summary`, `dueNow`.
- `src/app/Queue.tsx`: the five saved queries after `views.jsx` (header
  with the day and the three counts, `enter queue ⏎`, two log lines,
  rows with mark, kind tag, label, body, ref line, priority, due and
  interval; `j k ⏎ o`; a row opens a session at that element, ⌘-click
  and ⌘⇧-click as everywhere) and `SavedQueries` for the sidebar, with
  live counts, opening in a new tab as the prototype did.
- `src/app/Session.tsx` after `recall.jsx`: `[ ]` and ‹ › through the
  elements; a card centred with its blanks covered (one blank of a
  multi-group card, the others shown as context; a q&a's answer; a
  bidir's second side), space reveals then grades good, `1-4` grade,
  the four buttons carry what each grade would schedule, the meta strip
  under the card (form, `blank N of M`, reviews, stability, due), the
  source link opens the document; a topic renders `Reader` with the
  marker live plus a sticky bar with `read on ⏎` / `postpone p` / `done
  d`; a draft the same with `worked on it`. Grading runs `gradeItem`
  inside `vault.update`; reading and writing run `advanceRead` /
  `advanceWrite`; `read on` passes the prose blocks scrolled past the
  top as `pos`. The session's tab title and glyph follow the element.
  The end is one line: `done, N elements`; an empty day is `nothing
  due`.
- `Reader.tsx`: the draft row (`first pass, today` / `pass N, +3d` /
  `done`, with `done` / `reopen`); `richHTML` exported for the card.
- `queue.css`, `session.css`, the draft row in `reader.css`, `.empty
  .center` and the second sidebar section in `app.css`; the prototype's
  flattening folded in (enter queue is a row, tags are text, no blur).
- Dev: `ILMI_SMOKE=queue`.
- Tests: `src/app/__tests__/items.test.ts`, 10 tests: the ids and
  titles, the labels, the grade gaps, which blanks an item tests, the
  session's order, and a whole session over the sample vault through
  the model (17 elements at 2026-05-27, each written, the day empties,
  every touched file parses clean, a new card gets an id and a line)
  plus the marker only moving forward. 203 in all.

### Verified

- `npm test` green (203), `npm run typecheck` clean, `npm run build` ok.
- Done-when, in the window (`ILMI_VAULT=<scratch copy> ILMI_SMOKE=queue
  npm run tauri dev`, today being 2026-09-22 so everything is due):
  `today: tab "due today"; h1 "due today tue · 22 sep"; summary "4 to
  read 2 to write 24 to review"; rows 30; saved queries due today 30,
  upcoming 0, reading 4, writing 2, all cards 24`. Enter, then thirty
  elements walked with the keys: every card logged `changed lines [n]`
  (one line) or `[-1]` (a line added: a new card's id and `sr` line, a
  numbered blank), e.g. `card wozniak-1990 — twenty rules … blanks
  hidden 1 ctx 1 → revealed 1; gaps 10m 2mo 4mo 7mo; changed lines
  [24]`; `writing spaced composition: … changed lines [5]; line write:
  due=2026-09-25 ivl=3 reps=2 pri=2 done=false`; `reading crick-1995: …
  rule 122.25px; changed lines [5]; line read: due=2026-09-25 ivl=3
  reps=4 pos=2 pri=2`. `end: "done, 30 elements"`, then `queue after:
  "nothing due"; log read · read on / wrote · progress; saved queries
  due today 0, upcoming 30, reading 4, writing 2, all cards 24`. So a
  full session writes every result to disk and the queue empties to one
  quiet line.

### Not verified

- The look: the card, the grades, the sticky bar over the document, the
  sidebar's second section, by reading and by the prototype's rules.
- `read on` after a real scroll (the smoke never scrolls, so `pos` was
  the marker's own).
- Two panes showing a saved query and the session side by side, beyond
  the model (one session tab; `sessionEl` is global).

### Decisions worth knowing

- One session at a time, one tab (`:session`); entering again starts it
  over (`seq`). The prototype keyed a session tab by its element id.
- Today is rotated to start at the element you clicked, as the
  prototype did; an element from `upcoming` or `all cards` is a session
  of one and can be graded early, as the prototype allowed.
- The in-card text editing of the prototype (contentEditable on blur)
  is not ported; the inspector's card editor is milestone 9 and
  `setCardText` is waiting for it.
- The log is kept (the prototype's `qlog`), in memory, two lines shown,
  the prototype's words (`read · read on`, `wrote · progress`); no card
  lines, as before.
- Empty states are one line each, not the prototype's `EMPTY_COPY`
  paragraphs, per the brief.
- A card's interval column shows the scheduled `ivl` (days) rather than
  the prototype's stability; nothing for a new card, which the due
  column already calls `new`.
- The grade buttons' gaps come from `preview`: minutes while a card is
  in learning steps (`1m 6m 10m 8d` for a new card), days after.
- `read on` remembers what has scrolled past the top of the pane, as
  the prototype did, never moving the marker back.

### Handoff prompt

Paste into a fresh session:

```
Read PLAN.md, FORMAT.md, BUILD-LOG.md, and spec/hashiyah/HANDOFF.md.

Context: milestones 0-8 are done. src/format/ parses and serializes vault
files (parse / serialize / meta / setField; never string-edit a file).
src/vault/ opens, walks, reads, writes, watches, and reshapes a vault over
an Fs interface; change a file with vault.update(path, mutate). src/schedule/
grades cards with ts-fsrs (gradeItem inside vault.update), runs the reading
and writing loops (advanceRead / advanceWrite), and builds the queue.
src/reader/ is the ProseMirror model and src/app/Reader.tsx the editor,
with the marker, the selection cue (e extracts, m composes), the draft row.
src/app/ has the sidebar tree and saved queries, panes and tabs (a tab is
a path or a special id: INTAKE, SESSION, queueId(scope) in names.ts), the
lenses, the intake, the queue (Queue.tsx) and the session (Session.tsx);
items.ts is their pure side; the store (store.ts) mirrors the tree, docs,
the queue, the session, theme and density. Tests run in vitest over a
temp copy of src/format/__tests__/corpus/vault. ILMI_VAULT=/path npm run
tauri dev opens a vault; ILMI_SMOKE=1 / reader / cards / intake / queue
exercise the parts and log to the terminal.

Tooling: node is in /opt/homebrew/bin and cargo in ~/.cargo/bin; neither is
on the tool-shell PATH. Prefix every command with
export PATH=$HOME/.cargo/bin:/opt/homebrew/bin:$PATH
npm test and npm run typecheck must be green before a commit.

Do milestone 9 in PLAN.md (chrome and polish) and only that one: the top
strip, the bottom strip with real key hints, the inspector per node type
(with the card editor over setCardText), the command palette, the global
keyboard router, the tweaks panel (theme / accent / density, stored
outside the vault), then the copy pass. Follow spec/hashiyah/chrome.jsx,
palette.jsx, tweaks-panel.jsx and app.jsx, and the brief's copy and
design rules for every string and surface. Stop at the milestone's "done
when": a screenshot of each screen passes the brief's test and the whole
loop (import → read → extract → card → review) runs end to end. Then tick
it in PLAN.md, write notes under it, add an entry to BUILD-LOG.md, and
commit.
```

---

## 2026-09-22 — milestone 7: import

Commit `7d81c0d` — *import: the intake lens, readable text from a paste, a
dropped file, or an address, landed frozen and unread*.

### Done

- `src/import/`, pure: `text.ts` (`cleanText`, `deriveTitle`, `stats`,
  `isUrl`, `titleFromFileName`, the extension patterns) and `readable.ts`
  (`readable(html, url)`: Readability over a `DOMParser` document, then
  `textOf` walks the article into the blocks FORMAT.md reads: `#`
  headings, nested `- ` / `1. ` lists, `> ` quotes, fenced code, `|`
  table rows, chrome and images skipped; the whole body when there is
  no article; `null` when there is no text).
- `Vault.importDoc(dir, { title, text, today? })`: the text read by
  `parse` as a file would be, `frozen: true`, `imported`, `read` and
  `write` dropped, the file named by the new `fileName(title)` in
  `paths.ts` through `freeName`, `title` written as a field only when the
  file name cannot carry it (or the text brought one).
- The intake tab: `INTAKE` (`':intake'`) in `names.ts`, with `tabKindOf`,
  `titleOf`, and the `＋` glyph; `intakeDir` in the store; `openIntake`
  and `importNode` in `src/app/vault.ts`; the tab is remembered in
  `.ilmi/state.json` like any other. `add a source` in the tree's
  right-click menu opens it, placing into the folder under the menu.
- `src/app/Intake.tsx`, after `ingest.jsx`: the field, the hint with
  `use a sample →`, stats, `title`, `lives in` (every folder, the root
  by the vault's name), `place & open` (the source replaces the intake
  tab) and `place & leave it` (the form clears and stays). A pasted
  address into an empty field is fetched; a file dropped on the panel
  is read by path; dragged text is taken as text. One quiet line under
  the field carries `fetching` and the four failure notes.
- `src/app/fetch.ts`: `fetchReadable` over `@tauri-apps/plugin-http`
  (html through `readable`, plain text as is), `readDropped` over the
  new Rust command `read_dropped` (text extensions as is, `.html`
  through `readable`, others refused).
- Tauri: `tauri-plugin-http` registered, `http:default` granted for
  `http://**` and `https://**`; `read_dropped` reads one file by path
  without widening the fs scope.
- CSS for the intake in `app.css`, flattened as the rest: hairlines, 2px,
  the chosen folder underlined, the drop veil a dashed hairline.
- Dev: `ILMI_SMOKE=intake` opens the intake into `papers`, takes the
  sample, places and opens it, then opens the intake into `books` and
  pastes `https://example.com/`.
- Tests: 8 in `src/import/__tests__/import.test.ts` (text helpers, the
  walker's blocks read back by `parse` as heading / paragraph / raw with
  no diagnostics, Readability picking the article and its title out of a
  page with chrome, the fallback and the refusal) and 5 in
  `src/vault/__tests__/tree.test.ts` (`fileName`, the landed file's
  front-matter and blocks and the one `tree` event, a title the file
  name cannot carry, a taken name numbered, front-matter kept minus the
  enrolment, refusals). 193 in all.

### Verified

- `npm test` green (193 tests), `npm run typecheck` clean, `npm run
  build` ok, `cargo check` ok.
- Done-when, in the window (`ILMI_VAULT=<scratch copy> ILMI_SMOKE=intake
  npm run tauri dev`): `open: tab "intake"; h1 "Add a source"; … focused
  true`; after `use a sample`: `stats "136 words 4 paragraphs ~1 min";
  title "Spaced repetition and the economics of attention"; folders
  vault, books, essays, fleeting, papers, papers/archive; chosen papers`;
  after `place & open`: `placed papers/Spaced repetition and the
  economics of attention.md; front-matter --- / frozen: true / imported:
  2026-09-22 / ---; blocks 4; diagnostics 0` and `reader: h1 "Spaced
  repetition and the economics of attention"; frozen; paragraphs 4;
  intake tabs left 0`. So the sample imports and opens in the reader,
  frozen, with no read line.
- The address path, in the window: a synthetic paste of
  `https://example.com/` into the empty field logged `fetching`, then
  `fetched: "This domain is for use in documentation examples…"; title
  "Example Domain"; chosen books`. So the http plugin, its scope, and
  Readability all run in the real webview.

### Not verified

- A real file drop. Tauri's drag-drop event and `read_dropped` are by
  reading (the event's shape from `webview.d.ts`, the position mapped
  through `devicePixelRatio` and `elementFromPoint`); no pointer in this
  sandbox can drag a file onto the window. Dragged text through the DOM
  `drop` likewise.
- The look of the intake, by reading and by the prototype's rules.
- Pages that refuse the plugin's default user agent, or that need a
  charset other than UTF-8: `res.text()` decodes UTF-8 only.

### Decisions worth knowing

- Copy trimmed against the brief: the prototype's lede ("Paste text or a
  link below…"), the button subtitles (`read now`, `save for later`),
  and the `unread` word in the stats are gone; the placeholder is `paste
  text or a link`, the hint `or drop a .txt / .md file`, the veil `drop
  it here`. The h1 stays `Add a source`.
- The text is read by `parse`, not split into paragraphs by hand, so a
  dropped `.md` keeps its headings, cards, and front-matter; only
  `frozen`, `imported`, `read`, and `write` are ours. The prototype
  trimmed each paragraph; here the body is verbatim (FORMAT.md rule 1).
- The first line stays in the body even when it is also the derived
  title, as in the prototype; the title field is live from the text
  until you type one.
- Every folder is offered, not only the top level as in the prototype,
  since a vault with `papers/archive` would otherwise need a move
  afterwards. The root is offered too, by the vault's name.
- A pasted address is fetched only into an empty field, and only on
  paste (typing one does nothing), so an address inside pasted text is
  just text.
- No entry point in the prototype exists yet (the palette is milestone
  9), so `add a source` sits in the tree's context menu for now.
- Word count of the sample is 136, not the 174 first guessed; the test
  pins the real number, computed as the prototype computed it.

### Handoff prompt

Paste into a fresh session:

```
Read PLAN.md, FORMAT.md, BUILD-LOG.md, and spec/hashiyah/HANDOFF.md.

Context: milestones 0-7 are done. src/format/ parses and serializes vault
files (parse / serialize / meta / setField; never string-edit a file).
src/vault/ opens, walks, reads, writes, watches, and reshapes a vault over
an Fs interface; change a file with vault.update(path, mutate); tree ops
are vault.createFolder / createDoc / importDoc / rename / move / remove /
extract; the vault emits a doc event for its own writes too.
src/schedule/ grades cards with ts-fsrs (gradeItem inside vault.update),
runs the reading and writing loops (advanceRead / advanceWrite), and
builds the queue (queue(vault, now, scope), counts). src/reader/ is the
ProseMirror model of a document and src/app/Reader.tsx the editor over
it, with the read marker, the selection cue (e extracts, m opens the
composer), and a Writer that debounces body writes. src/app/ also has
the sidebar tree, panes and tabs (a tab is a path, or a special id like
INTAKE in names.ts), list lenses, and the intake (Intake.tsx; src/import/
is its pure side). Tests run in vitest over a temp copy of
src/format/__tests__/corpus/vault. ILMI_VAULT=/path npm run tauri dev
opens a vault at launch; ILMI_SMOKE=1 / reader / cards / intake exercise
the tree ops, the reader, extracts and cards, and the intake, each
logging results to the terminal.

Tooling: node is in /opt/homebrew/bin and cargo in ~/.cargo/bin; neither is
on the tool-shell PATH. Prefix every command with
export PATH=$HOME/.cargo/bin:/opt/homebrew/bin:$PATH
npm test and npm run typecheck must be green before a commit.

Do milestone 8 in PLAN.md (queue and review session) and only that one.
The queue view (today / upcoming / reading / writing / cards) and the
session shell with [ / ] over it; cards reveal and grade again / hard /
good / easy through gradeItem; reading has read on / postpone / done
with the marker live; writing has worked on it / postpone / done;
multi-blank clozes show the other blanks dimmed. Follow
spec/hashiyah/views.jsx and recall.jsx and the brief's copy rules for
every string. Queue tabs need ids that are not paths, like INTAKE. The
inspector, the strips, and the palette are milestone 9; ask before
adding a panel. Stop at the milestone's "done when". Then tick it in
PLAN.md, write notes for the next session under it, add an entry to
BUILD-LOG.md with a fresh handoff prompt, and commit.
```

---

## 2026-09-22 — milestone 6: extracts and card making

Commit `fbc2386` — *cards: the selection cue, the composer, extracts carved
into child files*.

### Done

- `src/reader/cards.ts`, pure: `cardText(spec)` (the paragraph a composed
  card is written as, refused unless `parse` reads it back as exactly that
  card; two-sided cards inline when both sides are one line, else around
  `?` / `??`; blank-line runs folded), `passage(doc, from, to)` (the text
  and child indices of the prose blocks a selection touches, cards and
  raw skipped, math verbatim), `blockAt`, `insertCard`, `setCardText`.
  `cardsKey` in `plugins.ts` marks a card-only transaction; the frozen
  plugin lets it through, so cards are made and changed on frozen sources.
- `Vault.extract(parent, { text, blocks, name?, today? })` and
  `extractName` in `src/vault/vault.ts`: the child file under the parent's
  children directory with `type: extract`, `imported`, and `read:
  due=<today> ivl=1 reps=0 pos=0` plus the parent's `pri` when it has one;
  a backref appended on each touched paragraph or card (none on headings
  or raw blocks, where it would be an orphan); `read.pos` moved to just
  past the last touched prose block, never back; then a re-walk and a
  `tree` event. Names are the passage's first five words, numbered when
  taken. `extractNode` in `src/app/vault.ts` wraps it and opens the
  parent's row.
- `src/app/Composer.tsx`: the prototype's MakeCard. `new card`, the three
  forms with their ⌘1-3 numbers, `passage` / `question` / `answer` /
  `term a` / `term b`, a preview of the blanks (`⌘B blank` until there is
  one), `⌘↵ save · ⇧⌘↵ save, another · esc cancel`. It hands back the
  card's text; the caller decides where it goes.
- `Reader.tsx`: the selection is read from the DOM on `selectionchange`
  and mapped through `posAtDOM` (a frozen surface is never focused, so the
  editor's own selection does not follow it). A non-empty passage shows
  the cue under the selection: `extract e` on sources and extracts, `make
  a card m` everywhere. Keys go through ProseMirror's `handleKeyDown` when
  the surface has focus and a window listener otherwise; both ignore
  fields and modifiers. `m` opens the composer under the selection,
  seeded with the passage; saving dispatches `insertCard` after the block
  the selection ends in and flushes the `Writer`; `save, another` keeps
  the composer and steps the anchor. `e` runs `extractNode` through the
  new `Writer.run`, after anything pending; the parent's update comes back
  as an external change and the editor rebuilds from the file, showing
  the `extract` tag and the moved marker.
- `Lenses.tsx`: the deck lens has a `+ card m` row that opens the same
  composer in the flow (the deck's `default-card` picks the form) and
  appends to the deck; `m` opens it in the active pane (`Canvas` now
  passes `active` to each lens). The folder lens is unchanged.
- CSS: the cue, the composer, `.card-pop`, `.kbd`, the deck row, all
  flattened (hairlines, 2px, no shadow, the active form underlined).
- Dev: `ILMI_SMOKE=cards` (`smoke.ts`) opens the frozen wozniak, selects
  a sentence of §4, presses `e`, then selects in §1, presses `m`, fills the
  composer with a blank, saves with ⌘↵, and logs what reached disk.
- Tests: 5 new in `src/reader/__tests__/reader.test.ts` (every form's
  text and refusals, the passage and anchor arithmetic, insertion on a
  frozen state, changing a card's text in place, and the done-when end to
  end) and 4 in `src/vault/__tests__/tree.test.ts` (naming, the carve
  with one backref line per paragraph and one changed read line, marker
  never moving back, a card tagged, a taken name numbered, a parent with
  no `read`, an extract of an extract, refusals). 180 in all.

### Verified

- `npm test` green (180 tests), `npm run typecheck` clean, `npm run
  build` ok.
- Done-when, in vitest over the temp corpus: a q&a card composed from the
  last paragraph of `wozniak-1990.md` and inserted after it adds two lines
  and parses with no diagnostics; an extract of "Cramming is mass
  repetition compressed in time." becomes
  `papers/wozniak-1990/Cramming is mass repetition compressed.md`, parses
  clean, sits under the parent in the tree, and the queue for 2026-05-27
  holds a `read` item for it and a `card` item for the new card, due now.
- Done-when, in the window (`ILMI_VAULT=<scratch copy> ILMI_SMOKE=cards
  npm run tauri dev`): `cue: extract e | make a card m`; after `e`:
  `extract papers/wozniak-1990/Cramming is mass repetition compressed.md;
  front-matter --- / type: extract / imported: 2026-09-22 / read:
  due=2026-09-22 ivl=1 reps=0 pos=0 pri=3 / ---; body 1 block;
  diagnostics 0` and `parent: 1 lines added; backref true; read
  pos=12 (already at the end); extracted paragraphs 2`; after `m`:
  `composer: seed "Each successful recall pushes the curve out further
  than the last."; forms cloze1 q&a2 bidir3; able 0`, then with a blank
  typed `preview blanks 1; able 1`, and after ⌘↵ `card: line 14 (after
  "Choosing well requires honesty…"); cards 8; diagnostics 0; surface
  cards 8`. So the DOM selection, both keys, the vault op, the composer,
  and the insert all work through the real webview and plugin-fs.

### Not verified

- The look of the cue and the composer; positions are the prototype's
  arithmetic (`rect.bottom + 8`, clamped to the window), by reading.
- ⌘B in the window (the smoke sets the text directly); `save, another`;
  ⌘1-3; the deck's `+ card` row and its `m`. All by reading.
- The cue while dragging a selection across a card or a chip.

### Decisions worth knowing

- No priority picker in the composer. FORMAT.md gives a card's `sr` line
  no `pri`, and the queue ranks cards by due; a picker would write
  nothing. Bring it back only with a format change.
- A new card is written with no id and no `sr` line: new, due now, as the
  format defines. The id arrives with the first grade (`gradeItem`).
- Backrefs only on paragraphs and cards. A selection over a heading still
  contributes its text to the extract and moves the marker past it.
- Extracts come out of sources and extracts, not drafts (the prototype
  removed extracts from writing). Cards can be made anywhere the reader
  shows, and in decks.
- `e` and `m` fire on a plain keypress with a selection, even on an
  editable document, as in the prototype; typing over a selection with
  those two letters is not possible there.
- The card editor in the inspector is not built: the inspector is
  milestone 9 and the brief says to ask before adding a panel.
  `setCardText` is the model half, tested.

### Handoff prompt

Paste into a fresh session:

```
Read PLAN.md, FORMAT.md, BUILD-LOG.md, and spec/hashiyah/HANDOFF.md.

Context: milestones 0-6 are done. src/format/ parses and serializes vault
files (parse / serialize / meta / setField; never string-edit a file).
src/vault/ opens, walks, reads, writes, watches, and reshapes a vault over
an Fs interface; change a file with vault.update(path, mutate); tree ops
are vault.createFolder / createDoc / rename / move / remove / extract; the
vault emits a doc event for its own writes too. src/schedule/ grades cards
with ts-fsrs, runs the reading and writing loops, and builds the queue.
src/reader/ is the ProseMirror model of a document (schema, toDoc /
fromDoc, plugins, marker helpers, cards.ts for composing and inserting
cards) and src/app/Reader.tsx the editor over it, with the selection cue
(e extracts, m opens src/app/Composer.tsx) and a Writer that debounces
body writes through the vault. src/app/ also has the sidebar tree, panes
and tabs (a tab is a path), and list lenses. Tests run in vitest over a
temp copy of src/format/__tests__/corpus/vault. ILMI_VAULT=/path npm run
tauri dev opens a vault at launch; ILMI_SMOKE=1 exercises the tree ops,
ILMI_SMOKE=reader the reader, ILMI_SMOKE=cards extracts and cards, each
logging results to the terminal.

Tooling: node is in /opt/homebrew/bin and cargo in ~/.cargo/bin; neither is
on the tool-shell PATH. Prefix every command with
export PATH=$HOME/.cargo/bin:/opt/homebrew/bin:$PATH
npm test and npm run typecheck must be green before a commit.

Do milestone 7 in PLAN.md (import) and only that one. Intake takes a
paste, a dropped text file, or a URL and lands a frozen source with
imported: <today>, no read line, in the chosen folder; follow
spec/hashiyah/ingest.jsx and the brief's copy rules for every string. A
URL fetch needs the Tauri http plugin or a Rust command (the webview is
CORS-bound); the vault side needs a createDoc that takes a body and
fields, through serialize. Ask before adding anything the prototype does
not show. Stop at the milestone's "done when". Then tick it in PLAN.md,
write notes for the next session under it, add an entry to BUILD-LOG.md
with a fresh handoff prompt, and commit.
```

---

## 2026-09-22 — milestone 5: reader

Commit `b84ad6e` — *reader: ProseMirror over the document, KaTeX chips,
frozen sources, the read marker*.

### Done

- `prosemirror-{model,state,view,transform,keymap,commands,history,
  inputrules,gapcursor}` and `katex` added; `jsdom` as a dev dependency
  for one DOM-level test.
- `src/reader/`, pure and tested without a window: `schema.ts` (doc of
  paragraph / heading / card / raw, inline text and math; cards, raw
  blocks, and math are atoms carrying their source in attrs), `convert.ts`
  (`toDoc` / `fromDoc`, `mathSplit` by the format's `mathSpanEnd`,
  `textOf`, `cardDue`), `marks.ts` (`editorialRanges`), `marker.ts`
  (`proseIndices`, `cursorIndex`, `pickPos`, `setReadPos`), `plugins.ts`
  (`makeState`: heading and math input rules, chips re-forming when the
  caret leaves a block, editorial decorations, `frozenPlugin`, the marker
  plugin with `settled` decorations, keys: undo / redo, Shift-Enter for a
  line break inside a paragraph, Escape blurs in the view).
- `src/app/Reader.tsx`: the lens for sources, extracts, and drafts. Meta
  row: where the file sits (folders, and the parent for an extract), the
  frozen / editable toggle (not on drafts), `N cards, M due` (drafts also
  `N words`). The surface is one `EditorView` with `CardView` and
  `MathView` node views; the `Writer` debounces body writes (500 ms),
  serializes them, flushes on blur and unmount, and tells the vault's
  report of its own write from an external change by the text it expected
  (`claim`). External changes win: pending writes are dropped and the
  editor rebuilds with the caret kept. After an own write, if nothing was
  typed since and the file's blocks differ from the editor's (a typed
  `::` line became a card, a `#` line a heading), the editor rebuilds from
  the file. The read marker: gutter, rule, edge and knob as in the
  prototype; pointer down or move sets `pos` in the editor state, pointer
  up writes it. `src/app/reader.css` holds the rules.
- `Vault.commit` now emits `doc` for the vault's own writes, so the store's
  `DocInfo` (counts, frozen, read) and any other pane on the same file
  follow an edit. The own-write test now expects that one event and still
  none from the watcher's echo.
- `DocLens` in `Lenses.tsx` is the `Reader`; the read-only page and its
  CSS are gone.
- Dev: `ILMI_SMOKE=reader` (`smoke.ts`) opens `papers/wozniak-1990.md`,
  reports the rendered blocks and marker, types into a frozen paragraph,
  thaws, types again, drags the marker, and logs what reached disk.
  `main.tsx` forwards renderer errors and unhandled rejections to the log
  plugin in dev.
- Tests: 15 in `src/reader/__tests__/reader.test.ts` (fixed point over
  every corpus file, math splitting, empty and split paragraphs, atoms
  passed through, the one-line diff for a paragraph edit, the frozen
  refusal, chip → text → chip round trip, marker arithmetic and snapping,
  settled decorations, `pos` written as one line and read back after
  reopening the vault, clamping) and 4 in
  `src/app/__tests__/reader-view.test.ts` under jsdom (node views over the
  corpus file, KaTeX output, editorial decorations, card forms, due labels).

### Verified

- `npm test` green (171 tests), `npm run typecheck` clean, `npm run build`
  ok.
- Done-when, in vitest: inserting text into the "Cramming is mass…"
  paragraph of `wozniak-1990.md` through a ProseMirror transaction and
  `vault.update` changes one line on disk; a state built with
  `frozen: true` returns the same document for a text insertion, while the
  marker still moves; `setReadPos(doc, 5)` changes only the `read:` line
  and a fresh `Vault.open` reads `pos=5` back.
- Done-when, in the window (`ILMI_VAULT=<scratch copy> ILMI_SMOKE=reader
  npm run tauri dev`): `blocks 19, cards 7`, `rule 0px + 2038px`, `frozen
  frozen; editable false`, `frozen refused: true`; after the toggle,
  `typed: changed lines [3,56]` (line 3 is `frozen: false` from the toggle,
  line 56 the paragraph); a pointer in the gutter beside the third
  paragraph gave `read: due=2026-06-01 ivl=9 reps=4 pos=5 pri=3`, `rule
  629px`, `settled 4`. So typing, the frozen refusal, the toggle, the
  marker, and the writes all work through the real webview and plugin-fs.

### Not verified

- The look. No screenshot path in this sandbox; the CSS is by reading and
  by the prototype's rules. Fonts, KaTeX metrics, and the marker's
  alignment with the text were not seen.
- The heading input rule and math input rule in the window (they run in
  `handleTextInput`, which `execCommand` in the smoke does not exercise).
  The chip round trip is covered at state level.
- An external edit arriving while the reader is open: the branch is
  tested through `claim` logic by reading, not by a test.
- Undo across a rebuild: history is reset when the editor rebuilds from
  the file.

### Decisions worth knowing

- `read.pos` is 1-based "blocks read": the rule reaches the bottom of the
  pos-th prose block, and the blocks above that one are dimmed (the
  prototype's cursor block stays undimmed as the place to resume). The
  gutter never sets 0, as in the prototype; `pos=0` on disk shows the
  knob at the top.
- Empty paragraphs are dropped on write (a blank line is a separator); a
  split paragraph keeps its id on the first half only.
- An unscheduled card's state reads `new`, not the prototype's `today`.
- Paragraph line breaks are `\n` in the text node under `white-space:
  pre-wrap`, matching the format's verbatim rule; Shift-Enter inserts one.
- The editor does not police what a line means: typing `a :: b` in a
  paragraph is a paragraph until the file is written and read back as a
  card, at which point the editor rebuilds from the file. The file wins.
- Left out of this milestone, deliberately: the draft lens's done / reopen
  row (milestone 8 has the writing actions), clicking a card to open it
  (needs the inspector), a placeholder on an empty document.

### Handoff prompt

Paste into a fresh session:

```
Read PLAN.md, FORMAT.md, BUILD-LOG.md, and spec/hashiyah/HANDOFF.md.

Context: milestones 0-5 are done. src/format/ parses and serializes vault
files (parse / serialize / meta / setField; never string-edit a file).
src/vault/ opens, walks, reads, writes, watches, and reshapes a vault over
an Fs interface; change a file with vault.update(path, mutate); tree ops
are vault.createFolder / createDoc / rename / move / remove; the vault
emits a doc event for its own writes too. src/schedule/ grades cards with
ts-fsrs, runs the reading and writing loops, and builds the queue.
src/reader/ is the ProseMirror model of a document (schema, toDoc /
fromDoc, plugins, marker helpers) and src/app/Reader.tsx the editor over
it, with a Writer that debounces body writes through the vault. src/app/
also has the sidebar tree, panes and tabs (a tab is a path), and list
lenses. Tests run in vitest over a temp copy of
src/format/__tests__/corpus/vault. ILMI_VAULT=/path npm run tauri dev
opens a vault at launch; ILMI_SMOKE=1 exercises the tree ops and
ILMI_SMOKE=reader the reader, logging results to the terminal.

Tooling: node is in /opt/homebrew/bin and cargo in ~/.cargo/bin; neither is
on the tool-shell PATH. Prefix every command with
export PATH=$HOME/.cargo/bin:/opt/homebrew/bin:$PATH
npm test and npm run typecheck must be green before a commit.

Do milestone 6 in PLAN.md (extracts and card making) and only that one.
Extracts are child files under the parent's directory with type: extract
and their own read line, backrefs on the touched paragraphs, the marker
moved past them; the composer inserts a card block after the selected
paragraph. Follow spec/hashiyah/reader.jsx (MakeCard, the selection cue,
e and m) and the brief's copy rules for every string. The inspector does
not exist yet; ask before adding a panel for the card editor. Stop at the
milestone's "done when". Then tick it in PLAN.md, write notes for the next
session under it, add an entry to BUILD-LOG.md with a fresh handoff
prompt, and commit.
```

---

## 2026-09-22 — milestone 4: tree, sidebar, lenses

Commit `80648ae` — *tree: sidebar, tree operations over disk, panes and lenses*.

### Done

- `src/vault/paths.ts`: vault-relative path arithmetic (`dirOf`, `nameOf`,
  `childDirOf`, `rekey`, `within`, `cleanName`).
- `Vault` gained `createFolder`, `createDoc`, `rename`, `move`, `remove`.
  Each waits for pending watcher work, goes to disk through `Fs`, re-keys
  the cache, re-walks, and emits `tree`; rename and move emit a new
  `moved { from, to }` event, delete emits `gone` per cached document. A
  document's `name/` directory travels with it. Renaming an extract
  rewrites its parent's `<!-- extract -->` backrefs through `update`, one
  line each. Names are taken when `name` or `name.md` exists, so a
  document never adopts a stray folder as children and a folder never
  becomes a document's children by accident. `NEW_NAMES` holds the default
  names; free names get ` 2`, ` 3`. New drafts get `started` and
  `write: due=<today> ivl=1 reps=0`. `VaultState.sidebar` added.
- `src/app/panes.ts`: the prototype's pane and tab model as pure functions
  (`openTab` with ⌘ / ⌘⇧ semantics, `closeTab`, `splitPane` up to three,
  `closePane`, `retarget` after a move, `dropTabs` after a delete). A tab
  is just a path; kind and title come from the store at render time.
- `src/app/store.ts`: `tree`, `docs` (a `DocInfo` per document: type,
  title, frozen, card and due counts, read and write schedules), `open`,
  `sidebar`, `panes`. `src/app/vault.ts` mirrors vault events into it,
  persists `folders` / `tab` / `sidebar` to `.ilmi/state.json` with a
  300 ms debounce (open state is pruned against the tree on every `tree`
  event, so a deleted folder does not linger in `folders`), and wraps the
  ops (`createNode`, `renameNode` also updates `title` when the document
  has one, `moveNode`, `removeNode`).
- `Tree.tsx`: the sidebar tree after `tree.jsx`: chevrons, per-type glyph
  and colour, count or state in the margin (`3 cards · 1 due`, `done`,
  `due`), click opens, chevron folds, double-click or F2 renames inline,
  drag moves beside a row or into a folder, right-click menu with new
  source / folder / deck / draft, rename, move to… (every folder but the
  node's own subtree and current parent), delete. `Canvas.tsx`: panes and
  tab bars (⊟ splits, × closes, middle-click closes a tab). `Lenses.tsx`:
  folder and deck lenses as lists with the prototype's `+ source` row and
  card rows; source / extract / draft render as a read-only page until
  milestone 5. `names.ts` and `useDoc.ts` are the shared helpers.
- `App.tsx`: sidebar with drag-resize handle (drag under 80 px hides it,
  drag out again shows it), ⌘⇧E toggles, ⌘W closes a tab, ⌘\ splits.
- Tauri: `allow_vault` now also grants `vault/.ilmi` by name, because the
  fs plugin's global scope matches with `require_literal_leading_dot` on
  unix whatever the config says, so `vault/**` never reached `.ilmi/` and
  `loadState` threw on the first launch. A macOS menu without Close
  Window, so ⌘W reaches the webview. `initial_vault` became `dev_env`;
  `ILMI_SMOKE=1` runs `src/app/smoke.ts`, which drives every tree op
  through the real adapter and logs each result.
- Tests: 21 in `src/vault/__tests__/tree.test.ts` (path helpers, create
  with numbering and inside a document, draft and deck front-matter,
  rename with children and cache re-keying, extract rename fixing the
  parent's backref by one line, folder rename, refusals, move with
  children, into a document, refusals, delete with `gone` events, no
  double `tree` event from the watcher echo, sidebar state) and 6 in
  `src/app/__tests__/panes.test.ts`.

### Verified

- `npm test` green (152 tests), `npm run typecheck` clean, `npm run build`
  ok, `cargo check` ok.
- Done-when, in vitest over the temp corpus: renaming `wozniak-1990` moves
  `papers/wozniak-1990.md` and `papers/wozniak-1990/` together, the tree
  and the cache follow, and the `moved` event carries both paths; renaming
  `woz-ex1` changes exactly one line of the parent (`<!-- extract
  woz-first -->`); folder rename, move with children, move into a
  document's children directory, delete of a document with children, and
  every refusal (own subtree, taken name, missing target, bad name) are
  covered.
- Done-when, in the window: `ILMI_VAULT=<scratch copy> ILMI_SMOKE=1 npm run
  tauri dev` logged, through plugin-fs: `folder untitled folder`, `deck
  untitled folder/untitled deck.md`, `renamed untitled folder/smoke
  deck.md`, `moved papers/smoke deck.md`, `moved with children untitled
  folder/wozniak-1990.md → untitled folder/wozniak-1990.md, untitled
  folder/wozniak-1990/woz-ex1.md`, `moved back papers/wozniak-1990.md`,
  `renamed extract papers/wozniak-1990/woz-first.md; parent has backref:
  true`, `removed; tree unchanged: true`, `state: {"folders":["","papers"]}`.
  So the Tauri adapter renames across directories, removes non-empty
  directories, and writes `.ilmi/state.json`, which was the open question
  from milestone 2.

### Not verified

- The window itself was not seen: no screenshot path in this sandbox and
  the Chrome extension does not reach a Tauri webview. Layout and CSS are
  by reading; the tree, tabs, menus, drag, and rename were not clicked.
- The keyboard bindings and the macOS menu change in the window.
- `Fs.watch` events for our own rename arriving through plugin-fs; in
  vitest they do not produce a second `tree` event.

### Decisions worth knowing

- Delete is immediate and permanent, as in the prototype: no confirm, no
  trash. Worth revisiting once there is an undo or a trash in the plan.
- Rename edits the file name; a document with a `title` field gets the
  same text as its title, so what the row shows and what you typed agree.
- The tree shows folders and documents only. The prototype's card leaves
  under sources and decks were left out (the milestone lists documents).
- Saved queries, queue tabs, the top and bottom strips, and the inspector
  wait for milestones 8 and 9; the shell grid is two columns for now.
- `Panes.tsx` cannot live beside `panes.ts` on a case-insensitive disk
  (tsc TS1149), hence `Canvas.tsx`.
- `openInitialVault` runs once even though StrictMode mounts the effect
  twice; two concurrent opens ran the smoke script twice and the runs
  collided on names.

### Handoff prompt

Paste into a fresh session:

```
Read PLAN.md, FORMAT.md, BUILD-LOG.md, and spec/hashiyah/HANDOFF.md.

Context: milestones 0-4 are done. src/format/ parses and serializes vault
files (parse / serialize / meta / setField; never string-edit a file).
src/vault/ opens, walks, reads, writes, watches, and reshapes a vault over
an Fs interface; change a file with vault.update(path, mutate); tree ops
are vault.createFolder / createDoc / rename / move / remove. src/schedule/
grades cards with ts-fsrs, runs the reading and writing loops, and builds
the queue. src/app/ has the sidebar tree, panes and tabs (a tab is a
path), and list lenses; DocLens in src/app/Lenses.tsx is a read-only
placeholder for the reader. Tests run in vitest over a temp copy of
src/format/__tests__/corpus/vault. ILMI_VAULT=/path npm run tauri dev
opens a vault at launch; add ILMI_SMOKE=1 to exercise the tree ops through
Tauri and log results.

Tooling: node is in /opt/homebrew/bin and cargo in ~/.cargo/bin; neither is
on the tool-shell PATH. Prefix every command with
export PATH=$HOME/.cargo/bin:/opt/homebrew/bin:$PATH
npm test and npm run typecheck must be green before a commit.

Do milestone 5 in PLAN.md (reader: the unified document editor) and only
that one. ProseMirror over Doc.blocks, edits written back through
vault.update and serialize, KaTeX for math, frozen sources lock prose, the
left-margin read marker writes read.pos. Follow spec/hashiyah/reader.jsx
for behavior and the brief's copy rules for every string. Stop at the
milestone's "done when". Then tick it in PLAN.md, write notes for the next
session under it, add an entry to BUILD-LOG.md with a fresh handoff prompt,
and commit.
```

---

## 2026-09-21 — milestone 3: scheduler

Commit `b5505bb` — *schedule: ts-fsrs grading, reading and writing loops, queue query*.

### Done

- `ts-fsrs` 5.4 added. `src/schedule/card.ts`: `toFsrs` / `fromFsrs` map a
  `CardSchedule` onto a ts-fsrs `Card` per FORMAT.md §6.2; `grade` and
  `preview` wrap `fsrs().next` / `.repeat` with default parameters (fuzz
  off, learning steps on). Output rounded to two decimals; `last` is set to
  `now` as a UTC instant; `due` is a day when `ivl` ≥ 1, else an instant.
- `read.ts` and `write.ts`: the reading loop (`readOn`, `postpone`, done
  drops `read`) and the writing loop (`workedOn`, `postpone`, `done` keeps
  the line), plus `advanceRead` / `advanceWrite` over a `Doc`.
- `queue.ts`: `docItems` / `queueItems` / `queue(vault, now, scope)`,
  `counts`, `cardGroups`, `gradeItem` (id assignment, blank numbering, one
  line rewritten), `numberBlank`, `newId`.
- `dates.ts`: local-day arithmetic, UTC instants, `daysBetween` by UTC date.
- 30 tests in `src/schedule/__tests__/schedule.test.ts`: date arithmetic,
  the ts-fsrs mapping both ways, grading new / review / relearning cards,
  determinism and unknown-attribute survival, both loops through the
  document, cloze group keys and numbering, and over a temp copy of the
  corpus: the counts for 2026-05-27, multi-blank expansion, fallback to the
  bare line, sort order, reading progress, one-line diff on grade, one-line
  diff on grading one blank of a multi-blank card, numbering an unnumbered
  blank (text line + one new `sr c1` line), id assignment for an
  unscheduled card, id collision avoidance, and locating a card by id after
  the file shifted.

### Verified

- `npm test` green (125 tests), `npm run typecheck` clean, `npm run build`
  ok.
- Done-when 1: grading `cw1-paths` good on 2026-05-27 through `vault.update`
  changes line 15 of `papers/wozniak-1990.md` and nothing else; the line is
  `<!-- sr due=2026-07-11 st=review s=44.92 d=3.79 r=10 l=0 ivl=45
  last=2026-05-27T12:00:00Z g=3 -->`.
- Done-when 2: the queue for 2026-05-27 over the corpus is today 17 (13
  cards, 3 reading, 1 writing), upcoming 13, cards 24, reading 4, writing 2.
  The prototype's `data.jsx` gives today 16 (11 / 4 / 1) and upcoming 14.
  The gap is entirely in the data, not the rules, and each difference was
  checked by hand: the corpus numbers `cw2-min` as c1/c2 with c2 due
  2026-06-01 (prototype: two lone blanks, both due), adds `cd-resurface`
  (two new groups, due), adds the unscheduled `ein Wort ohne Karte` (new,
  due), lacks `atomic-notes.md` (a due topic) and lacks
  `commonplace-book-three.md` (two upcoming groups).

### Not verified

- Nothing in the window; this milestone has no UI.
- ts-fsrs's learning steps in a live session: a card graded again is due
  ten minutes later as an instant, and the queue treats an instant as due
  when it is ≤ `now`. That is exercised in the test, not in use.
- Time zones east of UTC+11 would shift the local day of the test `now`;
  the tests are pinned to noon UTC, which covers this machine.

### Decisions worth knowing

- Postpone does not count as a pass (`reps` unchanged) for reading or
  writing; the prototype bumped it. FORMAT.md defines reps as passes made.
- A single-group cloze grades its `sr c1` line if the file has one, else the
  bare line. A multi-group cloze always writes group lines; the bare line is
  read as a fallback and left alone.
- Card items carry `pri` 2 when due and 3 otherwise, copied from the
  prototype so due cards and due topics interleave at the same rank.
- `reading.*` / `writing.*` namespaces exist because both loops have
  `postpone`.

### Handoff prompt

Paste into a fresh session:

```
Read PLAN.md, FORMAT.md, BUILD-LOG.md, and spec/hashiyah/HANDOFF.md.

Context: milestones 0-3 are done. src/format/ parses and serializes vault
files (parse / serialize / meta / setField; never string-edit a file).
src/vault/ opens, walks, reads, writes, and watches a vault over an Fs
interface; change a file with vault.update(path, mutate). src/schedule/
grades cards with ts-fsrs, runs the reading and writing loops, and builds
the queue (queue(vault, now, scope), gradeItem inside vault.update). Tests
run in vitest over a temp copy of src/format/__tests__/corpus/vault. The
app (src/app/) opens a vault and lists its documents; ILMI_VAULT=/path npm
run tauri dev opens one at launch.

Tooling: node is in /opt/homebrew/bin and cargo in ~/.cargo/bin; neither is
on the tool-shell PATH. Prefix every command with
export PATH=$HOME/.cargo/bin:/opt/homebrew/bin:$PATH
npm test and npm run typecheck must be green before a commit.

Do milestone 4 in PLAN.md (tree: sidebar and lenses) and only that one.
Every tree operation goes through disk via the Fs interface and the Vault;
test them in vitest over the temp corpus. Follow spec/hashiyah/tree.jsx and
app.jsx for behavior and the brief's copy rules for every string. Stop at
the milestone's "done when". Then tick it in PLAN.md, write notes for the
next session under it, add an entry to BUILD-LOG.md with a fresh handoff
prompt, and commit.
```

---

## 2026-09-16 — milestone 2: vault layer

Commit `3d32a17` — *vault: open, walk, read, write, watch over an Fs interface*.

### Done

- `src/vault/`: `Fs` interface (`fs.ts`), tree walker (`walk.ts`), `Vault`
  (`vault.ts`) with `open`, `read`, `update`, `write`, `changed`, `watch`,
  `subscribe`, `loadState`, `saveState`. Pure; no Tauri import.
- Adapters: `node-fs.ts` (node:fs, tests) and `tauri-fs.ts`
  (`@tauri-apps/plugin-fs`, app).
- Conflict rule: `update(path, mutate)` re-reads and re-applies when the
  file's mtime or size moved since it was read. Atomic writes via
  `name.md.ilmi-tmp` + rename. Our own write is recorded with its new stamp,
  so the watcher's echo of it is ignored.
- App: `src/app/vault.ts` opens a vault (dialog, or `ILMI_VAULT` in dev),
  watches it, and publishes `vault` + `files` to the store. `App.tsx` shows an
  "Open vault" button, then a plain list of document paths. Component CSS
  starts in `src/app/app.css`.
- Tauri: `allow_vault` and `initial_vault` commands in `lib.rs`; fs plugin
  `watch` feature; `fs:allow-*` permissions and `log:default` in the
  capability; `plugins.fs.requireLiteralLeadingDot: false` in
  `tauri.conf.json`. `@tauri-apps/plugin-log` added for dev logging.
- 16 tests in `src/vault/__tests__/vault.test.ts` over a temp copy of the
  corpus vault: tree shape, dot-dir and non-md skipping, diagnostics kept,
  one-line diff for a schedule change, atomic write, concurrent edit keeps
  both sides, whole-doc overwrite refused on conflict, own write not mistaken
  for external, external change re-read and reported, appear/disappear
  re-walks, real `fs.watch` delivery, state.json defaults and round-trip.

### Verified

- `npm test` green (95 tests), `npm run typecheck` clean, `npm run build` ok.
- `ILMI_VAULT=<corpus vault> npm run tauri dev` opened the window and the
  renderer logged all 11 document paths of the sample vault through the log
  plugin, so `readDir`/`stat`/`watch` went through plugin-fs with the
  widened scope. The vault watcher test was run five times without a flake.

### Not verified

- The window itself was not seen (no screenshot path in this sandbox); the
  list is verified by the log line, the CSS by reading.
- Watch events arriving from plugin-fs into `vault.changed` in the window.
  The Node path is tested; the Tauri `watch` command registered and returned.
- The "Open vault" dialog path was not clicked. It uses the same `openVault`
  as the env-var path, plus the dialog's own scope grant.

### Gotchas for later

- `tauri-plugin-fs` needs `features = ["watch"]` or the `watch` command does
  not exist ("Command watch not found" in the webview console).
- The dialog's scope grant is `vault/**`, and on unix that glob skips
  dot-paths unless `requireLiteralLeadingDot` is false in the plugin config
  (not the capability).
- React StrictMode runs the open effect twice in dev; `openVault` closes the
  previous vault first, so it is harmless but shows as two log lines.
- `ILMI_VAULT` is read only in debug builds (`cfg!(debug_assertions)`).

### Handoff prompt

Paste into a fresh session:

```
Read PLAN.md, FORMAT.md, BUILD-LOG.md, and spec/hashiyah/HANDOFF.md.

Context: milestones 0-2 are done. src/format/ parses and serializes vault
files (parse / serialize / meta / setField; never string-edit a file).
src/vault/ opens, walks, reads, writes, and watches a vault over an Fs
interface; change a file with vault.update(path, mutate), which re-reads and
re-applies on conflict. Tests run in vitest over a temp copy of
src/format/__tests__/corpus/vault. The app (src/app/) opens a vault and lists
its documents; ILMI_VAULT=/path npm run tauri dev opens one at launch.

Tooling: node is in /opt/homebrew/bin and cargo in ~/.cargo/bin; neither is
on the tool-shell PATH. Prefix every command with
export PATH=$HOME/.cargo/bin:/opt/homebrew/bin:$PATH
npm test and npm run typecheck must be green before a commit.

Do milestone 3 in PLAN.md (scheduler: ts-fsrs and the three loops) and only
that one. Pure functions and unit tests, no UI. Stop at the milestone's
"done when". Then tick it in PLAN.md, write notes for the next session under
it, add an entry to BUILD-LOG.md with a fresh handoff prompt, and commit.
```

---

## 2026-09-16 — milestone 1: app scaffold

Commit `0c47994` — *scaffold: Vite + React + TypeScript + Tauri, tokens, three themes*.

### Done

- Vite + React 19 + TypeScript app, rooted at the repo. `index.html` loads
  `src/app/main.tsx`. `src/format/` untouched.
- `src/app/store.ts`: Zustand store with `theme` and `density`. Console
  toggle until the tweaks panel exists: `ilmi.theme('dark')`,
  `ilmi.cycleTheme()`, `ilmi.density(0.8)`.
- `src/app/tokens.css`: paper / ink / gold as CSS custom properties, three
  themes on `data-theme` (`light` / `dark` / `eink`), `--radius: 2px`, no
  shadows, e-ink strips shadows and transitions globally. Consolidated from
  the prototype's `styles.css` base rules plus its trailing flattening block.
  No component rules.
- Fonts bundled via `@fontsource` (IBM Plex Sans, IBM Plex Mono, Source
  Serif 4 variable, Literata variable). No CDN.
- Tauri v2 shell in `src-tauri/`, crate `ilmi`, plugins `fs` and `dialog`
  registered in `lib.rs` and granted in `capabilities/default.json`.
- `README.md` run section. `package.json` scripts: `dev`, `build`, `tauri`,
  `test`, `typecheck`.
- `src/app/__tests__/store.test.ts` covers the theme cycle.

### Verified

- `npm run tauri dev` opened the window on this machine after the first
  Rust compile (about 35 s).
- `npm test` green (79 tests), `npm run typecheck` clean, `npm run build`
  produces `dist/`.

### Not verified

- The console theme toggle was not exercised inside the window. Screen
  capture is blocked in the tool sandbox and the Chrome extension did not
  respond. Covered by the store test and the CSS rules only. Run
  `npm run tauri dev`, open devtools, and try `ilmi.theme('dark')` once.

### Environment changes

- Rust 1.98 installed with rustup, minimal profile, `--no-modify-path`.
  Cargo lives in `~/.cargo/bin` and is not on the login `PATH`.

### Gotchas for later

- Vite 8 ships without esbuild; keep `build.minify` a boolean.
- `vite.config.ts` doubles as the vitest config, so import `defineConfig`
  from `vitest/config`.
- `fs:default` only reads inside app-private dirs. Milestone 2 needs
  `fs:allow-read-dir` and friends scoped to the picked vault, or an
  `fs:scope` entry in the capability.

### Handoff prompt

Paste into a fresh session:

```
Read PLAN.md, FORMAT.md, BUILD-LOG.md, and spec/hashiyah/HANDOFF.md.

Context: milestone 1 (app scaffold) is done and committed as 0c47994. The
Vite + React + TypeScript app is in src/app/, the Tauri v2 shell in
src-tauri/, tokens and the three themes in src/app/tokens.css, the Zustand
store in src/app/store.ts. src/format/ is the only code that touches vault
files; use parse / serialize / meta / setField, never string-edit a file.

Tooling: node is in /opt/homebrew/bin and cargo in ~/.cargo/bin; neither is
on the tool-shell PATH. Prefix every command with
export PATH=$HOME/.cargo/bin:/opt/homebrew/bin:$PATH
npm test and npm run typecheck must be green before a commit.

Do milestone 2 in PLAN.md (vault layer: open, walk, read, write, watch) and
only that one. Keep src/vault/ pure over an Fs interface so its tests run in
vitest against a temp directory without Tauri; add a thin adapter over
@tauri-apps/plugin-fs for the app, and widen the fs capability in
src-tauri/capabilities/default.json to the picked vault directory. Stop at
the milestone's "done when". Then tick it in PLAN.md, write notes for the
next session under it, add an entry to BUILD-LOG.md with a fresh handoff
prompt, and commit.
```
