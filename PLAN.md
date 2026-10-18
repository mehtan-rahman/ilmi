# ilmi — build plan

Stateless build plan. Each session: read this file, do the first unchecked
milestone, stop at its *done when*, tick it, add notes, log it, commit.
Nothing else. `BUILD-LOG.md` is the session-by-session narrative and always
carries the latest handoff prompt.

## Kickoff prompt (paste into a fresh session)

The current handoff prompt is at the top of `BUILD-LOG.md`. The generic form:

```
Read PLAN.md, FORMAT.md, BUILD-LOG.md, and spec/hashiyah/HANDOFF.md. Do the
first unchecked milestone in PLAN.md and only that one. Stop at its "done
when". Then tick it, write notes for the next session under it, add an entry
to BUILD-LOG.md with a fresh handoff prompt, and commit.
```

## Ground rules

- The prototype in `spec/hashiyah/` is the decided spec for behavior and feel.
  `spec/hashiyah/BUILD-PROMPT.md` wins on architecture. This file wins on order.
- `FORMAT.md` is the contract for anything that touches disk. Change the
  format only with a corpus file and a test that shows why.
- Tooling: node lives in `/opt/homebrew/bin`, cargo in `~/.cargo/bin`; prefix commands with
  `export PATH=$HOME/.cargo/bin:/opt/homebrew/bin:$PATH`. `npm test` must be green before a
  commit. `npm run typecheck` too.
- One milestone per session, one commit per milestone (more is fine, fewer is
  not). Commit message names the milestone.
- Ask before adding a screen, section, or setting not in the brief or the
  prototype. Copy rules from the brief apply to every string in the UI.
- Not in any milestone below: margin-gloss text flow, mobile, collaboration,
  plugins, AI features.

## Milestones

### [x] 0. Format — `FORMAT.md`, parser, serializer, round-trip tests
Done 2026-09-16, commit `b97bb3f`.
Notes: `src/format/` is the only code that reads or writes vault files. Use
`parse`/`serialize`/`meta`/`setField`; never string-edit a file. Unnumbered
cloze blanks have no schedule key until the app numbers them (`nextGroup`).

### [x] 1. App scaffold — Vite + React + TypeScript + Tauri
Done 2026-09-16.
Notes: Vite root is the repo root (`index.html` → `src/app/main.tsx`);
`vite.config.ts` doubles as the vitest config, so import `defineConfig` from
`vitest/config` there. Vite 8 has no esbuild; keep `minify` boolean. Tokens in
`src/app/tokens.css` (gold baked in as the accent, `--radius: 2px`, no
shadows; eink strips shadows/transitions globally). Fonts are bundled via
`@fontsource`, no CDN. Store is `src/app/store.ts`; `window.ilmi.theme(name)`
and `ilmi.cycleTheme()` are the console toggle until milestone 9. Rust was
installed with rustup (minimal profile, `~/.cargo/bin`, not on the login
`PATH`), so prefix `export PATH=$HOME/.cargo/bin:/opt/homebrew/bin:$PATH`.
Tauri: `src-tauri/`, crate `ilmi`, plugins `fs` + `dialog` registered in
`lib.rs` and granted in `capabilities/default.json` (`fs:default` only reads
inside app dirs; milestone 2 needs `fs:allow-read-dir` etc. scoped to the
picked vault, or a `fs:scope` entry). The Chrome extension was unreachable, so
the console toggle was verified by the store test, not in the window.

