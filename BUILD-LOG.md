# ilmi — build log

One entry per session, newest first. `PLAN.md` holds the milestone list and
the per-milestone notes; this file holds the narrative: what was done, what
was verified, what was not, and the prompt to resume with.

---

## 2026-10-17 — milestone 10: priority, one scale at document level, the queue sorted by it

Commit `TBD` — *priority: one 0–100 scale on the document, a card's own on
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