### [x] 2. Vault layer — open, walk, read, write, watch
Done 2026-09-16, commit `3d32a17`.
Notes: `src/vault/` is pure over an `Fs` interface (`fs.ts`); `node-fs.ts`
backs the tests, `tauri-fs.ts` the app. `Vault.open(fs, root)` walks the tree
(`walk.ts`: folders first, then docs, `name.md` + `name/` attached as the
doc's children, dot-dirs skipped). Change a file with
`vault.update(path, mutate)`: it clones the cached doc, applies `mutate`,
stats, and if the stamp (mtime + size) moved it re-reads and re-applies, so
an external edit and ours both land. `vault.write(path, doc)` is the
whole-doc form and throws `VaultConflict` instead. Writes go to
`name.md.ilmi-tmp` then rename. The watcher calls `vault.changed(paths)`;
events are `tree` / `doc` / `gone` via `subscribe`. `loadState` / `saveState`
merge into `.ilmi/state.json` (`folders`, `tab`). The app side is
`src/app/vault.ts` (module singleton; the store only gets `vault` and
`files`). Tauri: the dialog grants `vault/**` in the fs scope when a
directory is picked (`recursive: true` matters), a Rust command `allow_vault`
does the same for paths from elsewhere, `plugins.fs.requireLiteralLeadingDot`
is off so that glob reaches `.ilmi/`, the fs plugin needs the `watch` cargo
feature, and `capabilities/default.json` lists the `fs:allow-*` commands.
Dev only: `ILMI_VAULT=/path npm run tauri dev` opens a vault at launch and
logs its document list to the terminal through the log plugin; that is how
this milestone was verified without a screenshot. Not verified in the
window: watch events arriving through plugin-fs (they do in vitest through
node's fs.watch). Not done: remembering the last vault across launches (needs
a home outside the vault, and `allow_vault` on relaunch).
- `src/vault/`: open a directory; walk it into a tree per `FORMAT.md` §1
  (folders, documents, `name.md` + `name/` children, dot-dirs ignored).
- Read a document → `Doc` via `parse`; write via `serialize`, atomic
  (temp + rename), preserving the file's mtime expectations.
- Watch for external changes; re-read a changed file and re-parse. Never
  overwrite a file whose mtime moved since we read it: re-read, re-apply the
  in-memory change, write. Diagnostics from `parse` are kept per file.
- `.ilmi/state.json` for view state (open folders, last tab). Optional, never
  required.
- Tests against a temp directory: external edit shows up; an app write that
  changes one card's schedule changes one line on disk; concurrent edit does
  not lose either side.
- Done when: the tests above pass, and the Tauri window lists the sample
  vault's file names (plain list, no tree UI yet).

### [x] 3. Scheduler — ts-fsrs and the three loops
Done 2026-09-21, commit `b5505bb`.
Notes: `src/schedule/` is pure over the format's schedule types plus a queue
query over a `Vault`; no Tauri, no UI. `grade(sched, 1–4, now)` wraps
ts-fsrs 5 with default parameters: fuzz off, short-term learning steps on
(again → 1 min, good on a new card → 10 min), so `due` is stored as an
instant while `ivl` is 0 and as a local day once it is ≥ 1. `toFsrs` /
`fromFsrs` are the mapping; `elapsed_days` is derived from `last` by UTC
date, as ts-fsrs counts it; stability and difficulty were rounded to two
decimals until 2026-09-23, when a simulation showed that drifting
intervals from ts-fsrs's own by up to 8%; they are stored at full
precision now (`fsrs-sim.test.ts`). Reading: `reading.readOn` (ivl × 1.6, `pos` only moves forward),
`reading.postpone` (tomorrow); done drops the field. Writing:
`writing.workedOn` (ivl × 1.5, clears `done`), `writing.postpone`,
`writing.done` (keeps the line). `advanceRead` / `advanceWrite` are the
doc-level forms through `setField`. One deviation from the prototype:
postpone does not bump `reps`, because FORMAT.md defines reps as passes
made. Queue: `queue(vault, now, scope)` reads every document through the
cache; `queueItems(docs, now)` is the pure core. Items are `card` / `read`
/ `write`, each with `dueAt` (a day is local midnight; no due means now)
and `pri` (cards are 2 when due and 3 otherwise, as in the prototype;
topics and drafts carry their own, default 2); sort is pri, then due, then
document order. A cloze yields one item per group: `{ n }` for a numbered
group, `{ blank: i }` for the i-th blank when it is unnumbered; a group's
schedule is its `sr cN` line, else the bare line. `gradeItem(doc, item,
grade, now)` runs inside `vault.update`: it assigns an id when the card
has none (`newId`, injectable for tests), numbers an unnumbered blank on a
multi-blank card (`numberBlank`, lowest unused N), and rewrites one line,
the group's or the bare one. It finds the card by id, else by block index
and text. `dayOf` / `addDays` are local-day, `instantOf` is UTC. Tests use
`2026-05-27T12:00:00Z` so the local day is the same from UTC-12 to UTC+11.
Counts for that day over the corpus: today 17 (13 cards, 3 reading, 1
writing), upcoming 13; the prototype's own data gives 16 / 14 because the
corpus differs from `data.jsx` in five places (listed in BUILD-LOG.md).
Reading `total` counts every non-card block, headings included, matching
the prototype's `pos`.
- `src/schedule/`: `CardSchedule` ↔ ts-fsrs `Card`, `grade(card, rating,
  now)` → new `CardSchedule` rounded to two decimals. Reading: `readOn`,
  `postpone` (→ next day), `done` (drop `read`). Writing: `workedOn`,
  `postpone`, `done`. Reading and writing never grade.
- Queue query over a vault: cards (one item per cloze group, others as one
  item), reading topics, writing drafts; due ≤ today; sort by priority then
  due. Multi-blank cards expand into one item per group; an unnumbered blank
  is numbered on first grade.
- Pure functions, unit tests only. No UI.
- Done when: grading a card in the sample vault and serializing shows a
  one-line diff, and the queue for 2026-05-27 matches the prototype's counts.

### [x] 4. Tree — sidebar and lenses
Done 2026-09-22, commit `80648ae`.
Notes: tree operations are `Vault` methods over `Fs` (`createFolder`,
`createDoc`, `rename`, `move`, `remove` in `src/vault/vault.ts`, path
arithmetic in `paths.ts`); each runs after any pending watcher work, goes
to disk, re-keys the cache, re-walks, and emits `tree` plus a new `moved`
event (`gone` per cached doc on delete). A document's `name/` directory
moves and renames with it; renaming an extract rewrites its parent's
`<!-- extract -->` lines (one line each); a name is taken when either
`name` or `name.md` exists, so a doc can never adopt a stray folder. New
sources are empty files, decks get `type: deck`, drafts get `type`,
`started`, and `write: due=<today> ivl=1 reps=0`. Deleting is immediate
and permanent, as in the prototype, no confirm, no trash. App side:
`src/app/vault.ts` mirrors the tree and a `DocInfo` per document (type,
title, frozen, card and due counts, read/write) into the store; ops are
`createNode` / `renameNode` (also sets `title` when the doc has one) /
`moveNode` / `removeNode`; `open` folders, `sidebar` (width, hidden) and
the active `tab` persist in `.ilmi/state.json`, debounced. Tabs hold only
a path (`src/app/panes.ts`, pure, tested); kind and title are derived at
render time, so renames and type edits never leave a tab stale. Lenses
(`Lenses.tsx`): folder and deck are lists; source/extract/draft is a
read-only page until milestone 5. Keys: F2 rename, ⌘W close tab, ⌘\
split, ⌘⇧E toggle sidebar; dragging the sidebar handle under 80px hides
it. Not in the tree: card leaves under documents (the prototype had them),
the saved-queries section and queue tabs (milestone 8), the top and
bottom strips and inspector (milestone 9; the shell grid is temporarily
two columns in `app.css`). `Panes.tsx` could not exist beside `panes.ts`
on this case-insensitive disk, so the component file is `Canvas.tsx`.
- Sidebar tree over the vault: folders, documents (source / deck / draft /
  extract) with the prototype's icons and per-type colour. Create, rename,
  move (drag), delete for folders and documents. Right-click menu.
- Tabs and panes as in the prototype (`app.jsx`): opening a node opens a
  lens. Folder and deck lenses can be lists for now.
- Resizable, hideable sidebar; persisted in `.ilmi/state.json`.
- Done when: every tree operation round-trips through disk (rename moves the
  file and its children directory) and the tests for it pass.

### [x] 5. Reader — the unified document editor
Done 2026-09-22, commit `b84ad6e`.
Notes: `src/reader/` is the editor's model, pure and tested without a
window: `schema.ts` (paragraph, heading, card, raw, text, math), `convert.ts`
(`toDoc(blocks)` / `fromDoc(doc)`, a fixed point over the corpus; empty
prose is dropped, a split paragraph keeps its id on the first half only,
cards and raw blocks pass through as frozen attrs), `marks.ts` (editorial
mark ranges), `marker.ts` (`pickPos`, `cursorIndex`, `setReadPos`),
`plugins.ts` (`makeState(blocks, { frozen, pos })`: `# ` input rule, `$…$`
input rule validated by `mathSpanEnd`, chips re-form when the caret leaves a
block, editorial decorations, `frozenPlugin` filters doc-changing
transactions, the marker plugin holds `pos` and dims settled blocks; set it
with `tr.setMeta(markerKey, pos)`). The view is `src/app/Reader.tsx`:
`Writer` debounces body writes 500 ms, serializes them, and records the
text each write will produce so the vault's `doc` event for it is known as
ours (`claim`); an unknown text is an external change and wins (pending
writes dropped, editor rebuilt, caret kept). After our own write, if nothing
was typed since and the file's blocks differ from the editor's (a line that
became a card, a `#` line), the editor rebuilds from the file. Node views:
`CardView` (form-rendered body, due label from `cardDue`, `.selected` on
node selection) and `MathView` (KaTeX, `data-tex`); clicking a chip on an
editable document turns it back into text (`editMath`). The gutter sets
`pos` locally on every pointer move and writes it on pointer up through
`setReadPos`. The frozen / editable toggle in the meta row writes `frozen`.
Vault change: `commit` now emits `doc` for our own writes too, so the
sidebar counts and a second pane follow an edit. Dev: `ILMI_SMOKE=reader`
opens wozniak, types, toggles frozen, drags the marker, and logs what
reached disk; `main.tsx` forwards renderer errors to the log plugin. Not
done: the draft lens's done / reopen row (milestone 8), card click opening
the inspector (milestone 6/9), a placeholder for an empty document.
- ProseMirror document built from `Doc.blocks`; edits write back through
  `serialize`. Headings and paragraphs; cards as atomic inline widgets;
  raw blocks rendered read-only.
- Math `$…$` / `$$…$$` rendered with KaTeX as atomic chips, source kept.
  Editorial marks `[note]` and `#TODO:` highlighted, stay literal.
- Frozen sources: prose locked, cards editable.
- Left-margin read marker: click or drag to set `read.pos`, snapping to block
  boundaries; writes `pos` to front-matter.
- Done when: editing a paragraph in the sample vault changes only that
  paragraph on disk; a frozen source refuses prose edits; the marker persists
  across reload.

### [x] 6. Extracts and card making
Done 2026-09-22, commit `fbc2386`.
Notes: `src/reader/cards.ts` is the pure side: `cardText(spec)` turns the
composer's fields into the paragraph the format will read back as that
card (checked with `parse` itself; two-sided cards go inline when both
sides are one line, else around `?` / `??`; blank-line runs fold to one
break), `passage(doc, from, to)` is what a selection covers (text of the
prose blocks touched, cards and raw skipped, plus their child indices),
`blockAt` the anchor, `insertCard` / `setCardText` the transactions. Both
carry `cardsKey` meta, which the frozen plugin lets through: cards stay
editable on a frozen source. A new card is written with no id and no
`sr` line (new, due now; the id comes with the first grade). Extracts:
`Vault.extract(parent, { text, blocks, name?, today? })` in
`src/vault/vault.ts` makes `childDirOf(parent)/<name>.md` with `type:
extract`, `imported`, and `read: due=today ivl=1 reps=0 pos=0` (`pri`
copied from the parent's read line when it has one), appends the name to
`extracts` on each touched paragraph or card (headings and raw get none:
a backref there would be an orphan), and moves `read.pos` to just past
the last touched prose block, never back. The name is the passage's first
five words (`extractName`), numbered when taken. The app side is
`extractNode` in `src/app/vault.ts`, which also opens the parent's row.
Reader: the selection is read from the DOM on `selectionchange` and
mapped with `posAtDOM`, because a frozen surface is never focused and the
editor state does not follow its selection; the cue sits fixed under the
selection with `extract e` (sources and extracts only) and `make a card
m`; `e` and `m` are handled in ProseMirror's `handleKeyDown` when the
surface is focused and by a window listener otherwise. The composer
(`src/app/Composer.tsx`) is the prototype's MakeCard: cloze / q&a /
bidir (⌘1-3), ⌘B wraps a blank, ⌘↵ saves, ⇧⌘↵ saves and stays, esc
cancels; the card lands after the block the selection ends in through
the editor, then the `Writer` flushes. An extract runs through
`Writer.run` so it follows any pending body write, and the parent's own
update comes back as an external change (editor rebuilt, history reset).
Decks: a `+ card m` row opens the same composer in the flow and appends
to the deck; `default-card` picks the form. Deviation: the prototype's
priority picker is not in the composer, since FORMAT.md gives cards no
priority. Not done: the card editor in the inspector (the inspector is
milestone 9; `setCardText` is ready for it and tested). Dev:
`ILMI_SMOKE=cards` selects in the frozen wozniak, presses `e`, then `m`,
fills the composer, saves, and logs what reached disk.
- Select a passage in a reading lens → `e` carves an extract: child file under
  the parent's directory with `type: extract`, its own `read`; parent gets
  `<!-- extract name -->` under the touched paragraphs; marker advances.
- Select in any container → `m` opens the composer (cloze / q&a / bidir,
  ⌘B wraps `{{ }}`); the card is inserted after the selected paragraph.
- Card editor in the inspector edits a card in place.
- Done when: both flows produce files that `parse` cleanly and appear in the
  tree and the queue.

### [x] 7. Import
Done 2026-09-22, commit `7d81c0d`.
Notes: `src/import/` is the pure side: `text.ts` (`cleanText`,
`deriveTitle` = first line, `#`s stripped, 64 chars; `stats` = words,
paragraphs, minutes at 220 wpm; `isUrl` = one `http(s)` address and
nothing else; `titleFromFileName`) and `readable.ts` (`readable(html,
url)` runs Readability over a `DOMParser` document and `textOf(root)`
walks the article into the blocks FORMAT.md reads: `#` headings, `- ` /
`1. ` lists with nesting, `> ` quotes, fenced `pre`, `|` table rows;
`nav`, scripts, images, controls skipped; the whole body when Readability
finds no article; `null` when there is no text). `Vault.importDoc(dir, {
title, text, today? })` in `src/vault/vault.ts` lands the file: named
`fileName(title)` (`paths.ts`: separators and controls to spaces, 80
chars, `untitled` fallback) through `freeName`, the text read by `parse`
exactly as a file on disk would be (so headings, cards, and front-matter
in a dropped `.md` are what they would be there), then `frozen: true`,
`imported: <today>`, `read` and `write` dropped, and `title` written as
a field only when it differs from the file name or the text already had
one. App side: the intake is a tab whose id is `INTAKE` (`':intake'` in
`names.ts`, never a vault path); `tabKindOf` / `titleOf` / `GLYPH.intake`
(`＋`) know it; `openIntake(dir)` in `src/app/vault.ts` sets
`intakeDir` in the store and opens the one tab; `importNode` wraps
`importDoc` and opens the folder. Entry point until the palette exists:
`add a source` in the tree's right-click menu, placing into the folder
under the menu (or the folder holding the document). `Intake.tsx`
follows `ingest.jsx`: crumb, `Add a source`, the field (`paste text or a
link`), hint `or drop a .txt / .md file` + `use a sample →`, then stats,
`title`, `lives in` (every folder, root as the vault name), `place &
open` / `place & leave it`. Copy trimmed per the brief: no lede, no
button subtitles, no `unread` word; the hint line doubles as the one
quiet note (`fetching`, `nothing readable at that link`, `not a text
file`, `could not read that file`). A pasted address into an empty
field is fetched through `@tauri-apps/plugin-http` (`fetch.ts`:
`fetchReadable`, html → `readable`, plain text as is; `http:default`
granted for `http(s)://**` in `capabilities/default.json`); a dropped
file arrives through `getCurrentWebview().onDragDropEvent` with a path
(the DOM drop carries no files under Tauri), counts only when the
position is over this panel (`elementFromPoint`), and is read by the
Rust command `read_dropped` (`.txt` / `.md` / `.markdown` / `.text` as
is, `.html` through `readable`, anything else refused); dragged text
still comes through the DOM `drop`. `place & open` replaces the intake
tab with the source, as the prototype's `onOpen` did. `@mozilla/
readability` and `tauri-plugin-http` were added. Not done: the bottom
strip hint `⌘v paste` and the intake inspector (milestone 9), the
palette command (milestone 9), PDFs (the prototype only ever read text).
Dev: `ILMI_SMOKE=intake` takes the sample, places it, then pastes
`https://example.com/` and logs what came back. Note `Intake.tsx` and
`intake.ts` cannot coexist on this disk, hence `fetch.ts`.
- Intake: paste, drop a text file, or a URL → readable text. Title, target
  folder. Lands as a frozen source, unread, not enrolled.
- Done when: the prototype's intake sample imports and opens in the reader.

### [x] 8. Queue and review session
Done 2026-09-22, commit `fc62c94`.
Notes: the queue lives in the store: `src/app/vault.ts` keeps every
document's parsed form in a `bodies` map and publishes `queue` (all
items, sorted, `queueItems` over the map) and `queueAt` on every publish,
`doc`, and `gone` event; `refreshQueue()` rebuilds it for the present
moment (a card in learning steps comes due by the minute) and the queue
lens calls it when shown. `DocInfo` is now derived from the same items.
`src/schedule/queue.ts` gained `sortQueue`, `sameItem` (one card group,
or one document's reading or writing), `ReadItem.next` (the next unread
prose block's text) and `WriteItem.lead` (the first paragraph), so a row
can show its snippet without opening the file. Tab ids that are not
paths: `INTAKE`, `SESSION` (`':session'`, one session at a time) and
`queueId(scope)` (`':queue/today'` …) in `names.ts`, with `queueScope`,
`tabKindOf` (`queue` / `session`), `titleOf` (`due today`, `upcoming`,
`reading`, `writing`, `all cards`) and glyphs `≡` / `◆`; the session's
tab title and glyph follow the element through `sessionEl` in the store.
A saved query is restored from `.ilmi/state.json`; a session is not;
nothing remembered opens `due today`. `src/app/items.ts` is the pure
side of the views: `dueLabel` (moved out of `Reader.tsx`), `dayLabel`
(`wed · 27 may`), `gapLabels` (what each grade would schedule, minutes
in learning steps, else days, from `preview`), `sourceLabel` (title, and
for a card ` — section` with the `§N — ` prefix dropped), `snippetOf`,
`refLine` (`N% read`, `pass N`), `intervalLabel`, `isFresh` (the `new`
tag), `ownBlank` (which blanks an item tests; the rest are context),
`sessionItems` (today rotated to start at the element, or the element
alone when it is not due), `summary`, `dueNow`. `Queue.tsx` (`Queue`,
`SavedQueries` for the sidebar) and `Session.tsx` follow `views.jsx` and
`recall.jsx`: `j k ⏎ o` in the queue, `[ ]` in the session, space and
`1-4` on a card (a digit before reveal reveals), `⏎ p d` on a topic or a
draft; the reading and writing elements render `Reader` plus a sticky
`SessionBar`; `read on` passes the number of prose blocks scrolled past
the top of the pane as `pos` (`readOn` only moves forward), so the
marker is live and the pass remembers where you got to. Grading runs
`gradeItem` inside `vault.update`; a card that had no id gets one, and
later items of the same card in the session are patched with the new id
and text. A session is `session: { seq, items }` in the store; opening
one again bumps `seq` and the lens starts over. `log` (six lines, `read
· read on`, `wrote · progress`, …) shows two under the header, as the
prototype's `qlog` did. The draft lens got its `done` / `reopen` row
(`draft-sched`, in `reader.css`); reopen is `worked on it`. CSS is in
`queue.css` and `session.css`, flattened. Copy: empty states are one
line (`nothing due`, `nothing ahead`, `nothing enrolled`, `no drafts`,
`no cards`), the session ends on `done, N elements`. Not done: editing
a card's text in the session (the prototype's contentEditable; the
inspector's card editor is milestone 9), the prototype's `p` / `x` on
queue rows (cards do not postpone), an `upcoming` row opening a
one-element session is gradable early, as in the prototype. Dev:
`ILMI_SMOKE=queue` opens the day, enters the queue, walks the whole
session with the keys, and logs each element's write. Rust untouched.
- Queue view (today / upcoming / reading / writing / cards). Session shell
  with prev/next (`[` / `]`). Cards: reveal, grade again/hard/good/easy.
  Reading: read on / postpone / done with the marker live. Writing: worked on
  it / postpone / done. Multi-blank clozes show the other blanks dimmed.
- Done when: a full session over the sample vault writes every result to disk
  and the queue empties to one quiet line.

### [x] 9. Chrome and polish
Done 2026-09-22, commit `2a99c0e`.
Notes: the shell grid from `tokens.css` is in use (the two-column override
in `app.css` is gone): `TopStrip.tsx` (vault name, the palette button `⌕
⌘k`, `N due`, the day, the inspector toggle), `BottomStrip.tsx` (real key
hints per surface from `hintsFor` in `chrome.ts`: the tab kind, the
session's element, the query's scope, whether a source can start
reading), `Inspector.tsx` (per kind: folder counts; source / extract with
path, imported, length, cards, reading, the freeze toggle, extracts and
cards lists; deck with the default-card toggle writing `default-card`;
draft with the done / reopen row and its spaced-composition numbers; the
intake's folder; a query's counts; the session's card with a card editor
and its schedule, or its document), `Palette.tsx` (⌘K; `buildIndex` over
saved queries, folders, documents by title, every card by `cardLabel`,
and commands: enter queue, add a source, split / close pane, sidebar,
inspector, next theme, tweaks; `fuzzy` ported from the prototype but a
miss is `null`, since the prototype's `-1` plus its `≥ 0` filter dropped
its own best matches), `Tweaks.tsx` (⌘, or the palette: theme, accent
presets from the prototype, density; kept in `localStorage` under
`ilmi.tweaks`, outside any vault; `App.tsx` sets `--accent-h/-c/-l-*`
and `--rho`). Store: `accent`, `inspector` (width / open, persisted per
vault in `.ilmi/state.json` like the sidebar), `paletteOpen`,
`tweaksOpen`, `selectedCard`, and `sessionEl.item`. The card editor
(`CardEditor` in `Inspector.tsx`) writes the block's text through
`vault.update` 400 ms after a change when the text still reads as one
card (`parse` + `cardForm`), and follows the file otherwise; the reader
publishes a `NodeSelection` on a card as `selectedCard` (`handleClickOn`
selects a card on frozen documents too), so the inspector edits the
selected card in the reader and the card under review in the session.
`setCardText` in `src/reader/cards.ts` stayed unused: the editor writes
through the vault and the reader takes the change as external, which is
correct for a card. Reading enrolment: `r` on a source or extract (or
`start reading r` in its meta row) writes `read: due=today ivl=1 reps=0
pos=0` (`enrolReading` in `src/app/vault.ts`); the prototype only
mentioned `r` in an empty-state line. `Reader` takes `active` now. Global
keys in `App.tsx`: ⌘K, ⌘\, ⌘W, ⌘⇧E, ⌘⇧I, ⌘, (the palette closes on esc
from anywhere). Copy: the palette placeholder is `open or run`, the top
strip carries one count, the card strip says `due today` / `+3d` but
`overdue 2d` and `new` alone, empty lines are one line. Verified with
screenshots for the first time: `ILMI_SMOKE=shots` walks every screen
logging `shot: <name>` and a shell loop runs `screencapture` on each
(macOS asked the terminal's host for screen-recording permission on the
first shot; the dialog sat over later ones). `ILMI_SMOKE=loop` runs the
whole loop in the window. Not done: the inspector for a selected card
does not scroll the reader to it; the palette opens a card's document,
not a one-card session; `window.ilmi` stays as a console convenience;
the accent presets beyond gold are the prototype's, kept because the
plan names accent as a tweak, though the brief calls gold the one accent.
- Top strip, bottom strip with real key hints, inspector per node type,
  command palette, global keyboard router, tweaks panel (theme / accent /
  density). Copy pass: remove words.
- Done when: a screenshot of each screen passes the brief's "someone
  maintained this for years" test, and the whole loop (import → read →
  extract → card → review) runs end to end.

## SuperMemo parity

ilmi was built as a modern SuperMemo: the three loops over Markdown, with
FSRS in place of SM-18. What it still lacks from SuperMemo is the handling
of *too much*: a fine priority scale, the outstanding queue sorted by it,
a growth factor per topic, and postponing the overflow. Wozniak documents
all of that at supermemo.guru and help.supermemo.org. Implement it from the
text, never from the binary: the SuperMemo license forbids reverse
engineering, and a clean-room version is the only one that can be shared.
The one place the binary matters is milestone 14, reading a collection's
data files, and only where the community notes on the layout run out.

Same rules as above: one milestone per session, a FORMAT.md change comes
with a corpus file and a test, ask before a screen or a setting not listed
here. Cards keep FSRS throughout; nothing below changes how a grade lands.

### [x] 10. Priority — one scale, document level, the queue sorted by it
Done 2026-10-17, commit `2849ca8`.
Notes: `pri` is a front-matter field (FORMAT.md §3: int 0–100, default
50) read by `meta` into `Meta.pri`; `docPri(m)` is the field or 50, and
`PRI_MIN` / `PRI_MAX` / `PRI_DEFAULT` / `parsePri` are exported from
`src/format`. A `pri=` on a `read` / `write` line is still parsed (now
range-checked) and stands in for that loop when there is no field; the
parser drops it from the line once the file has the field, `setField(doc,
'pri', n)` drops it too, and `formatFrontmatter` formats a copy without
it, so a doc that gained the field in memory writes clean and a parse →
serialize → parse of a file with both is a fixed point. A card's own
priority is `pri` on its bare `sr` line (`CardSchedule.pri`, last in
`SR_SPECS`); on an `sr cN` line it is dropped with a diagnostic. `grade`
and `preview` carry `pri` (and `extra`) across from the previous
schedule (`fromFsrs(c, g, prev)`), and `Vault.resetCard` keeps it as a
bare `<!-- sr pri=N -->`; the inspector's `hasSchedule` treats such a
line as not scheduled, so the card still reads `new`. Queue
(`src/schedule/queue.ts`): an item's `pri` is the card's own, else the
document's, else 50 (a line fallback counts for its loop only);
`sortQueue(items, now)` puts what is due first, by priority then due then
document order, and what is not due yet after, by due then priority. The
corpus's `pri=1..3` moved onto the field as 10 / 50 / 80; the order test
pins the day's full order. **Deviation:** "the queue order for
2026-05-27 is unchanged" held for the topics and drafts but not for the
cards: the old 2 / 3 rule put every due card ahead of every pri-3 topic,
and wozniak-1990's cards now sit with their document at 80, after
everything at 50. The test says so. `Vault.extract` gives the child the
parent's field (or the parent's line fallback) as a `pri` field, not a
line attribute. App: `DocInfo.pri`; the inspector's `PriField` (a number
input that commits on blur or ⏎, empty clears, escape restores) on the
`priority` row for source / extract / draft / deck (`setField`) and for
the selected or under-review card (the bare line, through `cardAt`, the
lookup the card editor also uses now); the composer's `priority` number
(default the document's; a differing value becomes `sched: { pri }` on
the new card in the reader and in the deck); queue rows and the session's
card strip and reading / writing bar show `p NN` only when it is not 50,
live from the document. New corpus file `mangled/priority.md`. Dev:
`ILMI_SMOKE=pri`. Not done: no palette command or key for priority; the
inspector's field has no stepper or slider; `items.test.ts` fixtures
still say `pri: 2` (harmless, it is a number).
SuperMemo gives every element a priority percentile, 0% first, and sorts
the outstanding queue by it. ilmi's `pri` is an int on the `read` /
`write` line, default 2, and cards have none (they are 2 when due, 3
otherwise).
- FORMAT.md: a front-matter field `pri`, int 0–100, lower first, default
  50, applying to the document's reading, writing, and every card in it.
  `pri` on a `read` / `write` line is read as a fallback for that loop and
  dropped on write (§8 normalization) once the field exists. A card may
  carry `pri` on its bare `sr` line to override the document's; a group
  line never carries one. Rewrite the corpus's `pri=1..3` onto the field
  and the new scale (1 → 10, 2 → 50, 3 → 80), with a test showing the
  queue order for 2026-05-27 is unchanged.
- `src/schedule/queue.ts`: `pri` on every item from the document field,
  the card override, else 50. Due items sort by `pri`, then due, then
  document order; `upcoming` by due, then `pri`. The 2 / 3 card rule goes.
- An extract takes the parent's priority at carving (today it copies the
  read line's). A card made from a passage takes the document's.
- Inspector: a `priority` row for source / extract / draft / deck and for
  the selected card (a number field, 0–100, written through `setField` or
  the card's own line). The prototype's priority picker returns to the
  composer, since a card can carry one now.
- Queue rows and the session strip show `p NN` only when it is not 50.
- Done when: setting a priority in the inspector changes one line on
  disk, the queue reorders live, and the corpus order test passes.

### [x] 11. Growth — a factor per document for reading and writing
Done 2026-10-17, commit `cafcd16`.
Notes: `af` is an attribute on the `read` / `write` line (FORMAT.md §3:
number ≥ 1.1, default 1.6 reading, 1.5 writing; `AF_MIN` / `READ_AF` /
`WRITE_AF` / `parseAf` exported from `src/format`), ordered after `pos`
on `read` and after `reps` on `write`, before `pri`. The default is
dropped at parse time, by `setField`, and by `formatField`
(`withoutDefaultAf`), so the in-memory doc never says 1.6 and the
round-trip fixed point holds; below the floor it is dropped with `bad
value for "af": 1`. `src/schedule/growth.ts` holds the arithmetic shared
by both loops: `grow(ivl, af)` (`max(1, round(ivl × af))`),
`nextIntervals(ivl, af, n = 3)`, `postponed(ivl, factor = 1.2)`
(`max(round(ivl × f), ivl + 1)`), `POSTPONE_FACTOR`. `readOn` /
`workedOn` use the line's `af`; `postpone(s, now, factor?)` writes the new
`ivl` and `due`, leaves `reps`, and `advanceRead` / `advanceWrite` pass
no factor, so `p` is one keypress. Corpus: crick-1995 carries `af=2`,
talk-incremental `af=1.2`; new `mangled/growth.md` has the default
written out and a value below the floor. Tests: the corpus's four reading
topics with `af=2` land on `max(1, round(ivl × 2))` from today and the
file says so; postpone over intervals 0–365 and factors 0.5–2 never
lands before tomorrow. Inspector: `PriField` is now a thin wrapper over
`NumField` (className, min, max, step, parse, `none`, a value that means
empty so typing the default clears the field); `growthRow(path, key, s)`
is the `af-field` plus `af-next`, the next three intervals as `3d · 5d ·
8d` (`fmtDays`), shown for a source or extract only when enrolled, under
`priority`, and for a draft in the `spaced composition` block between
`interval` and `due`. Session: the postpone note reads `read · +3d`, not
`tomorrow`. Dev: `ILMI_SMOKE=growth`. Not done: no growth row for an
unenrolled source (there is no line to put it on; `r` enrols first);
nothing shows `af` in the queue rows or the session bar; the preview
starts from the stored `ivl`, not from how overdue the topic is.
SuperMemo multiplies a topic's interval by its A-factor on every pass, and
`postpone` multiplies it too rather than moving it to tomorrow. ilmi's
growth is a constant: 1.6 for reading, 1.5 for writing, and postpone is
always the next day.
- FORMAT.md: `af` (number ≥ 1.1; default 1.6 on `read`, 1.5 on `write`)
  on the `read` / `write` line, omitted when it is the default.
- `src/schedule/read.ts` / `write.ts`: `readOn` / `workedOn` use the
  line's `af`. `postpone(r, now, factor?)`: new interval
  `max(round(ivl × factor), ivl + 1)` days from today, default factor
  1.2, `reps` untouched. A session's `p` stays one keypress on the default.
- Inspector: a `growth` row for sources, extracts, and drafts, with the
  next three intervals previewed (`3d · 5d · 8d`) the way the draft's
  spaced-composition numbers are shown today.
- Done when: a pass over the corpus's reading topics with `af=2` lands
  where the formula says, postpone never schedules earlier than tomorrow,
  and `af` round-trips through the corpus.

### [x] 12. Overload — a budget for the day, and postponing the rest
Done 2026-10-17, commit `5eaa5f5`.
Notes: the budget is `budget` in `.ilmi/state.json` (`VaultState.budget`,
int ≥ 1; 0 or absent is no fold), read on `openVault` through
`cleanBudget` in `src/app/items.ts` into the store's `budget`, written by
`setBudget` in `src/app/vault.ts` through the same debounced `queueSave`
as the sidebar; FORMAT.md is untouched, nothing in a vault file changed.
`src/schedule/queue.ts`: `fold(items, n)` → `{ above, below }` over a
sorted list (`n ≤ 0` is everything above); `overflow(items, now, budget)`
takes any list, keeps what is due, sorts it, folds it, and returns the
reading and writing below the fold with the highest `pri` number first
(lowest priority); `postponeOverflow(vault, items, now, budget)` runs
`advanceRead` / `advanceWrite` with `'postpone'` on each, one
`vault.update` per file, and resolves to what it postponed. Cards are
never in the overflow. `dueToday(items, now, budget)` in `items.ts` is
`fold(dueNow(...), budget).above`: the top strip's count, `startSession`,
and `openSession` use it, so a session walks the part above the fold and
an element below it opened from a row is a one-element session (the
existing "not in the day" rule). `Queue.tsx`: in `due today` the rows
past the budget carry `data-below="1"` (dimmed) under a `li.fold`: a rule
in `--line-1`, `N more` on the left, and, while a topic or draft sits
below, the `postpone the rest` button on the right with `2 to read · 1 to
write` beside it; the rows below stay visible so what the button touches
is in view. `postponeRest()` in `src/app/vault.ts` notes `postponed · N
elements`. Palette: the `postpone the rest` command is in the list only
while `overflow` is non-empty (the command list is memoised on the queue
and the budget). Tweaks: a `budget` row with a number field
(`BudgetField`, commits on blur or ⏎, escape restores, empty is none),
shown only while a vault is open. Dev: `ILMI_SMOKE=overload`. Tests: 245
(`fold` and `overflow` over small docs; the corpus day at budget 5
postpones its three reading topics, one `read:` line each, every other
file byte-identical, tomorrow's queue has no topic; six topics at budget
3 open within budget the next day with `4 → 5, 5 → 6, 6 → 7`; `dueToday`
and `cleanBudget`; the state file round-trips `budget`). Not done: the
sidebar's `due today` count and the query's inspector counts are the
whole day, not what is above the fold (only the top strip was asked to
fold); nothing marks the fold in the session itself; `j k` walk below
the fold too, and `o` on a row below opens it alone; no key for
`postpone the rest`; there is no end-of-day automation, the row and the
command are the only triggers.
SuperMemo's auto-postpone: when a day ends with material outstanding, the
lowest-priority overflow is pushed forward by a factor so the next day
starts clean. Cards are different under FSRS: lateness is folded into the
next grade, so the app never postpones a card, it only orders them.
- `src/schedule/queue.ts`: `fold(items, n)` splits today's sorted queue
  into the first `n` and the rest; `overflow(items, now)` is the reading
  and writing items below the fold.
- `budget` in `.ilmi/state.json` (int, 0 = none), set from the tweaks
  panel; this is the one new setting. The `due today` query draws the fold
  as a thin rule with `N more` under it, and a session walks the part
  above the fold.
- A palette command and a row under the fold, `postpone the rest`: runs
  `postpone` (milestone 11) over every reading and writing item below the
  fold, lowest priority first, and leaves cards where they are. No
  special case for overdue cards; priority and due order them.
- The top strip's count stays one number: items above the fold.
- Done when: a vault with more due than the budget shows the fold,
  `postpone the rest` rewrites one line per topic below it and touches no
  card, and the next day's queue opens within budget.

### [x] 13. Tasks — dropped
Dropped 2026-10-17, commit `010e8f0`.
Notes: not built. The milestone's own description, "the same shape with
no interval: due, priority, done", is the draft: a Markdown file whose
body is the text, a `write` line with `due` and `done`, the document's
`pri` ranking it against the day's reading and cards (which is what a
SuperMemo tasklist is for), a queue row, a session with `p` and `d` and
no grades or marker, the inspector's done / reopen row, a glyph, `new
draft`, the `writing` query. A `type: task` would have removed `ivl` /
`reps` / `af` and the ⏎ pass and changed one function (`p` to tomorrow
instead of `postponed(ivl)`), at the price of a fourth branch through
`NodeType`, `Field`, the line specs, `setField`, `meta`, `QueueItem`,
`Scope`, `inScope`, `counts`, `overflow`, `summary`, `El`, `DocSession`,
`DocInspector`, `NEW_KINDS`, the folder lens, `metaOf`, the CSS,
`createDoc`, and then the importer in 14; the prototype has no task node,
and the ground rules say to ask before adding a kind it lacks. A task is
a draft: the to-do is its body, `d` when done, `p` when not today; a
`tasks/` folder groups them in the tree, which is the model. What a to-do
lacks as a draft is a due-day field on the draft's inspector, so a date
can be set without `p` (a fresh draft's `p` lands at `postponed(1)`, two
days out, not tomorrow); if wanted, that is a row in a polish pass, not a
type. Milestone 14's "tasklists → milestone 13 tasks" becomes: a tasklist
is a folder of drafts, each `write: due=<deadline, else the import day>
ivl=1 reps=0 done=false`, its priority on `pri`. Nothing changed on disk,
in FORMAT.md, or in the suite (13 files, 245).
SuperMemo's tasklists rank to-dos and feed them into the same day. ilmi has
drafts for writing; a task is the same shape with no interval: due,
priority, done.
- FORMAT.md: `type: task`; a `task` line with `due` and `done`. No `ivl`,
  no `reps`; `pri` is the document field. The body is the task's text.
- Queue: a `task` item kind, due ≤ today, sorted with the rest by
  priority. Session: `d` done, `p` postpone to tomorrow; no grades, no
  marker. Inspector: the done / reopen row and a due-day field.
- Tree: a glyph and colour for tasks; `new task` in the right-click menu;
  a `tasks` saved query beside `writing`.
- Done when: a task made from the tree appears in `due today`, `d` writes
  `done=true` and it leaves the queue, and the corpus has one.
- If this starts to look like a second drafts lens, stop and ask; dropping
  it is the likelier answer.

### [x] 14. Import — a SuperMemo collection into a vault
Done 2026-10-17, commit `e93bb46`.
Notes: `src/import/supermemo/` is pure over bytes and an `SmFs` (`readDir`,
`stat`, `readBytes`; `node-fs.ts` is the node one): `bytes.ts` (little-endian
readers and writers, Borland real48, Delphi TDateTime: `tdDay` / `dayOfTd` /
`tdWhen`), `records.ts` (the fixed-size records exactly as `LAYOUT.md`
documents them and no further: `contents.dat` 37 B, `ElementInfo.dat` 118 B,
`Text.mem` 30 B, `RepetitionHistory.dat` 39 B, the `compon.dat` group walked
by each component's self-described size, `rtxText` with the trailer check,
`decodeText` UTF-8 then windows-1252; a record that does not fit is an
`ImportDiagnostic { file, message }`), `collection.ts`
(`readCollection(fs, knoOrDir)` → `SmCollection`: the tree from element 1 by
first child / next sibling with range, cycle, and parent checks; titles and
texts through the Text registry and an `elements/` slot index built by one
walk; dated history rows as `reps`; ranks from `priority.sub`; the day epoch
as the mode of `floor(lastTouch) − lastRepDay` with its agreement),
`docs.ts` (`priOf` = `round(100 × rank / (n − 1))`; `readOf` / `seedOf` when
`interval ≥ 1 && lastRepDay ≥ 1`; `bodyOf` through `readable`, `plainOf`
through `textOf`; `cardTextOf`: a literal `[...]` in the question →
`{{c1::answer}}`, else `q :: a` inline or `q\n?\na`; an item missing a side
stays prose with a diagnostic), `index.ts` (`importCollection(fs, path,
vault, { today })` walks the tree order and places each element: a concept
group or a text-less topic with children → `createFolder`; a topic → a
source in the nearest folder or an extract under the nearest document; an
item → a card `^smN` at the end of the nearest document, or in a `cards.md`
deck made in the nearest folder; a task → a draft `write: due=<today> ivl=1
reps=0 done=false` in the nearest folder; every file through `createDoc` +
`write`, cards appended in one `update` per file at the end; `formatSummary`
is the CLI's few lines). `scripts/import-sm.ts` runs under `tsx` (new dev
dependency: node 26 strips types but neither maps `./x.js` to `x.ts` nor
transforms `vault.ts`'s parameter properties), with jsdom's `DOMParser` as
the global `readable` needs; `--today` fixes the import day. `LAYOUT.md`
carries every fact with its source (SuperMemo's own help pages, SuperMemo
Assistant's MIT structs, freememo's MIT-0 measurements, SuperMemo-Toolkit
read for facts only, and the file sizes in the user's own backed-up SM18
collection, which divide by 37 / 118 / 39 / 30 exactly) and every unknown as
unknown; the decompilation repos on GitHub were not opened. **Deviation:**
grades are not in any readable layout (freememo: "not recoverable"), so the
replay through `grade` is not done; every scheduled item gets the
milestone's seed `st=review s=<ivl> d=5 r=<dated rows> ivl=<ivl>
last=<day>`, `r` only when a history file exists. Fixture:
`__tests__/make-collection.ts` writes `__tests__/collection/` (`npm run
fixture:sm`) from the documented layout: 16 elements over a root, two
topic-folders, a concept group, a source with an extract, a cloze item under
the extract, an item under an item, two items under a folder (the deck), a
task, a deleted element, a template; 22 files; nobody's notes. The test
holds the files on disk to the generator byte for byte, then imports them.
Variants in memory: an unknown type byte, an unknown component kind, a
registry trailer naming the wrong member, no history file. FORMAT.md
untouched. Tests: 253 (+8). Not done: no real collection has been imported.
The user's own "cognitive canopy" (SM18, 190 elements, 2024) is inside a
Duplicati backup set in Box (`99 supermemo/`), and restoring its block
volumes was refused by the permission rules this session ran under, so the
"no unknown-record diagnostic on a real collection" clause is unverified;
only the backup's file list (names and sizes) was read. Unknown in the
layout and therefore never written: grades, lapses, the forgetting index,
the element status, priority as a percentage (the rank is used), tasklist
deadlines (`tasks/*.dat`, reported when non-empty), the `.kno` record, the
cloze markup beyond the literal `[...]`, `repetitions.dat`'s epoch.
Readability drops an `<h1>` that repeats the page title, as the intake does.
No smoke mode; the CLI run is the verification.
One-shot, from the command line, not the app:
`npm run import-sm -- <collection.kno> <vault-dir>`. The point is years of
repetition history landing in Markdown.
- Layout, to verify before any code: `<name>.kno` beside `<name>/`, with
  `elements/` (one HTML file per element in numbered subfolders), `info/`
  (`contents.dat` for the tree; `elementinfo.dat`, fixed-size records with
  the per-element schedule and priority), `registry/`, and the repetition
  history. Start from the community notes (supermemo.wiki,
  help.supermemo.org, and any SuperMemo-to-Anki converters on GitHub).
  Where those run out, point REA (`npx rea-agents setup`; Ghidra for the
  native path; the executable is 32-bit Delphi, so recover classes and
  strings with IDR or the Dhrake scripts first) at the executable with one
  question per record: field offsets and types. Write each answer and its
  evidence into `src/import/supermemo/LAYOUT.md`. Never copy pseudocode
  into the importer; the layout notes are the only thing that crosses.
- Mapping: tree folders → vault folders; a topic → a source (`frozen`,
  `imported`, its HTML through `readable` + `textOf`); a topic's child
  topics → extracts under `name/`; an item → a q&a card in its parent's
  document (a cloze item carved from the parent's text → a cloze card
  there); a child of an item lands in the nearest topic. Priority % →
  `pri`, rounded. Topic schedule → `read: due ivl reps pos=0 af=<A-factor>`.
  Item schedule → `sr`: when the repetition history is readable, replay it
  through `grade` from the first repetition (`fsrs-sim.test.ts` shows the
  shape); else seed `st=review ivl=<interval> last=<last rep> r=<reps>
  s=<interval> d=5`. Tasklists → milestone 13 tasks.
- `src/import/supermemo/` is pure over bytes and an `Fs`, tested against a
  fixture collection under `__tests__/collection/`: small, made for the
  purpose, nobody's real notes. The CLI is `scripts/import-sm.ts` under
  node, writing through `Vault`.
- Done when: the fixture imports into a scratch vault that `parse`s clean,
  every element is findable in the tree, the queue for the fixture's last
  day matches its outstanding count, and a real collection, when one is at
  hand, imports with no unknown-record diagnostic.

## Reading PDFs

Import turns a PDF into Markdown and loses the PDF. Papers are read in
their own layout, so the next lens keeps the file and reads it in place:
the three loops over a PDF, with the Markdown beside it holding what came
out. sioyek (github.com/ahrm/sioyek, GPLv3) is the behaviour reference:
read its source for the ruler, highlights, portals, and smart jump, and
reimplement; copy nothing, since its license is not ours and it renders
through MuPDF, whose license is not ours either. No reverse engineering is
involved; the code is public.

### [x] 15. PDF lens — read a PDF in place, extract and card from its pages
Done 2026-10-17, commits `83a8a3f` (format and vault), `11f628f` (the
lens), `a51fdbd` (smart jump).
Notes: FORMAT.md §1 and §3: `name.pdf` beside `name.md` is the document's
pages, paired by stem; a `pdf` field (a file name relative to the document,
plain or quoted like `title`; `Field`, `Meta.pdf`, `setField(doc, 'pdf',
…)`) names another and wins when its file exists; `page` (int ≥ 1,
`specIntMin`, after `pos` on the `read` line) sits on an extract carved
from a page; `pos` on a document with pages is the page the ruler is on.
What came out of a page sits under `## p. <n>` (`src/vault/pages.ts`:
`pageHeading`, `pageOf`, `pageOfBlock`, `pageSection`, `addToPage`, the
heading added once per page in page order, else at the end). Corpus:
`vault/papers/two-pages.pdf` is written by `corpus/make-pdf.ts` (`npm run
fixture:pdf`; Helvetica text operators, no dates, 1603 bytes; `pdf.test.ts`
holds the file to the generator byte for byte and reads the words back
through `pdfjs-dist/legacy`), with `two-pages.md` (`pdf:`, a `## p. 1`
paragraph carrying a backref, a two-blank cloze under `## p. 2`), its
extract `two-pages/the ruler in the margin.md` (`page=1`), and
`mangled/pdf-missing.md`; the queue counts in `schedule.test.ts` moved
(upcoming 13 → 17, cards 24 → 26, reading 4 → 6; the day's 17 unchanged)
and `vault.test.ts` lists the pair. Vault: `Fs.readBytes` / `writeBytes`;
`DocNode.pdf` from the walk (`isPdfPath`); `Vault.pagesOf(path)` (the
field's file when it exists and stays inside the vault, else the sibling);
`importPdf(dir, { title, bytes, text })` lands the pair (`pdf: name.pdf`,
the text under `## text`, nothing when there is none); `extract` with
`page` writes `page=<n>` on the child and the passage as a paragraph with
the backref under `## p. <n>` in the parent, the marker untouched; rename
and move carry the `.pdf` (a field naming the old stem follows), remove
deletes it, `taken` counts `name.pdf` so a new document never adopts a
stray one, and a `.pdf` appearing beside a document rewalks the tree.
`src/pdf/` is the lens's pure side: `text.ts` (`linesOf` / `pageText` /
`documentText`: pdf.js items → lines by `hasEOL`, paragraphs by a gap over
1.4 lines or a type-size change, hyphens mended), `find.ts` (`findText` /
`findAll` / `countIn`: a passage found in a text layer's nodes with every
whitespace character dropped, mapped back to node offsets), `jump.ts`
(`refOf` / `jumpTarget` / `bibliographyStart`). App: `src/app/pdfjs.ts`
(pdfjs-dist 6.4.299, the worker through Vite's `?url`, a
`ReadableStream[Symbol.asyncIterator]` shim WebKit lacks and
`getTextContent` needs, `loadPdf` copies the bytes since the worker takes
them, `pageBits`, `pdfText` for the intake); `src/app/Pdf.tsx` (`Pdf` wraps
`Pages` and the `Reader` with its new `onPages` prop behind a `text` /
`pages` toggle; pages sized from each page's viewport at a scale that fits
the column, drawn through an `IntersectionObserver` 900px ahead with
canvas + `TextLayer` (`--total-scale-factor`, `--scale-round-x/y` on the
page), the rail at `tops[n]` with the Markdown's cards by `pageOfBlock`
and the children with `read.page`, the ruler's `pickPos` over the page
bands writing `pos`, the selection read from the DOM as in the reader, `e`
→ `extractNode` with `page`, `m` → the composer → `addToPage`, `/` search
over cached page texts with `countIn` and a sticky `.pdf-bar`, `g` go to
page, `[` `]` outside a session, highlights through the CSS Custom
Highlight API (`ilmi-extract`, `ilmi-hit`, one registry merged over every
open lens, nothing drawn where the API is missing), `data-page` on the
root for the session's `read on`, `reveal` landing on a card's page);
`pdf.css` holds the few text-layer rules pdf.js needs (after
pdf_viewer.css, Apache-2.0) and inverts the canvas in the dark theme.
Intake: a dropped or picked (`pick a file →`, the dialog plugin) `.pdf`
goes through the Rust command `read_dropped_bytes` (`tauri::ipc::Response`)
and `pdfText`, the stats say `N pages · M words · ~min` (`no text` for a
scan, which still places), the title is the PDF's metadata title else the
file name, and `place` runs `importPdfNode`; `intakeHooks.ingestFile` is
the dev hook the smoke drops through. Session: `DocSession` renders `Pdf`
for a document with pages and `read on` passes the page in view; the
session's keys defer to a key the lens took (`defaultPrevented`). Queue:
`ReadItem.page` and `p. N` as the row's ref line; `pos` is not clamped to
the prose count on a document with pages. Inspector: a `pages` row, the
`reading` row as `p. N`, the card's `in` row as `title, p. N`. Bottom
strip: `pages` in the hint context. Capabilities: `fs:allow-read-file`,
`fs:allow-write-file`. **Smart jump** shipped: `⏎` on a selection that
`refOf` reads as a figure or table reference (`Figure 3`, `Fig. 3.2`,
`Table 4`), a bracketed citation (`[12]`, `[12, 13]`), an author (`Smith
et al.`, `Smith and Jones (2019)`, `Smith 2019`), or an equation (`(3)`,
`Eq. 3`) finds its target over the pages' lines (`jumpTarget`: a caption
opens with a word sharing three leading letters with the type and the
number, one with a period or colon after the number outranks a bare
mention, the nearest page wins; a citation or an author is looked for from
the last page with a references heading, else the last fifth, as a line
opening with `[12]` / `12.` / the surname and holding the year when one was
given; an equation is a line ending in `(3)`), and `.pdf-peek` shows a
150px band of the target page around the line under the selection, with
`p. N` and the line's text, `esc` closing it and a click going there.
These rules are ours, written from sioyek's behaviour (its
`find_reference_with_string`, `find_equation_with_string`,
`find_generic_with_string`, `index_references` / `index_equations` /
`index_generic`, `get_page_bib_candidates`, `type_name_similarity_score`),
read and not copied. Dev: `ILMI_SMOKE=pdf`. Tests: 276 (+23: the pdf field
and `page`, the corpus PDF's bytes and words, `pagesOf`, the stray PDF,
the page extract, `importPdf`, rename / move / remove carrying the file,
the arriving PDF, the page sections, the text layer finder, a page's text
from items, `refOf` and `jumpTarget`). Bundle: `pdf.worker.min` 1.26 MB
as its own asset, the main chunk 1.40 MB (gzip 423 kB), pdf.js in it; not
split. Not done: pdf.js's standard fonts and CMaps are not bundled
(`useSystemFonts` draws the standard 14 with system fonts; a PDF needing a
CMap draws without it); a page once drawn stays drawn, nothing is let go
on a long PDF; the lens does not reload when the `.pdf` file itself
changes; an extract's `page` goes with its `read` line when `d` drops it,
so a done extract leaves the rail; `[` `]` page inside a session (they
are the session's prev / next there); the queue's snippet for a PDF is the
Markdown's first prose block; no two-page spread, no zoom, no rotation; the
peek's render is a fresh draw of the whole page; `Smith 2019` is read as an
author only because the number is year-shaped.
- Renderer: pdf.js in the webview (Apache-2.0), bundled, no CDN, with its
  text layer on, so a selection on a page is a DOM selection and `e` /
  `m` work as they do in the reader. Pages render lazily; the worker runs
  as pdf.js ships it. Not pdfium, not MuPDF: the first needs a text layer
  built by hand, the second's license is AGPL.
- FORMAT.md: a PDF is `name.pdf` beside `name.md`; the Markdown is the
  document (`type: source`, `frozen`, `read`, `pri`, cards, extract
  backrefs), the PDF is its pages. §1 lists the pairing beside `name/`. A
  front-matter field `pdf: name.pdf` names the file, relative to the
  document; the vault walk attaches a `.pdf` with the same stem as the
  document's pages whether or not the field is there, and the field wins
  when it differs. The reading marker on a PDF is `pos=<page>`, the page
  the ruler is on; the same attribute, so nothing else changes. An
  extract carved from a page carries `page=<n>` on its `read` line
  (int ≥ 1) and its parent's backref stays `<!-- extract NAME -->`. A
  card made from a page carries no anchor: it lives in the Markdown under
  a heading `## p. <n>` the app adds once per page, the way the composer
  anchors a card after a paragraph today. Corpus: one small PDF made for
  the purpose (two pages, generated, no one's paper) and its Markdown,
  with a test and a mangled `pdf:` pointing at a missing file.
- The lens: a source whose pages exist opens as pages, with the Markdown's
  cards and extracts in a rail to the right at their page, and a `text`
  toggle in the meta row to read the Markdown instead. The left-margin
  ruler marks the page as the marker marks a block today, drag sets it,
  and `read on` records the page. Keys match the reader: `e` extract, `m`
  card, `r` start reading, `/` search in the PDF, `g` go to page, `[` `]`
  pages. Highlights are extracts: a passage extracted from a page is drawn
  on it from the stored text when pdf.js finds it again, else only in the
  rail. No annotations written into the PDF, ever.
- Smart jump, from sioyek: `⏎` on a selected figure or citation reference
  (`Figure 3`, `[12]`, `Smith et al.`) finds its target in the PDF's text
  and shows it in a popover without leaving the page; `esc` closes it.
  Study sioyek's rules for matching, write ours from scratch.
- Import: a dropped or picked PDF lands as the pair (`name.pdf` copied,
  `name.md` with front-matter and the extracted text as a fallback body
  under a `## text` heading), not as text alone; the intake says `pages`
  where it says words today. `textOf` for PDFs comes from pdf.js on the
  renderer side, not from a Rust crate.
- Session: a reading element whose source has pages opens the PDF lens at
  its page; `⏎`, `p`, `d` as today. Cards from a PDF review as any card;
  the inspector's `in` row names the page.
- Done when: a PDF dropped on the intake opens as pages beside its
  Markdown, `e` on a page selection writes one extract file with
  `page=<n>` and one backref line, `m` writes one card under `## p. <n>`,
  `read on` writes `pos=<page>`, the extract appears as a highlight on
  reopening, and the corpus pair round-trips. Smart jump is a stretch
  within the milestone: ship it only if the rest is done and verified.
- Not in this milestone: PDF annotations written to the file, two-page
  spreads, EPUB, scanned PDFs without a text layer (they open, nothing
  can be selected, and the meta row says `no text`).

## Notes for the next session

The plan is complete: every milestone above is ticked. What is left is a
polish pass over the open items each milestone's notes record (10: no
palette command or key for priority, no stepper; 11: no growth row before
enrolment, the preview ignores lateness; 12: the sidebar and inspector
counts are the whole day while the strip folds, no key for `postpone the
rest`; 13: a due-day field on the draft's inspector; 14: the user's real
collection, with their say-so; 15: the list under it) and, with the user,
whether the next thing is that pass, the margin-gloss text flow the ground
rules keep out of the plan, or something new. The handoff prompt at the
top of `BUILD-LOG.md` lists the items.
