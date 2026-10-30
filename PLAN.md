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
  AI features. Plugins were on this list until 2026-10-18, when the user
  asked for them; the *Plugins* section below is the rule for them.

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

## Importing cards

Cards made elsewhere should land in a vault as deck files, not be retyped.
Two sources, in the user's words: "an anki deck or text import as well
(copy paste some text and indicate what starts a question like "Q:" and
what starts an answer like "A", quizlet has a similar feature)". Both go
through the intake, which already takes text, a link, and a PDF: pasted
or dropped text that reads as cards gets a delimiter row and lands as a
deck; a dropped `.apkg` lands as one deck file per Anki deck. Everything
written is the card syntax of FORMAT.md §5, so nothing in the format
changes; what Anki has that the format lacks (hints, media, per-direction
schedules) is dropped with a count in the summary, never guessed at.

Same rules as above: one milestone per session, a FORMAT.md change comes
with a corpus file and a test, ask before a screen or a setting not listed
here. The user asked for both of these, so the intake growing a cards mode
and taking `.apkg` is in scope; a new screen is not.

### [x] 16. Cards from text — paste or drop a list, choose the delimiters, land a deck
Done 2026-10-18, commit `b4724d2`.
Notes: `src/import/cards.ts` is the pure side, exported through
`src/import/index.ts`. Delimiters: `SideDelim` is `'prefix' | 'tab' |
'colons' | 'dash' | 'comma' | { custom }` (detection order, `SIDE_KINDS`,
labels `SIDE_LABEL`: `Q: A:`, `tab`, `::`, `–`, `,`), `CardDelim` is
`'blank' | 'newline' | 'semicolon' | { custom }` (`CARD_KINDS`,
`CARD_LABEL`); `Delims = { side, card }`. `chunksOf(text, card)` splits
into cards (blank: `\n(?:[ \t]*\n)+`; trailing whitespace per line and
outer newlines trimmed, blank chunks dropped); `splitCards(text, delims)`
returns `Split { found: Found[], leftovers, dropped, anki }` where `Found`
is a `pair` (front, back) or a `cloze` (the first cell written whole,
filled cells beside it counted under `dropped.extra`); more than two cells
→ the rest joined ` / `, empty cells dropped first. The prefix pair is
line-driven (`splitPrefix`): a card runs from a `Q:` / `Question:` line to
the next, `A:` / `Answer:` opens the back, continuation lines join their
side with a space, a blank line ends a card except under `newline`, `;`
is a line break under `semicolon`; a Q without an A is a leftover
verbatim. `::` and the dash need whitespace on both sides and a non-space
beyond (` ::: ` is not ` :: `); the dash takes `-` `–` `—`. The weak
delimiters, comma and dash, are guarded by `plausible`: a front over 80
characters, holding `. ` / `! ` / `? `, a tab, ` :: `, or a `Q:` / `A:`
prefix is prose, so the intake sample and a `Q:`/`A:` list with commas
find no comma cards. `detect(text)` → `Detected { delims, cards, anki }`:
every side × card pair, most cards, then fewest `leftoverLines`, then
order; a text without a blank line tries `newline` before `blank` so a
tie names the delimiter that is there. An Anki text export
(`ankiHeader`: leading `#key:value` lines with `#separator:` or `#html:`
present; `tab` `comma` `semicolon` `space` `pipe` `colon` or a literal;
`#guid/notetype/deck/tags column:N` → `skip`) is read by `records` (a
CSV reader for Anki's `"…"` quoting, `""` inside, newlines kept) with the
skipped columns out and each cell through `reduceCell(cell, html,
dropped)`: `[sound:…]` and `<img>` out and counted, `{{c1::x::hint}}` →
`{{c1::x}}` counted, HTML through `textOf` (the intake's walker) when the
header says `html:true`, lines trimmed and blank ones dropped, space runs
collapsed; whatever the row says, an Anki text is split by its header, and
the row shows `from an anki export, fields split by tab` with only the
direction toggle live. Writing: `cardText(front, back, both)` → `front ::
back` / `front ::: back`, or the `?` / `??` form when a side has a line
break, and the `?` form is also the fallback when the inline form would
not read back as the same card (a front holding ` :: `); `null` when
neither form does (a side holding a blank), and `toCards(split, both)`
makes that pair a leftover. `deckDoc(cards, leftovers)` builds the body
as text and parses it, `type: deck` set, leftovers as paragraphs under
`## not cards`; a leftover that begins with `#` or `- ` reads as what it
is (a heading, a list) — plain paragraphs by intent, not enforced.
`droppedLabel` → `1 hint, 2 sounds dropped`. Vault:
`Vault.importDeck(dir, { title, doc, today })` (`ImportDeckSpec`) names
the file after the title through `fileName` + `freeName`, sets
`imported` and `title` when it differs, as `importDoc`; `importDeckNode`
in `src/app/vault.ts`. Intake: `detect` runs over the text (`useMemo`),
`cardsMode = asCards ?? detected.cards >= 2`; the delimiter row (`sides`
/ `cards` / `write`; `.delim-pick` buttons styled as the inspector's
`default-card` row, a `custom` input per row that sets `{ custom }` and
reverts to the detected one when emptied; `one direction` / `both
directions`), the preview (`.cards-preview`, the first three cards as
`.card-span` rows through `CardText`, moved to `src/app/CardText.tsx`
from `Lenses.tsx`), the count line (`N cards · M lines not cards · K …
dropped`) with `as a source →` at its end, and in the ordinary stats row
`as cards →` to summon the row when detection found fewer than two; the
h1 reads `Add a deck`; the title defaults to `cards`; `place` calls
`importDeckNode` and opens the deck lens. `.csv` / `.tsv` join
`TEXT_EXT` and the picker. Smoke: `ILMI_SMOKE=cards-text`. Tests: 299
(+23 in `cards.test.ts`: each delimiter, chunking, three cells, the
prefix pair over blank- and newline-separated input and continuation
lines, detection on both lists, a Quizlet tab export, the tie rule, prose,
the comma/dash guard, the Anki header, quoted records, the Anki export
with HTML and dropped things and its written forms, `reduceCell`, cloze
cells, the writer and its refusals, the deck with `## not cards` checked
through `parse` and `cardForm`, and `importDeck` into a scratch vault).
Open: the Anki row's delimiters cannot be overridden (the header is
trusted); `#columns:` field names are read past, not used; a leftover
holding ` :: ` in prefix mode writes as a card under `## not cards`;
`extra` fields beside a cloze are dropped, Anki's "Back Extra" among them;
no undo of `as a source →` once placed (the text is a source then);
detection runs 15 splits on every keystroke, fine for a paste, untested
on a very long text; the preview shows cards only, not the leftovers.
The intake reads pasted or dropped text as cards when it can: a
`src/import/cards.ts` module splits text by two delimiters, *between
front and back* and *between cards*, and the intake shows a delimiter row
when the split finds at least two cards.

- Between front and back, in detection order: a `Q:`/`A:` prefix pair
  (one line starting `Q:`/`Question:` then one starting `A:`/`Answer:`,
  case-insensitive, the pair's text joined by a space), a tab, ` :: `,
  ` - ` / ` – `, a comma; between cards: a blank line, a newline, a
  semicolon. Detection picks the pair of delimiters that yields the most
  cards with both sides non-empty and the fewest leftover lines; the
  user can override either from the row (a set of small buttons, as the
  deck's `default-card` row in the inspector, plus a `custom` field for
  each). A line that splits into more than two cells keeps the first as
  the front and joins the rest with ` / ` (Anki's extra fields).
- Anki's text export is recognised by its `#separator:`, `#html:`,
  `#tags column:`, `#deck column:`, `#notetype column:` header lines: the
  separator is taken from the header, HTML is reduced to text through the
  existing import pipeline (`src/import/readable.ts` / `text.ts`), the
  tags, deck, and notetype columns are dropped. `{{c1::x}}` in a cell is a
  cloze card and the cell is written whole; Anki's `{{c1::x::hint}}`
  loses the hint (FORMAT.md §5.1), counted. `[sound:…]` and `<img>` are
  dropped, counted.
- Each card is written as `front :: back` (one direction) or
  `front ::: back` when the row's *both directions* toggle is on; a card
  whose front or back contains a newline is written in the multi-line
  form with `?` / `??`. The deck lands as `type: deck`, no `default-card`,
  the title from the intake's name field (default `cards`), in the chosen
  folder, like a source. Lines that did not split are kept at the end of
  the file as plain paragraphs under a `## not cards` heading, so nothing
  pasted is lost, and the preview says how many.
- The preview under the delimiter row shows the first three cards as the
  deck lens would, the count (`N cards · M lines not cards`), and the
  dropped-things count. `place & open` opens the deck lens.

Done when: `cards.test.ts` covers each delimiter, the prefix pair across
blank-separated and newline-separated input, auto-detection choosing the
delimiters on a Quizlet-style tab export, an Anki text export with
headers and HTML, a cloze cell, three-cell lines, and a text with no cards
(the intake then behaves as before, no row); the written deck parses with
no diagnostics and `cardForm` on every card paragraph; `ILMI_SMOKE=cards-text`
pastes a `Q:`/`A:` list and a tab list, reads the row's choice, flips a
delimiter, places both, and logs each file's lines; screenshots read.

### [x] 17. Cards from Anki — drop an `.apkg`, each deck lands as a deck file with its progress
Done 2026-10-18, commit `cec823b`.
Notes: `src-tauri/src/anki.rs` is the reader, `read_anki_package(path)`
the command (registered in `lib.rs` beside `read_dropped_bytes`; the path
is read as a drop, nothing added to the fs scope). Crates: `zip` 9 with
only `deflate`, `zstd` 0.14, `rusqlite` 0.40 with `bundled` and
`collation` (Anki's name columns are `collate unicase`, a collation Anki
registers itself; the reader registers a lowercase one so a schema 18
database loads). The collection is taken in the order `collection.anki21b`
(zstd, schema 18) → `collection.anki21` → `collection.anki2` (schema 11),
written to a temporary file (`TempFile`, removed on drop) and opened
read-only. Schema 11 reads `col.crt`, `col.models`, `col.decks`; schema 18
reads `notetypes`, `fields`, `templates` (the question format is field 1
of the protobuf `config` blob, read by a schemaless scanner,
`proto_string`), and `decks` (U+001F in names → `::`). Notes split `flds`
on U+001F; cards come back with their home deck and original due when
they sit in a filtered deck (`odid` / `odue`). The `media` entry is only
classified (`json`, `zstd`, `other`, `none`). JSON shape: `AnkiPackage {
crt, schema, media, decks, notetypes { id, name, fields, cloze, templates
{ name, front } }, notes { id, notetype, fields, tags }, cards { id, note,
ord, deck, type, queue, ivl, due, factor, reps, lapses } }`, camelCase.
Fixture: `npm run fixture:anki` runs the Rust test
`reads_the_two_deck_package` with `ILMI_ANKI_FIXTURE` set, which copies
the package it built to `src/import/__tests__/anki/two-decks.apkg` and
writes what it read as `two-decks.json`; both are byte-stable across runs
(zip entries dated 2026-01-01, SQLite vacuumed). The Rust route was taken
over a `node:sqlite` script because the builder already lived in the test.
`src/import/anki.ts`: `creationDay(crt)` reads the epoch at noon so the
day holds in any zone within twelve hours; `difficultyOf(factor)` = 5 +
(2500 − factor) × 0.0025, clamped 1–10, one decimal; `seedOf(card, day0)`
for type 2 only (`due` = day0 + due days, `last` = due − ivl, `s` = `ivl`,
`r`, `l`); `kindOf(notetype)`: cloze by flag, basic = one template,
reversed = two with the second's front showing field 2 and not field 1
(filters like `{{text:Back}}` allowed), else other; `cardOf(note,
notetype, cards, day0, dropped)`: fields through `reduceCell(f, true,
dropped)`; a cloze written whole (a single group's schedule on the bare
line, else `sr cN` per group from `ord + 1`, a card for a group the text
lacks counted under `schedules`), extra cells counted under `extra`; a
pair from the non-empty cells, `:::` only when the notetype is reversed
*and* the note has its `ord 1` card, the lowest card's schedule kept and
the other review cards counted under `schedules`; `null` (counted under
`notes`) when fewer than two cells survive or `cardText` refuses.
`mapPackage(pkg)` → `Mapped { decks: MappedDeck { name, dir, title, doc,
cards, scheduled }, empty, other, dropped: AnkiDropped, media }`, decks
in name order, `Parent::Child` → `dir ['Parent']` (through `fileName`) and
`title 'Child'`; a deck with no card after mapping counts as `empty`.
`deckDoc` now formats each card with `formatBlock`, so schedules ride
along; `droppedLabel(d, more)` takes extra `[n, one, many?]` counts.
Vault: `folderIn(dir, name)` (the folder, made when missing; a document's
name gives its children directory). App: `importAnkiNode(dir, decks)` →
paths; `readAnkiPackage` and `APKG_EXT` in `fetch.ts`. Intake: `.apkg` by
drop or the picker; the paste field gives way to `.deck-list` rows (`Parent
/ Child`, `N cards, M scheduled`), the count line (`N cards in M decks ·
K empty decks skipped · N from other notetypes · … dropped`) with `not
this →`, no title field, `lives in` and the place buttons; h1 `Add decks`
(or `Add a deck`); `place` writes each deck, a notice `placed · N cards in
Deck` per deck, `place & open` opens the first. Smoke: `ILMI_SMOKE=anki`,
`ILMI_APKG=<path>` names the package (else `two-decks.apkg` in the
vault). Tests: 318 (+19 in `anki.test.ts`), `cargo test` 5. Open: the
user's own export has not been tried (none provided); media is not
copied, only `[sound:…]` / `<img>` counted; suspended and buried cards
(`queue` < 0) import as ordinary cards, the format has no suspension;
relearning cards (type 3) get no line, as learning cards; `tags` are read
and dropped silently; a note's cards split across decks make one card per
deck; the deck list and the count line are read-only, no per-deck pick;
the count line wraps to two lines at the default width when many things
were dropped; the dropped `media` form is in the mapping but not shown.
A `.apkg` is a zip holding an SQLite database (`collection.anki2`, or
`collection.anki21b` compressed with zstd in newer exports) plus a `media`
map. The webview cannot read SQLite, so the Rust side does:
`read_anki_package(path)` in `src-tauri/src/anki.rs` (crates `zip`,
`zstd`, `rusqlite` with `bundled`) unzips to a temp dir, opens the
database, and returns JSON: the collection's creation epoch, decks (id,
name), notetypes (id, name, field names, cloze flag, template count; from
the `col.models` / `col.decks` JSON in old schemas or the `notetypes`,
`fields`, `templates`, `decks` tables in schema 18), notes (id, notetype,
fields, tags), and cards (note, ord, deck, type, queue, ivl, due, factor,
reps, lapses). Media files are not extracted in this milestone.

`src/import/anki.ts` maps that to vault files, after
`src/import/supermemo/docs.ts`:

- One deck file per Anki deck that has cards, `type: deck`; `Parent::Child`
  becomes `Parent/Child.md` under the chosen folder, the deck's own name as
  the title. Empty decks are skipped, counted.
- A note on a one-template notetype → `front :: back` from its first two
  fields (more fields joined with ` / `, as 16); a two-template notetype
  whose second template is the reverse (`{{Back}}` on its front) →
  `front ::: back`; a cloze notetype → the first field written whole, its
  blanks kept, hints stripped and counted; anything else → first field
  `::` the rest, counted under `other notetypes`. Field HTML goes through
  the same reduction as 16. A note whose cells are empty after reduction
  is dropped, counted.
- Progress: a review card (type 2) seeds `<!-- sr … -->` as `seedOf` does
  for SuperMemo: `due` from the creation epoch plus `due` days,
  `state=review`, `stability=ivl`, `ivl`, `reps`, `lapses`, `last` = due
  minus `ivl`, `difficulty` from the ease factor on a straight line
  (2500 → 5, 1300 → 8, clamped to 1–10). New and learning cards get no
  line. A cloze note's cards seed `<!-- sr cN -->` per group from each
  card's `ord` + 1; a reversed note's two cards keep only the forward
  card's schedule (one schedule per bidir card, FORMAT.md §5), the other
  counted.
- The intake takes `.apkg` from the picker and a drop (as `.pdf` in 15):
  the preview lists the decks with their card counts and the dropped
  counts; `place` writes the files and logs a summary line per deck.
  `scripts/import-anki.ts` is not needed; the window is the way in.

Done when: a `cargo test` in `anki.rs` builds a two-deck package in a
temp dir with `rusqlite` (one basic note, one reversed note, one cloze
note with two blanks, one empty deck; schema 11 is enough) and reads it
back; `anki.test.ts` maps that package's JSON (saved as a fixture under
`src/import/__tests__/anki/`) to files that parse with no diagnostics,
with the seeded `sr` lines checked against the arithmetic above;
`ILMI_SMOKE=anki` drops the fixture package, built into an `.apkg` by a
small script (`npm run fixture:anki`, Node's `node:sqlite` or the Rust
test writing it out), reads the preview, places it, opens a deck, and
logs each file's lines; screenshots read; the user's own export tried
when they provide one.

## Blanks inside math

Math is opaque to blank scanning (§5.1), so a formula can be an answer but
nothing inside a formula can be one, and a line of an `align` environment
cannot be a blank. The user asked for exactly that: "if i cloze a line in
align environment or something". The rule below keeps every existing
formula meaning what it did: `{{` is legitimate TeX (`\binom{n}{{k}}`,
`x^{{a}}`), but `{{c1::` never is.

### [x] 18. Blanks inside math — `{{cN::…}}` inside a formula is a blank, closed by the balanced `}}`
Done 2026-10-18 on the branch `worktree-agent-aa0c5ff44353b39cb`, commit
`5716742`, beside milestone 17's session on main.
Notes: `src/format/cloze.ts` carries the rule in `clozeSegments(text)`
(new, exported with `MathSeg` / `CardSeg`): a math span found by
`mathSpanEnd` is scanned inside for the numbered form only (`MATH_OPEN`,
`{{c?N::`), closed by `mathBlank` at the `}}` that balances the braces
opened since `::` (a backslash skips the brace after it); a `}` at depth
zero not followed by `}`, or no close before the formula ends, leaves the
`{{` as TeX. A formula with at least one blank is a `MathSeg { span,
display, parts }`; one without stays inside the surrounding string, so
`richHTML` renders it as before. `clozeParts` is now the flattening of
the segments (the delimiters and TeX become string runs around the
blanks), so `blanks`, `cardGroups`, `numberBlank`, and `ownBlank`'s
indices are untouched; a blank found inside math carries `math: true`.
`mathSpanEnd` is unchanged, which is what makes "an answer that closes
the math early" literal: `$E = {{c1::m$ c^2}}$` is the span `$E =
{{c1::m$` with no close inside it. FORMAT.md §5.1 and §11 say all this.
Rendering (`src/app/Reader.tsx`): `mathBlanksHTML(seg, stateOf, cls)`
renders the formula once per state through KaTeX with `throwOnError`
on and `output: 'html'` (no MathML annotation, so the source is not in
the HTML); a hidden blank is `\colorbox{…}{$\phantom{answer}$}`, a
revealed one `\colorbox{…}{$answer$}` (`\displaystyle` inside a `$$`
span), another group's blank plain. KaTeX takes a colour, not a class,
and `trust` stays off, so two sentinel hexes go in and come out as
`var(--fg-5)` / `var(--accent-soft)` in the emitted `style`. An answer
is boxed piece by piece between its top-level `&` and `\\`
(`alignPieces`), so a blank spanning an `align` line keeps its alignment
mark outside the box, which KaTeX would otherwise refuse. The chip is
`.math.blanks` with `data-blanks` (this card's blanks in it) and
`data-revealed`; `data-tex` is on it only while nothing is hidden. TeX
KaTeX refuses falls back to the source in `<code class="tex">` with the
blanks as text blanks. `clozeHTML(text, stateOf, cls)` renders a whole
cloze card (text blanks as spans of `cls(state)`, formulas through
`mathBlanksHTML`), `answerHTML(blank, display)` a blank's answer alone
(TeX as math, an align line through `aligned`); `cardHTML` uses
`clozeHTML` with every blank revealed and `.cz`, so the reader and the
deck lens show a formula's blanks on the accent. The session's cloze
front is one `clozeHTML` string now (`.cloze` / `.cloze.revealed` /
`.cloze.ctx` for text, the chip for math) with one click handler: a
click on an own text blank or on a chip with own blanks reveals; the
answer face lists own answers through `answerHTML`. Composer: `⌘B` on a
selection inside a formula in the textarea writes `{{cN::…}}` with the
lowest unused N (`insideMath` / `withBlank`, exported for the test).
Corpus: `vault/papers/maxwell.md` (an `align` block with `c1` as a
right-hand side and `c2` as a whole line, `{{c1::x^{2}}}` inline, a
`\binom{n}{{k}}` block that stays prose), `mangled/math-blanks.md` (a
brace too many, `{{k}}` and `x^{{a}}` in math, an answer closing the
math early, an unbalanced blank in a `$$` block, and the same shapes
outside math as cards). Queue counts: upcoming 17 → 20, cards 26 → 29,
today 17 unchanged (maxwell's three blanks are due in June); the vault
walk lists `papers/maxwell`. `mangled/code-and-math.md`'s `$$` block
with `{{c1::x_i}}` is a card now, on purpose. Dev: `ILMI_SMOKE=math`
(reader chips, then a session over maxwell's three blanks, the first
revealed by a click on the chip, each graded, shots `math-reader`,
`math-N-hidden`, `math-N-revealed`), written on the branch and run after
the merge (`bfcc00d`): reader chips `data-blanks` 2 and 1, the session's
three cards boxed hidden and on the accent revealed, the first by a click
on the chip, three `sr` lines rewritten; captures read (BUILD-LOG
2026-10-18, milestone 18). Tests: 308 (+9: the math rule's cases and the two corpus files in
`format.test.ts`, the round trips and mutations of both files, the
maxwell formula hidden / revealed / as context, the reader and deck
rendering and the answer face, the KaTeX fallback, and the composer's
numbered form in `reader-view.test.ts`). Not done / open: `m` on a
selection inside a math chip is not mapped into the TeX; the chip is an
atom whose `leafText` is its source, so the composer is seeded with the
formula and the blank is then made with `⌘B` in the textarea (how
`posAtDOM` lands inside KaTeX output is unverified without the window).
The phantom's glyphs remain in the DOM with `color:transparent`, as a
text blank's answer does; only the TeX source and the MathML are kept
out of the HTML. Queue rows, the composer preview, and `CardText` show
a math blank as text (the `$` and TeX literal around a boxed answer).
The box is KaTeX's `\colorbox` padding, a little tighter than the text
blank's. A formula rendered in a hidden state and again revealed is two
KaTeX runs, fine for one card. The e-ink theme's `--fg-5` box is what
the text blank gets too.
- FORMAT.md §5.1: inside `$…$` or `$$…$$`, the numbered form `{{cN::…}}`
  (also `{{N::…}}`) opens a blank; the unnumbered `{{x}}` stays literal.
  The blank closes at the `}}` that balances the braces opened since
  `::`, not the first `}}`, so `{{c1::x^{2}}}` has the answer `x^{2}` and
  `{{c1::\frac{a}{b}}}` the answer `\frac{a}{b}`; an unbalanced blank is
  literal. Outside math nothing changes. §11's note about the `$$` block
  is rewritten. The parser's `mathSpanEnd` / `clozeParts` / `blanks` in
  `src/format/cloze.ts` carry the rule, and `ClozePart` records that a
  blank sits inside math (`math: true`) so renderers can tell.
- Rendering (`richHTML` / `mathHTML` in `src/app/Reader.tsx` and whatever
  the deck lens, composer preview, and session faces use): a formula with
  blanks is rendered by KaTeX once per state. Hidden, each of this card's
  blanks becomes a box the width of the answer, `\boxed{\phantom{…}}` or
  `\colorbox` over a phantom of the answer; revealed, the answer is
  shown highlighted (`\colorbox` with the accent-soft colour, or a
  `\class`-free equivalent — KaTeX's `trust` stays off); another group's
  blank in the same formula is shown plain, as `.cloze.ctx` is. The
  session's blank count and `.cloze` / `.cloze.revealed` / `.cloze.ctx`
  classes keep working for text blanks; math blanks live inside the
  `.math` chip, so add `data-blanks` on the chip for the smoke to read.
  Clicking the chip reveals, as clicking a text blank does.
- Composer: making a cloze from a selection inside a formula (the `m` key
  on a selected `\rho / \epsilon_0`) writes `{{cN::…}}` around it in place;
  if the composer cannot see inside the math chip's TeX, record that as an
  open item rather than forcing it.
- Corpus: `vault/papers/maxwell.md` (a frozen source with a `$$\begin{align}
  … \end{align}$$` paragraph holding two numbered blanks on two lines, one
  inline-math paragraph with `{{c1::x^{2}}}`, and one `$$` block with a
  literal `\binom{n}{{k}}` that stays prose) and `mangled/math-blanks.md`
  (an unbalanced blank, an unnumbered blank inside math, a blank whose
  answer closes the math early). Queue counts in `schedule.test.ts` move
  accordingly; say by how much in the notes.

Done when: `format.test.ts` covers the balanced close, the unnumbered
literal, the unbalanced literal, a blank spanning an `align` line, and the
round trip of both corpus files with no diagnostics; `reader-view.test.ts`
renders the maxwell formula hidden (a box, no answer text in the HTML),
revealed (the answer text present), and with the other group as context;
`npm run typecheck` and the suite green. The window check (a smoke mode
`ILMI_SMOKE=math` that opens maxwell, enters the session on its cards,
shoots hidden and revealed) is written but NOT run by you: the window and
port 1420 belong to the other session right now. Say so in the notes.

## Books

A PDF is read in its own layout (15); a book in EPUB is reflowable text,
so it wants the ordinary reader, not a lens. The user asked for "EPUB
incremental reading"; the cheap and right path is import: the book's
chapters land as sources in a folder named for the book, in reading order,
and the three loops run over them as over any source. Nothing in the
format changes.

### [x] 19. EPUB — drop a book, its chapters land as sources in reading order
Done 2026-10-18, commit `57bbc85`.
Notes: `src-tauri/src/epub.rs` is the reader, `read_epub(path)` the
command (registered in `lib.rs` beside `read_anki_package`; the path is
read as a drop, nothing added to the fs scope). Crate: `quick-xml` 0.42
(already in the lock through Tauri), read leniently with `check_end_names`
off and `allow_unmatched_ends` on; a document that stops parsing yields
what came before the error; entities come as `GeneralRef` events and are
resolved by hand (character references, the XML five, and the HTML dozen
a nav document tends to carry; anything else is nothing). The container's
`rootfile` (the OEBPS one preferred), the OPF's `dc:title` (first),
`dc:creator` (all), `dc:language`, `manifest/item` (`id`, `href`,
`media-type`, `properties`), `spine/itemref` (`idref`, in order) and
`spine@toc`. Titles: the `properties="nav"` item's `<nav epub:type="toc">`
links, else (or when it names nothing) the NCX from `spine@toc` or the
`application/x-dtbncx+xml` item, its `navPoint`s' `navLabel/text` +
`content@src`; hrefs resolve against the document's directory (`resolve`:
fragment and query off, percent-escapes decoded, `.`/`..` folded), the
first entry per path wins. Spine items that are not XHTML (`media-type`
`application/xhtml…` / `text/html`) or that name no entry are left out
silently. JSON: `Epub { title, creators, language, items: { href, html,
title: string | null, nav: bool }[], images: href[] }`. Fixture: `npm run
fixture:epub` runs `reads_the_three_chapter_book` with `ILMI_EPUB_FIXTURE`
set, writing `src/import/__tests__/epub/three-chapters.epub` + `.json`
(byte-stable: `mimetype` first and stored, every entry dated 2026-01-01).
`src/import/epub.ts`: `reduceChapter(html, dropped)` parses the XHTML with
`DOMParser` as HTML and tidies the DOM before the intake's own `textOf`
(the direct path; `readable()` is not used): back-reference anchors out
(`epub:type` `backlink`, `role=doc-backlink`, or a `#` link whose text is
only return glyphs), `img`/`svg` out with a `<p>[figure: alt]</p>` where
one had alt text (an svg's `<title>`), `em`/`i` → `*…*`, `strong`/`b` →
`**…**` innermost first with the surrounding whitespace kept outside the
marks; it also returns the first heading's text. `withoutTitleHeading`
drops the first heading block (within the first three blocks) when it
reads as the title, comparing with case, punctuation, and spacing set
aside. `mapBook(epub)` → `MappedBook { title, creators, chapters: {
n, name, title, text, words }, words, minutes, dropped: { images,
figures, short } }`: nav items skipped silently, items under `MIN_WORDS`
(30) skipped and counted as `short`, the title from the toc, else the
heading, else `chapter NN`; `name` = `fileName('NN title')` with `NN`
padded to the count's width, two at least (`position`). `readingLabel`
says `~N min` under an hour, else `~H h` to the half hour. Vault:
`ImportSpec.name` (the file name when not the title's), so `importDoc`
writes `title:` as a field. App: `importBookNode(dir, { title, chapters })`
makes the folder with `createFolder` (a free name, so a second copy lands
beside the first as `Book 2`) and one `importDoc` per chapter; both
folders open. `readEpub` / `EPUB_EXT` in `fetch.ts`. Intake: `.epub` by
drop or the picker; the paste field gives way to `.book-list` (the
creators in a mono line, then rows `NN  title` / `N words`), the count
line `N chapters · M words · ~H h · K short pages skipped · N images
dropped` with `not this →`, the title field defaulting to `dc:title`
(`book` when none), h1 `Add a book`; `place & open` writes the folder,
notices `placed · N chapters in Book`, opens the first chapter. Smoke:
`ILMI_SMOKE=epub`, `ILMI_EPUB=<path>` names the book (else
`three-chapters.epub` in the vault); shots `epub-intake`, `epub-chapter`,
`epub-reading`. Tests: 344 (+17 in `epub.test.ts`), `cargo test` 9 (+4).
Open: the user's own book has not been tried (none provided; drop one on
the intake, or `ILMI_SMOKE=epub ILMI_EPUB=<path>`); the reader showed
`*emphasis*` with its asterisks until 25 drew it (closed there); a
footnote reference's number lands glued to its word
(`afternoon.1`) and the note's text stays as a paragraph where the `aside`
was; images are counted and not copied (the format has no place for them
beside a source); `linear="no"` spine items land like the rest; a
chapter number set as its own paragraph before the heading stays as a
one-line paragraph; the chapter list is not capped, a long book scrolls
the intake; `dc:language` is read and unused; two toc entries into one
file keep only the first, the second's anchor is not split into an
extract.
An `.epub` is a zip: `META-INF/container.xml` names the OPF package file,
whose `<manifest>` lists the files and whose `<spine>` gives the reading
order of XHTML items; chapter titles come from the navigation document
(`nav.xhtml`, the `<nav epub:type="toc">`) in EPUB 3 or `toc.ncx` in
EPUB 2, `<dc:title>` / `<dc:creator>` from the OPF metadata. The Rust side
reads it, as 17 reads a package: `read_epub(path)` in
`src-tauri/src/epub.rs` (the `zip` crate already present) returns JSON:
title, creators, language, and the spine items in order, each with its
href, its XHTML as a string, and the toc title that points at it (or at
an anchor inside it) when one does. Images are listed by href, not
extracted.

`src/import/epub.ts` maps that to vault files:

- One folder named for the book (the intake's title field, defaulting to
  `<dc:title>`), under the chosen folder; one source per spine item,
  `NN title.md` with `NN` the two-digit position so the tree reads in
  order, the title from the toc, else the item's first heading, else
  `chapter NN`. Each is `type: source`, `imported: <today>`, `title:`,
  and its XHTML reduced to Markdown by the existing HTML path in
  `src/import/` (headings, paragraphs, emphasis, lists, block quotes
  kept; the chapter's own `<h1>` dropped when it equals the title; links
  reduced to their text, footnote back-references dropped). Use the
  direct HTML-to-Markdown reduction, not the readability pass meant for
  web pages, so nothing in a chapter is judged boilerplate.
- Spine items with fewer than 30 words after reduction (cover, title
  page, copyright) are skipped and counted; a nav document in the spine
  is skipped. Images are dropped and counted, with a `[figure]` marker
  where one stood when it had `alt` text (`[figure: <alt>]`), nothing
  otherwise.
- The intake takes `.epub` from the picker and a drop (as `.apkg` in 17):
  the preview shows the title and author, `N chapters · M words · ~H h`
  on the reading-time line the intake already draws, and the dropped
  counts; `place & open` writes the folder and opens the first chapter.
  Chapters are not enrolled in reading; `r` on one starts it, as on any
  source.

Done when: a `cargo test` in `epub.rs` builds a three-chapter EPUB 3 in a
temp dir (OPF, nav with two of the three titled, a cover item of five
words, one image reference with `alt`) and reads it back, and writes it
to `src/import/__tests__/epub/three-chapters.epub` plus `.json` when
`ILMI_EPUB_FIXTURE` is set (`npm run fixture:epub`, as `fixture:anki`);
`epub.test.ts` maps the fixture's JSON to files that parse with no
diagnostics, checked line for line, with the cover skipped, the untitled
chapter named from its heading, the figure marker in place, and the
folder's names in order; an EPUB 2 package with `toc.ncx` is covered by
a second small Rust case; `ILMI_SMOKE=epub` drops the fixture, reads the
preview, places it, opens the first chapter, presses `r`, and logs the
tree and each file's first lines; screenshots read; the user's own book
tried when they provide one.

## Plugins

The user: "I think we're at a point where adding plugins could be
reasonable … built in dictionary lookup that can also add words I don't
know to a vocab deck … or Obsidian web clipper support. I want to model
off of Obsidian's own plugin ecosystem / support" and then: "the plugin
design shouldn't map onto Obsidian, I meant just by being able to support
a plugin ecosystem". So: the *ecosystem* is Obsidian's — a folder of
plugins in the vault, on and off from settings, installed from inside the
app, a developer kit; a community directory with install and update from
an index is the user's "can wait", so for now a plugin is added from a
file — and the
*API* is ilmi's own, named for ilmi's things: the vault and its documents,
the three loops, the queue and the session, the lenses, the selection
cue, the palette, the inspector. Nothing is borrowed for familiarity's
sake. Plugins are off until the user turns one on, run with the app's
access to the vault and the network and nothing else (the fs scope is the
vault; there is no Node), and a plugin's error never takes the app down.
The API is small and versioned; everything a plugin can do, the app does
through the same functions.

Layout: `<vault>/.ilmi/plugins/<id>/plugin.json` (`id`, `name`,
`version`, `api` — the API version it was written against — `description`,
`author`, `repo`), `main.js` (one CommonJS bundle; `module.exports.activate
(ilmi)` is called with the app handle and may return a function to run on
deactivate), optional `style.css`, `data.json` for its settings;
`<vault>/.ilmi/plugins.json` is the list of enabled ids. `.ilmi/` is not a
document and never appears in the tree. The repo carries the plugins it
ships under `plugins/<id>/` as plain ES modules with a tiny build (`npm
run plugins`, esbuild) so they are tested with vitest and copied into a
vault; `plugins/ilmi.d.ts` is the typed API and `PLUGINS.md` at the repo
root documents it and how to publish.

### [x] 20. Plugin runtime — the loader, the enable list, the `ilmi` handle, a settings section
Done 2026-10-18; commit `91326a0`.
Notes: `src/plugins/api.ts` is the typed handle (types only; `npm run
plugins` copies it verbatim under a header to `plugins/ilmi.d.ts`, and a
test holds the two equal). `src/plugins/runtime.ts` is the pure side:
`PluginHost(vault, bridge)` with `start()` (reads `.ilmi/plugins.json`,
scans `.ilmi/plugins/*/plugin.json`, activates what is on, subscribes to
the vault), `stop()`, `rows()`, `setEnabled`, `reload`, `install(files, {
replace })`, `pluginCommands()` / `runCommand(id)` (ids are
`plugin:<id>:<command>`; the palette's `runCommand` default case hands
unknown ids there), `actionsFor(sel)` / `runAction`, `commandByKey` /
`actionByKey`, `runBlockHooks(el, ctx)` (once per element per hook until
the element's text changes), `setSelection` / `currentSelection`, `emit`
(`grade`, `read-on`, `worked-on`, `lens.open`, `lens.selection`, `queue`),
`settingsOf` / `settingValue` / `setSetting`, `subscribe` + `version` for
the UI. The bundle runs through `new Function('module', 'exports',
'require', code)`; `require` throws `plugins bundle their dependencies`.
CSP is `null` in `tauri.conf.json`, confirmed in the window: the smoke
logs `csp none; new Function runs`. Every plugin callback goes through
`guard`: a throw or a rejection calls `fail` → teardown, state `failed`,
notice `<name>: <message>`; the others stand. `api` ≠ 1 → state
`refused`, notice `<name> was written for api N, this is api 1`. A folder
whose manifest is unreadable or whose id is not the folder's name is a
`broken` row with the reason. Hot reload: `Vault.apply` now emits `{
kind: 'hidden', paths }` for dot-directory paths instead of dropping them
(the one change in `src/vault/vault.ts`; `vault.test.ts` asserts it); the
host debounces 400 ms per plugin, compares manifest/main/style texts with
what it loaded, and reloads with `reloaded · <name>`; a folder gone is
`removed · <name>` and the row goes; `plugins.json` edited by hand is
reconciled; `data.json` edited by hand reaches `store.on('change')`. Its
own writes are ignored for 2.5 s by path. `install` writes `plugin.json`,
`main.js`, `style.css`, `data.json` by name, refuses `no plugin.json in
that` / `no main.js in that` / a bad manifest, `<name> <v> is already
here` for the same id and version, and returns `{ status: 'replace' }`
when versions differ; the section shows `<name> <have> is here, this is
<incoming>` with `replace` / `keep`. `src/plugins/index.ts` is the app
side: the one host over the open vault (`startPlugins` after
`publishDocs` in `openVault`, `stopPlugins` before the old vault closes),
the `Bridge` (notices → `note`, `fetch` → plugin-http, `today` →
`dueToday`, `current` → `sessionEl.item`, `activeLens` → the active tab
through `tabKindOf`, popover/modal → `surfaces.ts`, `addStyle`), one
window keydown for plugin keys (an action's while a selection is up, else
a command's; silent in fields and while a plugin surface has focus; `e`
and `m` are refused at `addAction`), `toPluginSelection` (the sentence
around the selection through `context.ts`'s `contextOf`; the PDF lens
passes the text-layer line), `publishSelection`, `runBlockHooks`,
`emitGrade` / `emitDocAction`, `pluginCommands` / `runPluginCommand`,
`readPluginPackage` (a `.zip` through the Rust `read_plugin_zip`, a
folder through `allow_vault` + `tauriFs`), `addPluginFromPath`, and the
dev hook `pluginHooks.addFromPath`. `APP_VERSION = '0.1.0'` is a constant
there (tauri.conf has the same). `surfaces.ts`: `.plug-pop` under the
rect (flipped above when it would not fit), `.plug-overlay > .plug-modal`,
esc / outside press / `close()`, one of each; `plugins.css` styles them as
the palette, plus the tweaks section. `CueActions.tsx` renders the verbs
after `extract` and `card` in the reader's and the PDF lens's cue (both
build a `plugSel` memo and publish it in an effect). The reader runs the
hooks in a `requestAnimationFrame` after each build and each document
change, over `view.nodeDOM(off)` per top-level node, with ProseMirror's
`domObserver` (an internal) stopped around the walk so the observer does
not mark the block dirty and redraw it; the cleanup frees the frame slot
(StrictMode's double mount had left it set, which is why the first three
window runs never lit anything). The deck lens runs them over its row
refs; the session's `CardElement` over its two `.face`s. `Session.tsx`
emits `grade` after the write with the card as written, and `read-on` /
`worked-on` on an `on` action. Tweaks grows `PluginsSection.tsx`:
`plugins`, the one note line, a row per plugin (`name version author`,
`reload` while on, the `on`/`off` toggle), the error line, the settings
inline while running (text commits on blur/⏎, toggle, choice as a
`select`, note), the `replace` offer, `add a plugin` (zip picker) and
`from a folder` (directory picker), a Tauri drop on the section. Rust:
`src-tauri/src/plugin.rs`, `read_plugin_zip(path)` → `{ files: [{ name,
text }] }`, one leading folder stripped, `__MACOSX/` and `.DS_Store`
skipped, `not a zip` / `no plugin.json in the zip`; 3 tests. Repo:
`plugins/hello/` (`main.ts`, `plugin.json`, `style.css`),
`scripts/plugins.ts` (esbuild to cjs, a hand-rolled stored zip so
`plugins/dist/<id>.zip` is byte-stable, the corpus copy for `CORPUS_ON =
['hello']`), `plugins/dist/` gitignored, esbuild 0.28 as a dev
dependency, `PLUGINS.md`, README lines. Tests: vitest 385 (+31 in
`src/plugins/__tests__/plugins.test.ts` under jsdom over an in-memory fs
seeded from the corpus; `vault.test.ts`'s two `mkdir('.ilmi')` calls are
recursive now that the corpus carries it), 21 files; cargo 12 (+3).
Window: `ILMI_SMOKE=plugins` with `ILMI_PLUGIN_ZIP=plugins/dist/hello.zip`,
every step as intended on the fourth run; seven captures read; see
BUILD-LOG 2026-10-18, milestone 20.
Open: the `from a folder` picker, an OS drop on the section, and the
`replace` offer row were not seen in the window (the runtime paths are
tested); no plugin opens a popover or modal yet, so those are jsdom-only
until 21; `lens.on('open')`, `queue.on('change')`, `read-on` /
`worked-on` are wired but not exercised in the window; the PDF lens's cue
verb is the same component but was not clicked there; a failed plugin
stays in `plugins.json` (off and on, or `reload`, tries it again); a
plugin's DOM changes to a block stay until ProseMirror redraws that block
(turning the plugin off does not unlight); `lens.active()` reports
`source` for a document shown as pages; the `greeting` row's label and
field were jammed in the captures and got a gap afterwards, not
re-captured; `onBlock` on the reader skips when no plugin has a hook, so
a hook added later lights only after the next build or change (the
`plugins.version` effect covers turning on). For 21: `sel.context` is the
sentence; `ui.popover` returns the box, key handling inside is the
plugin's; `addCard` makes the deck with `type: deck` and no title;
`net.fetch` is the http plugin's `Response`.
- Loader (`src/plugins/`): read `plugins.json`, for each enabled id read
  `plugin.json` and `main.js` through the vault's fs, run the bundle with
  a `require` that serves nothing (plugins bundle their dependencies),
  call `activate(ilmi)` with a handle scoped to that plugin; everything it
  registers through the handle is collected and removed on deactivate —
  when it is turned off, the vault closes, or its files change on disk
  (hot reload, with a notice). The `api` field is checked against
  `ilmi.api`. A throw anywhere in a plugin is caught, logged, shown as a
  notice naming the plugin, and deactivates that plugin for the session.
- The handle, API v1 (`src/plugins/api.ts`, typed, published as
  `plugins/ilmi.d.ts`):
  `ilmi.commands.add({ id, name, key?, run })` → the palette and the key
  map; `ilmi.selection.addAction({ id, name, key?, when?, run(sel) })` →
  a verb on the selection cue after `extract` and `card`, `sel` = `{ text,
  path, block, rect, context }` (the sentence or line around it);
  `ilmi.render.onBlock(fn(el, { path, block, where }))` → after each block
  is drawn in the reader, the deck lens, and the card faces;
  `ilmi.vault` → files (`read`, `write`, `create`, `remove`, `rename`,
  `list`, `watch(fn)`) and documents (`doc(path)` parsed, `update(path,
  fn(doc))` through the format module, `addCard(deck, text, { sched? })`
  appending a card paragraph to a deck and creating the deck when
  missing, `addSource(folder, { title, text })` landing a frozen source);
  `ilmi.queue.today()` and `ilmi.queue.on('change', fn)`;
  `ilmi.session.current()` and `ilmi.session.on('grade' | 'read-on' |
  'worked-on', fn)`; `ilmi.lens.active()` (`{ path, kind }`),
  `ilmi.lens.open(path)`, `ilmi.lens.on('open' | 'selection', fn)`;
  `ilmi.ui.notice(text)`, `ilmi.ui.popover(rect, el)`, `ilmi.ui.modal(el)`
  (one quiet surface each, styled as the palette), `ilmi.ui.settings(fn
  (s))` with `s.text`, `s.toggle`, `s.choice`, `s.note` rendered under the
  plugin's row in Tweaks; `ilmi.net.fetch(url, init?)` through the http
  plugin, no CORS; `ilmi.store.load()` / `save(data)` → `data.json`;
  `ilmi.format` (parse, serialize, cardForm, cardFields); `ilmi.version`
  and `ilmi.api`. Every registration returns a disposer; the handle's
  `onDeactivate(fn)` takes more.
- Tweaks grows a `plugins` section (the one new section this allows):
  each plugin found under `.ilmi/plugins/` as a row with its name,
  version, author, a toggle, and its settings inline when it has any;
  under the heading, `a plugin runs with the app's access to this vault
  and the network`; a `reload` link per row for authors; and `add a
  plugin`, which opens the picker for a folder or a `.zip` holding
  `plugin.json` and `main.js` (and `style.css`), copies it into
  `.ilmi/plugins/<id>/` under the manifest's id (a zip read through the
  Rust side as 17 reads a package; refused with a notice when the
  manifest is missing or the id is taken, with `replace` offered when
  the versions differ), and turns it on. A folder or zip dropped on the
  section does the same. `PLUGINS.md` says how to package one: the
  three files, zipped flat.
- Sample: `plugins/hello/` (a command `hello: say hi` → a notice, a
  selection action `hello: count` → a notice with the word count, an
  `onBlock` that lights `[hello]` in prose, one text setting, one
  `session.on('grade')` that notices the grade). `npm run plugins` writes
  `plugins/dist/<id>/{plugin.json,main.js}`; the corpus vault gets
  `.ilmi/plugins/hello/` from it and `.ilmi/plugins.json` with `hello` on.

Done when: `plugins.test.ts` loads the sample from the corpus with a fake
fs and checks the command, the action, the block hook, settings
round-trip, `addCard` creating a deck that parses with no diagnostics,
the grade event, a throwing plugin deactivated with a notice and the
others untouched, an `api` mismatch refused with a notice, and deactivate
removing everything; the walk ignores `.ilmi/`; `ILMI_SMOKE=plugins`
opens Tweaks, reads the row, turns hello off and on, runs the command from
the palette, selects a passage and runs the action from the cue, finds the
lit `[hello]`, edits the setting, grades a card and sees the plugin's
notice, touches `main.js` on disk and sees the reload notice, removes the
plugin's folder and adds it back through `add a plugin` from a zip of
`plugins/dist/hello/` (the smoke drops it through a hook, as the intake's
file drop); screenshots read; `PLUGINS.md` and `plugins/ilmi.d.ts`
written.

### [x] 21. Dictionary — look a word up from the selection, add it to a vocab deck
Done 2026-10-18; commit `6ffabf5`.
Notes: `plugins/dictionary/` (`plugin.json`, `main.ts`, `style.css`,
`__tests__/`). `main.ts` exports the pure pieces and `activate`:
`trimWord` (whitespace collapsed, punctuation and symbols off the edges;
the Arabic comma included), `bare` (U+064B–U+0655, U+0670, and the tatweel
stripped — the hamza and madda marks and the dagger alif beyond the
brief's range, since classical texts carry them), `candidates` (the bare
word; then each clitic of `و ف ب ك ل ال لل س` off the front in that
order; then, after `و` or `ف`, the rest with one more clitic off, so
`وَالْكِتَابُ` tries `والكتاب`, `الكتاب`, `كتاب`; a Latin word adds its
lowercase, English Wiktionary's titles being case-sensitive; `ك` is a
clitic too, so `كتاب` would try `تاب` next, but the word itself is asked
for first), `vocalized` (the headword's vowels come from the selection —
the REST definitions endpoint carries no headword line — less the clitic
that came off, the shadda a sun letter took from the article, and the
case ending: `الذِّكْرُ` → `ذِكْر`, `كِتَابٌ` → `كِتَاب`; the bare form
when the text had no tashkeel), `languageFor` (the setting, else `ar` for
Arabic script and `en` otherwise), `requestUrl` (`{word}` encoded as a
path segment with spaces as `_`, `{lang}`), `htmlToText` (DOMParser,
`&nbsp;` and whitespace folded), `wiktionarySection` (the response is an
object keyed by language code with `other` for the rest; empty
definitions dropped, `form-of-definition` marked as a pointer, the first
`parsedExamples`/`examples` kept; the first section with entries when the
asked-for one is missing, so a Persian word with the default still shows
something, labeled), `stringsAt`/`entriesAt` (a JSON path for another
dictionary: `a[].b`, `[]` for each element), `firstDefinition` (the first
meaning that is not a pointer, else the first: `كتاب` gives `book`, not
`verbal noun of كَتَبَ`), `cardText` (` :: ` and `{{` kept out of the
sides; the context dropped when it is the definition), `lookup` (a 404
moves on, another status throws `the dictionary answered N`, a non-JSON
body throws). `activate`: five settings — `dictionary url` (placeholder
the Wiktionary template), `definitions at` (placeholder `wiktionary`; a
JSON path for another dictionary), `language` (`by script`), `deck`
(`vocab`), `context on the back` (a toggle; `context: true` is written to
`data.json` on the first activation so the toggle shows what the plugin
does) — and the action `look up` (key `d`, shown for selections of three
words or fewer). The popover: `.dict-pop` with `dir="auto"`, the word
while the lookup runs with `…`, then the headword (the selection beside
it when it differs), the language name, an entry per part of speech
(`h3` label, an `ol` of definitions, pointers dimmed, the example under
its definition), and `add to deck` with `a`; `nothing found for <word>`
with `tried a · b · c` when more than one form was asked; `could not
reach <host>` when the fetch rejects; the plugin never throws out of
`run`, so it stays on. `a` or the button → `addCard(deck, text)`, notice
`added to <deck name>`, the popover closes; the error's message as a
notice when the write fails. Corpus: `papers/archive/sutton-2019.md` has
a fourth paragraph with the sentence `الذِّكْرُ يَحْفَظُ العِلْمَ،
وَالْكِتَابُ يَحْفَظُ الذِّكْرَ.` for the smoke (no card, no document
added; the schedule counts stand); `scripts/plugins.ts` copies
`CORPUS_COPY = ['hello', 'dictionary']` into the corpus vault and turns on
`CORPUS_ON = ['hello']`, so the dictionary is there, off. Tests:
`plugins/dictionary/__tests__/dictionary.test.ts` (20) with four real
responses saved from the endpoint (`ذكر`, `كتاب`, `memory`, and the 404
body for `الذكر`); vitest's include grew `plugins/**/*.test.ts` and
tsconfig's `plugins`, so the plugins' TypeScript is typechecked now;
`src/plugins/__tests__/memfs.ts` holds the in-memory fs, the corpus seed
(the sample alone unless asked), `fakeBridge(answer)` with `fetched`, and
the small helpers, shared by both plugin test files. Handle gaps found
and fixed in `src/plugins/`, api still 1: `addCard` into a folder that
is not there threw `words: no such folder` (the api doc promised
`words/arabic.md`) — `ensureDoc` now makes the folders with
`vault.folderIn`; keys pressed inside a popover or modal reached the
app's window listeners (the session's `d` `p` ⏎, the reader's `e` `m`)
— `surfaces.ts` stops bare keys at the box, the plugin's own listeners
on it still run; a popover filled after it opened kept its first place
and could run off the bottom — a `ResizeObserver` places it again; a
verb run from its key left the cue up under the popover — `index.ts`
has `onPluginAction(fn)`, which the reader and the PDF lens use to put
the cue away as a click on the verb does. `PLUGINS.md`: the notes on
`addCard`, `ui.popover`, and tests, and a section on the two shipped
plugins; README one sentence. Tests: vitest 419 (+20), 23 files; cargo
12.
Window: `ILMI_SMOKE=dictionary` ran once (14:41 local) and got as far as
tweaks: the rows `dictionary 0.1.0 off, hello on`, the toggle → `on`,
`plugins.json ["hello","dictionary"]`, the five settings with their
placeholders (`context on the back` showing `on`), `data.json
{"context":true}`, the style on the page; the one capture showed the
Mac's lock screen — the session was locked, so the window was covered
and the webview's timers stalled there; the screen stayed locked for the
twenty minutes waited, so the lookup, the popover, the add, and the deck
were not seen in the window. The same steps run in jsdom
(`dictionary.test.ts`, *in the app*) over the real responses. Owed: the
window run from the cue onward with its captures (see BUILD-LOG). Also
found: vite's watcher followed the other agent's worktree under
`.claude/` and forced full reloads, so `vite.config.ts` ignores
`**/.claude/**` now.
Open: the session's card faces and the deck lens have no selection cue,
so `look up` is not reachable there (the brief's "a card face" waits on
a cue there); the REST definitions endpoint has no headword line, so a
word selected without vowels gets a bare headword; the card takes the
first meaning, there is no picking another from the popover; no check
for a word already in the deck; the `other` section's entries are
labeled with the language name Wiktionary gives; a custom dictionary's
JSON path is tested on a synthetic response only; `language` fixes the
Wiktionary section but does not change the Wiktionary site (`{lang}` in
`dictionary url` does); only one clitic comes off, two after a
conjunction, so `بِالْكِتَابِ` finds `الكتاب`'s page if there is one and
otherwise nothing; the smoke's screenshot of the English popover and the
deck are read but the e-ink and dark themes were not captured.
`plugins/dictionary/`, the first real plugin and the proof of the API:
the user reads classical Arabic and wants a word looked up and, when
unknown, added to a deck without leaving the page.
- Selection action `look up` (key `d`): the selected word is normalized
  (Arabic: the tashkeel U+064B–U+0652 and tatweel stripped; then the
  word as is, then with one of the clitics `و` `ف` `ب` `ك` `ل` `ال` `لل`
  `س` removed, tried in order until something comes back) and looked up
  through Wiktionary's REST definitions endpoint
  (`https://<lang>.wiktionary.org/api/rest_v1/page/definition/<word>`,
  the entry for the setting's language section, English Wiktionary by
  default, which covers Arabic well); the definitions, part of speech, and
  the headword with its vowels when the entry has them are shown in a
  popover under the selection. No result: `nothing found for <word>`,
  with the forms tried. Any dictionary with a URL template and a JSON
  path can be set instead (settings: `dictionary url`, `language`, `deck`,
  `context`).
- `add to deck` in the popover (key `a` while it is open): writes
  `<headword> :: <first definition>` to the deck in settings (default
  `vocab.md` at the vault root, created when missing) through
  `ilmi.vault.addCard`, with `sel.context` as a second line of the back
  when `context` is on; the card is then in the queue as any new card. A
  notice names the deck.
- Works wherever the selection cue works: a source, an EPUB chapter, the
  PDF lens text layer, a card face.

Done when: `dictionary.test.ts` covers the normalization and clitic
order, the request URL, the response mapping on a saved Wiktionary
response for an Arabic word and for an English one, the card text, and
the deck created on first add; `ILMI_SMOKE=dictionary` turns the plugin
on in the corpus, selects an Arabic word in a corpus source that gets one
line of Arabic for this (an addition to an existing paper, noted in the
corpus), runs `look up` against the live endpoint (the intake smoke
already fetches; if offline, log that and stop), reads the popover, adds
the word, and logs the deck file's lines and the queue count; screenshots
read; API gaps found while writing it fixed in `src/plugins/` and noted.

### [x] 22. Clipper — `ilmi://` opens a door the web clipper can use
Done 2026-10-18 on the branch `worktree-agent-ad643755f471ccef6` (worktree
`.claude/worktrees/agent-ad643755f471ccef6`), beside milestones 19 and 20
on main; commit `3a60270`.
Notes: `src/app/clip.ts` is the pure side: `parseClipUri(uri)` → a
`ClipNew` (`name`, `content`, `folder`, `url`, `vault`, each only when
given and non-blank), a `ClipOpen` (`path`, `vault`), or a `ClipRefusal`
whose `reason` is the notice (`not an ilmi link`, `nothing to clip`, `not
a web address`, `nothing to open`, `no such link: <verb>`). The verb is
the URL's host, else its first path segment, so `ilmi://new`, `ilmi:new`,
and `ilmi:///new` all read; `file=` is taken as `path=` (Obsidian's name);
`folder` and `path` go through `cleanClipDir` (slashes at the ends, empty,
`.` and `..` segments dropped, so a link never climbs out of the vault); a
`url` that is not `http(s)` beside real content is dropped, alone it is
the refusal. `vaultMatches(named, root)` accepts the vault directory's
name or its whole path. `clipTitle` is the name, else the fetched title,
else `deriveTitle(text)`, else the address's host, else `clipping`.
`src/app/clipper.ts` is the handler: `handleUri(uri)`, a plain exported
async function that never rejects. It notes a refusal; with no vault open
it holds the link and lands it when one opens (a store subscription on
`vault`); a foreign `vault=` is `that link is for the vault <name>`; `new`
takes `content`, else `fetchReadable(url)` from `fetch.ts` (the intake's
path, so a page is Readability's article and plain text is itself;
failure is `nothing readable at that link`), `cleanText`, then
`importNode(dir, { title, text })` (frozen, `imported` today, not
enrolled, as any intake source), `openNode`, and `clipped · <title>`; the
folder is the link's, else the store's `clipDir`, made along the way with
`vault.folderIn` when missing (a failure there falls back to the root);
`open` tries the path, then `path.md`, over `files` and the folders, else
`nothing at <path>`; the window is focused after a landing
(`core:window:allow-set-focus`). `listenForClips()` (called once from
`App.tsx`'s mount effect, a module flag against StrictMode's double run)
takes `getCurrent()` for a launch link and `onOpenUrl` for the rest, the
same link twice within 2 s counted once. Setting: `clippings` in
`.ilmi/state.json` (`VaultState.clippings`, a folder path, `''` or absent
is the root), read on `openVault` through `cleanClipDir` into the store's
`clipDir`, written by `setClipDir` through `queueSave`; Tweaks has a
`clippings go to` row (`ClipDirPick`, a `select` over `folderPaths(tree)`,
the root as the vault's name, `.tw-sel` styled as `.tw-num`), shown while
a vault is open, under the budget row. Rust: `tauri-plugin-single-
instance` 2.4 (`deep-link` feature) registered first, its closure
unminimizing and focusing `main`; `tauri-plugin-deep-link` 2.4 next;
`plugins.deep-link.desktop.schemes: ["ilmi"]` in `tauri.conf.json`;
`register_all()` in `setup` under `cfg(any(windows, linux))`;
`deep-link:default` and the two window permissions in
`capabilities/default.json`. npm: `@tauri-apps/plugin-deep-link` 2.6;
single-instance has no guest package. README: the paragraph, the
bookmarklet, the Obsidian Web Clipper statement, the macOS note. Tests:
337 (+10 in `clip.test.ts`: each form, the folder cleaning, the vault
match, the verb spellings, garbage, the title order, the setting's
cleaning). Dev: `ILMI_SMOKE=clip`, written on the branch and run after the merge
(`94262db`): every step as intended on the second run, the first
having been doubled by Vite's one-time dependency reload; the OS
handoff from the shell is refused for the dev binary (macOS registers
the scheme from the bundle), so the built app is where it is checked;
see BUILD-LOG 2026-10-18, milestone 22.
- `ilmi://new?name=&content=&folder=&url=` →
  a frozen source: `content` as the text, else `url` fetched through the
  intake's existing readability path, `name` as the title (else the
  page's), in `folder` (else the Tweaks setting `clippings go to`, default
  the vault root), then the document opened and a notice. `ilmi://open?
  path=` opens a document. `vault=` is accepted and ignored when it names
  the open vault, refused with a notice otherwise. A bad URI is a notice,
  never a crash.
- README: the bookmarklet (`javascript:location.href='ilmi://new?url='+
  encodeURIComponent(location.href)+'&content='+encodeURIComponent(
  getSelection().toString())`) and a plain statement that the Obsidian
  Web Clipper targets `obsidian://` only, so pointing it here needs its
  fork or its clipboard mode plus a paste on the intake.

Done when: `clip.test.ts` parses each form (`new` with content, with url,
with folder, `open`, a foreign `vault`, garbage) into the action or the
refusal; the handler is a plain function the smoke can call with a URI,
and `ILMI_SMOKE=clip` calls it with `new?content=…`, `new?url=` (the
intake's sample address path, if the fetch is mocked there, else a real
page), and `open?path=`, logging the file written and the tab; in the
window run also `open 'ilmi://new?name=t&content=hi'` from the shell: on
macOS a dev binary may not own the scheme, so if nothing arrives, say so
and record that the built app (`npm run tauri build`) is where the OS
handoff can be checked; screenshots read.

## Opening

The welcome is one button and the app forgets the vault when it quits.
The user: "need to have some fleshed out opening menu & automatically
open to last vault opened whenever the app starts".

### [x] 23. Opening — a welcome that remembers, the last vault reopened on start
Done 2026-10-18 on the branch `worktree-agent-a34f19b66a3b6da95` (worktree
`.claude/worktrees/agent-a34f19b66a3b6da95`), beside milestone 20 on main;
commit `f52d36e`.
Notes: `src/app/recents.ts` is the pure side: `Recent { path, name,
opened }` (`opened` an ISO instant), `RECENTS_MAX` 8, `addRecent(list,
path, now)` (to the top, one per path, the oldest beyond eight dropped),
`forgetRecent`, `cleanRecents(raw)` (what storage held: bad rows out,
sorted newest first, capped), `vaultName(path)` (the directory's last
segment), `openedLabel` (`opened today` / `yesterday` / `3d ago` / `2mo
ago`, through `agoLabel` in `items.ts`, `dueLabel`'s words looking back),
`GONE` (`not where it was`), and `decideStart(list, reopen, present)` →
`reopen` the newest when the toggle is on and its folder is in `present`,
else `welcome`. Store: `reopen` is a fourth tweak (`ilmi.tweaks`, default
on, `setReopen`); `recents` is loaded and saved under `ilmi.recents` the
same way (`setRecents`); `gone` holds the paths probed and not found;
`started` is false until the start decision, so the welcome does not
flash before a vault reopens itself; `newVaultIn` is the parent folder a
new vault is being named in. `vault.ts`: `openVault` adds the path to the
recents, drops it from `gone`, sets `started`, and sets the window title
`<name> · ilmi` (`getCurrentWindow().setTitle`, `core:window:allow-set-
title` added to the capability); `closeVault()` stops the watcher and
resets the store to the welcome (title `ilmi`); `forgetVault(path)`;
`pickVaultParent()` (the folder picker, then `newVaultIn`); `newVault(
parent, name)` (`cleanName`, `allow_vault` on the parent, `already
there` when the folder exists, `mkdir`, `openVault`, then `importDoc` of
the starter and `read: due today` on it, opened); `probeVaults(paths)`
(`allow_vault` then `stat` on each, since a remembered path is outside
the fs scope until it is let in); `startFromRecents()` (probe, `gone`,
decide, reopen or `started`); `openInitialVault` runs in release too
now: dev `ILMI_SMOKE=welcome` runs its smoke before any vault opens,
dev `ILMI_VAULT` opens that vault, else the recents decide.
`src/app/starter.ts`: `STARTER_TITLE` (`start here`), `STARTER_TEXT`
(three headings, four short paragraphs, one inline q&a card; parses
with no diagnostics). `src/app/Welcome.tsx` replaces the block in
`App.tsx`: the palette's panel in the canvas (`.welcome-panel`, the rows
reuse `.palette-row` and the foot `.palette-foot`), the wordmark, the
README's first sentence lowercased as one italic line, `open vault` and
`new vault`, the name field (`<parent>/` dimmed, ⏎ creates, esc cancels,
a refusal in small type beside it), the rows (name, path dimmed, `opened
<when>` as the tag; a gone row dimmed with `not where it was` and a
`forget` shown on hover or selection), ⏎ / j k / o / n, a Tauri drag-drop
of a folder opened as a vault (the panel's hairline turns to the accent
while over), and a row whose open fails joins `gone`. The palette:
`open vault…`, `new vault…` (the parent picked first, then `closeVault`
so the name is taken on the welcome), `close vault`; the other recent
vaults as `vault` entries under `vaults` (`EntryTag` `vault`, glyph `⌂`,
`buildIndex`'s fifth parameter, `target: { vault }` → `openVault`); ⌘K
does nothing on the welcome. Tweaks: `reopen the last vault on start`
as an on/off segment under density. README: the opening paragraph, the
tweaks line, a welcome line in *Keys*, the smoke mode. Tests: 368 (+14
in `welcome.test.ts`: add, de-duplicate, cap, remove, clean, the name,
the `opened` words, `GONE`, the four start decisions, the starter clean
with one q&a card and three headings, the palette's `vaults` entries).
Dev: `ILMI_SMOKE=welcome`, written on the branch and run after the merge
(`f4e419f`): every step as intended in one run, the vault reopening
itself after the reload; see BUILD-LOG 2026-10-18, milestone 23 seeds the recents with `ILMI_VAULT` and
`/nowhere/gone-vault`, turns the toggle off, reads the rows and the
dimmed one, j k, ⏎ on the top row, `close vault` from the palette,
`newVaultIn` set through the store (the picker cannot be faked), a bad
name refused, a `welcome-smoke-<hhmmss>` vault made beside the scratch
one with `start here.md` read line by line, back through the palette's
`vaults` group, the toggle on from the tweaks panel, a sessionStorage
marker and `location.reload()`; the second run logs whether the vault
opened itself; shots `welcome`, `welcome-opened`, `welcome-naming`,
`welcome-new-vault`, `welcome-tweaks`, `welcome-reopened`. Not done:
the window check (owed to the merge session; the capability change
needs the Rust side rebuilt, which `npm run tauri dev` does); the
starter vault made by the smoke is left on disk beside the scratch
vault; a vault that reopens itself but whose `.ilmi` is unreadable
falls to the welcome with its row dimmed, which reads as gone; `new
vault…` from the palette closes the open vault before the name is
typed, so esc there leaves the welcome up (the vault is one row away);
the window title is not restored to `ilmi` if the app is quit while a
vault is open (the OS sets it fresh next start); no key or command
forgets a recent vault, only the hover button.
- Recents: every vault opened is remembered outside any vault (the
  tweaks' localStorage pattern in `src/app/store.ts`: `{ path, name,
  opened }`, newest first, eight at most, de-duplicated by path). On
  start the newest is reopened without a click when the Tweaks toggle
  `reopen the last vault on start` is on (default on; the row sits with
  the theme rows) and its folder is still there; otherwise the welcome
  shows, and a vault whose folder is gone stays in the list dimmed with
  `not where it was` and a `forget` on hover. `ILMI_VAULT` in dev still
  wins over both.
- The welcome (`src/app/Welcome.tsx`, replacing the block in `App.tsx`):
  the wordmark `ilmi` and one quiet line of what it is, taken from the
  README's first sentence; `open vault` (the folder picker, as now) and
  `new vault` (a picker for the parent folder, then a name in a field on
  the welcome itself, no dialog; the folder is created with a starter
  `start here.md`, a frozen source of a few paragraphs on the three
  loops with one q&a card, so the first queue is not empty; the starter
  text lives in `src/app/starter.ts` and parses with no diagnostics);
  the recents as rows (name, the path dimmed, `opened <when>` in the
  words the queue uses), ⏎ opening the top one, `j` `k` moving, `o` and
  `n` for the buttons, a folder dropped on the welcome opened as a
  vault. Styled as the palette: hairlines, the mono labels, nothing new.
- While a vault is open: palette commands `open vault…`, `new vault…`,
  `close vault` (back to the welcome; the clipper's held-link path
  already covers a link arriving there), and the recents listed under a
  `vaults` group in the palette so switching is two keys. The window
  title reads `<vault name> · ilmi`.

Done when: `welcome.test.ts` covers the recents list (add, de-duplicate,
cap, remove, newest first, the `opened` words), the start decision
(toggle on and folder present → reopen; off → welcome; present but gone
→ welcome with the row dimmed), and the starter parsing clean with one
card; `ILMI_SMOKE=welcome` seeds the recents with the scratch vault and
a path that does not exist, starts with the toggle off (the smoke
dispatch runs before any vault opens in this mode; `openInitialVault`
grows that branch), reads the rows and the dimmed one, opens the scratch
vault from the row, closes it from the palette, creates a new vault in a
scratch directory through a hook (the picker cannot be faked) and reads
`start here.md`'s lines, switches back through the palette's `vaults`
group, turns the toggle on, reloads the page (`location.reload()`, a
`sessionStorage` phase marker so the second run of the smoke only
checks) and logs that the vault opened itself; screenshots read.

## Clipping and rendering

Milestone 22 built a door (`ilmi://`) and the user then said what they
meant: "I wanted a way to save web pages using the clipper, don't
necessarily need a whole extension (e.g., could paste the link into ilmi
and it uses the core engine of the clipper to dress it nicely)". The
Obsidian Web Clipper's engine is Defuddle (github.com/kepano/defuddle,
MIT, on npm), which takes a page's DOM and returns the article's content
with the chrome removed plus its title, author, published date, site,
and description, and can emit Markdown. ilmi's intake already fetches a
pasted address and runs its own readability pass; Defuddle replaces that
pass, and the result is written the way the clipper would write it.
A page dressed that way then has emphasis, links, lists, quotes, code,
tables, and images, which the reader today shows as asterisks and mono
raw blocks, so the second milestone is the reader rendering Markdown as
Markdown. Both apply to EPUB chapters (19) and to `ilmi://new?url=` (22)
for free, since they share the paths.

### [x] 24. Clipping — a pasted link lands as the clipper would write it
Done 2026-10-18 on the branch `worktree-agent-a6748a2448940aba8` (worktree
`.claude/worktrees/agent-a6748a2448940aba8`), beside milestone 21 on main;
commit `ca68507`.
Notes: `src/import/page.ts` is the reduction. `clipPage(html, url)` parses
the page with `DOMParser`, runs `new Defuddle(doc.cloneNode(true), { url,
useAsync: false }).parse()` (defuddle 0.19.5, the core bundle, default
export; synchronous; `content` is HTML, and `title`, `author`, `published`,
`site`, `domain`, `description`, `wordCount` come back even when the content
is empty), and reduces the content with `markdownOf(root, base)`, the
walker in the same file: `textOf`'s structure with inline marks (`*em*`,
`**strong**`, `` `code` `` fenced past any run of backticks inside,
`~~del~~`, `"q"`), links as `[text](absolute)` with `(` `)` percent-encoded
and a link into the page itself left as its text, images as `![alt](src)`
(absolute `http(s)` only, each listed once in `images`; `data:` dropped),
fenced code with the language from `language-*` / `lang-*` / `data-lang`,
GFM tables (first row the header, rows padded, `|` escaped), lists from
`start`, quotes of blocks, MathML to `$tex$` / `$$tex$$` from `data-latex`
or an annotation, `\(…\)` / `\[…\]` to the same, footnotes as `[^n]`
numbered by first reference (a `sup` link or a marked anchor into the page
at an id reading `fn` / `footnote` / `note` / `cite_note`, also when
Defuddle has resolved the link against the page) with the list (`#footnotes`,
`.footnotes`, `.references`, or an `ol` whose items carry such ids) taken out
of the flow and written as `## notes` + `[^n]: text` paragraphs at the end,
back-references dropped. `escapeProse` runs on every paragraph: `{{` → `{ {`,
a ` :: ` / ` ::: ` (whitespace on both sides, as `cardForm` reads it) loses
the whitespace, a line that is only `?` / `??` becomes `\?`, a trailing
` ^id` becomes ` \^id`, `<!--` becomes `<!- -`. Defuddle's Markdown was not
used: it needs the full bundle and would still need the escapes, so one
walker serves both passes. The fallback (`via: 'fallback'`) runs when the
reduced content has no words: Readability's article, else the whole body,
through the same walker, so it is the old pass's finder with the new
reduction; `title` is Defuddle's, else the page's. `published` goes through
`normalizeWhen`: `parseWhen` as is, else `Date` → a day when the string had
no clock, else a UTC instant without milliseconds. `words` is `stats()` over
the Markdown, not Defuddle's `wordCount`. Under jsdom 30, Defuddle's removal
selectors exceed the selector engine's 2048-character limit and it falls
back to the whole body, so `src/import/__tests__/long-selectors.ts`
(`allowLongSelectors()`, test-side only) splits an over-long list at its
top-level commas; the webview has no such limit. Format: `url`, `author`,
`published` in `model.ts` (`Field`, `FIELD_KEYS`) and `frontmatter.ts`
(`url` and `author` read and written as `title` is, `published` through
`parseWhen`; `Meta` and `meta()` carry them); FORMAT.md §1 (the children
directory's other files), §3 (three rows and a *Clippings* paragraph), §10;
corpus `vault/fleeting/clipped-page.md` (the vault's document list in
`vault.test.ts` gained it). `ImportSpec` gained `url`, `author`,
`published`, set by `importDoc` when given; `Vault.attachImages(path, srcs,
get)` downloads each address through the injected `get` (`ImageGet`: bytes
and content type, or null), writes `name/img-NN.<ext>` (`imageExt` from the
content type: png jpg gif webp avif svg bmp tiff; anything else, an empty
answer, or a throw leaves the address in place), then one `update` that
rewrites `](src)` to `](name/img-NN.ext)` in every block, and a rewalk; the
walk ignores the files (only `.md` and `.pdf` are read, confirmed in
`walk.ts` and the test: `documents()` unchanged, the node's `children: []`).
App: `fetch.ts` `fetchReadable` returns `page: PageInfo` (the clip without
`title` / `text`) for HTML and `fetchImage` (the http plugin, `arrayBuffer`)
is the `ImageGet`; `src/app/clipping.ts` `importClipNode(dir, spec, images)`
is `importNode` then `attachImages` while the `clipImages` tweak is on
(`download images when clipping`, default on, in `store.ts` `Tweaks` and
`setClipImages`, a row under the reopen row in `Tweaks.tsx`). The intake
keeps the fetched `page` beside the text (cleared when the field empties or
another thing lands), shows `.page-meta` (site · title; author · date) over
the count, adds `N images` and `via defuddle` / `via the fallback` to the
stats, and places through `importClipNode` with the three fields; the title
field takes the page's title as before. The inspector's source block gains
`url` (a `.insp-link` button showing the address without scheme and `www.`,
`openUrl` from `@tauri-apps/plugin-opener`, `window.open` outside Tauri),
`author`, and `published` (the day) after `imported`. `clipper.ts` writes
the same: `url` kept even when the selection is the content, `author` and
`published` from the fetched page, images through `importClipNode`. Rust:
`tauri-plugin-opener` 2 in `Cargo.toml`, `.plugin(tauri_plugin_opener::
init())`, `opener:default` in the capability (its scope allows `http(s)`);
npm `@tauri-apps/plugin-opener` 2.7.2, `defuddle` 0.19.5. README: the
clipping paragraph, the `ilmi://` paragraph, the tweaks line, the layout
line. Tests: 415 (+16: `clip-page.test.ts` over the three pages under
`src/import/__tests__/pages/`, `escapeProse`, `markdownOf`, `normalizeWhen`,
the landing into a scratch vault with a fake getter; `format.test.ts` the
three fields). Dev: `ILMI_SMOKE=clipping` (`ILMI_URL=` for another page),
written on the branch and not run; the Rust side changed, so the window
needs a rebuild first. Open: the smoke and its three shots; a dropped
`.html` file still goes through `readable()` (Readability + `textOf`), not
the clipper's path; Defuddle's own standardization takes the space before a
`::` (`std :: vector` → `std:: vector`), which the escape then leaves since
it is no longer a separator; a `figcaption` lands as a plain paragraph, not
a caption; in the whole-body fallback a form's label text leaks in; no cap
on the count or size of images downloaded, and they are fetched one after
another after the file has landed, so the document shows with its remote
addresses for a moment; `data:` images are dropped without a count; the
callouts Defuddle standardizes land as paragraphs, not quotes.
- `defuddle` as a dependency; the intake's address path (`fetchReadable`
  in `src/app/fetch.ts` → `src/import/readable.ts`) runs Defuddle on the
  fetched document (`new Defuddle(doc, { url, markdown: true })` or the
  equivalent of the version installed; check its API and record it) and
  takes `title`, `author`, `published`, `site`, `description`,
  `wordCount`, and the content as Markdown. The old pass stays only as
  the fallback when Defuddle returns nothing, counted in the preview.
  Where Defuddle does not emit Markdown itself, the content HTML goes
  through the same direct reduction 19 uses, extended with links
  (`[text](href)`, absolute), inline `*emphasis*` / `**strong**` /
  `` `code` ``, fenced code with its language, tables as GFM tables,
  footnotes as `[^n]` with a `## notes` section at the end, and math
  (MathML or `\(…\)` → `$…$` / `$$…$$`). Nothing the format treats as
  a card syntax may be produced by accident: a ` :: ` in page text is
  escaped to `::`-without-spaces or the line is reflowed, and `{{` is
  written `{ {`, with a test for each.
- FORMAT.md §3 gains three optional fields, with a corpus file
  (`vault/fleeting/clipped-page.md`) and a round-trip test: `url` (the
  page's address, quoted as `title` is), `author`, `published` (a day
  or a UTC instant as `imported` allows). The intake writes them; the
  inspector's source block shows `url` as a link that opens in the
  browser (the shell plugin's `open`, or the `opener` plugin; the one
  new permission), `author` and `published` as lines. `ilmi://new?url=`
  writes the same fields.
- Images: `<img>` in the content with an absolute `src` are downloaded
  through the http plugin into the document's own folder (`<stem>/`,
  where its extracts live; `img-01.png` …, the extension from the content
  type) and referenced relatively, `![alt](<stem>/img-01.png)`; a
  download that fails leaves the absolute URL in place. A Tweaks toggle
  `download images when clipping`, default on. The walk already ignores
  files that are not `.md` or `.pdf` in a document's folder; confirm and
  say so.
- The intake's preview for an address shows the site and title line,
  author and published when present, `N words · ~M min`, the image count,
  and `via defuddle` or `via the fallback`; the title field defaults to
  the page's title. The sample address path in the smoke keeps working.

Done when: `clip-page.test.ts` runs Defuddle on three saved HTML pages
under `src/import/__tests__/pages/` (an article with author, date, a
code block, a table, and two images; a page where the fallback is
needed; a page with ` :: ` and `{{` in its prose) and checks the
front-matter fields, the Markdown structure line for line, the escapes,
and that the written file parses with no diagnostics and has no card;
`format.test.ts` covers the three fields' round trip and the corpus
file; `ILMI_SMOKE=clipping` pastes a real address (a stable page such as
`https://en.wikipedia.org/wiki/Spaced_repetition`; offline → log and
stop), reads the preview, places it, opens it, logs the first twenty
lines and the images landed in `<stem>/`, and clicks the inspector's
`url`; screenshots read.

### [x] 25. Rendering — the reader shows Markdown as Markdown
Done 2026-10-18 on the branch `worktree-agent-a2df4fefff0acc940`; commit `c574193`.
Notes: `src/reader/inline.ts` finds inline Markdown as ranges over the raw
text (`inlineRanges`: em, strong, code, link, image, each with its `inner`
span, `href`, and `children`; CommonMark's flanking rules reduced: an opener
is followed by something that is not whitespace, a closer preceded by one,
`_` neither opens nor closes inside a word; nested by recursion, so `*both
**ways***` reads as the EPUB reduction writes it; a code span closes at the
backtick run of the same length; `[text](href)` takes one level of nested
brackets and a destination with no whitespace, parentheses balanced; `\`
skips a character; `markerRanges`, `flatRanges`, `imageOnly`, `literalSpans`).
`src/reader/blocks.ts` names a raw block's shape (`classifyRaw`: fenced or
indented code with the info string's first word as `lang`, a list with its
items' continuation and nested lines dedented by the content offset, a quote
with its `>` off, a GFM table with its alignment row, a thematic rule, else
`other`; `splitBlocks` splits a quote's or an item's text as the parser
splits a body, a paragraph ending where a list, quote, fence, or heading
begins). `src/reader/plugins.ts`: the `marks` plugin decorates the ranges
(`md-em`, `md-strong`, `md-code`, `md-link[data-href]`, `md-alt`) and the
markers (`md-mark`, plus `hidden` when `frozen()` says so; recomputed on a
`frozenKey` meta, which the Reader dispatches when the field flips), and
skips editorial marks inside code, links, and images; an `images` plugin
holds `Map<src, ImageState>` (`{ url }`, `broken`, `hidden`, `pending`),
fed by `StateOptions.images` (an `ImageLoader`) from its view part, which
asks once per source and dispatches only when a load lands, never inside
the view's construction; `imagesKey` meta sets one source or `'reset'`. An
image is a widget before its source (`img.md-img` with the alt, its
`onerror` marking the source broken; else `span.md-img-slot[data-state]`),
an image-only paragraph a `dd-img` node decoration (`kept` when the toggle
held it back, `broken` when it could not be had, the alt then in mono).
App: `src/app/images.ts` (`imagePath` resolves against the document's
folder, `/` from the root, percent escapes decoded, `..` out of the vault
refused; `imageLoader` reads the vault file through `fs.readBytes` as a
blob URL, every URL revoked when the reader unmounts; a remote address
passes while `remoteImages` is on, else `hidden`). `Reader.tsx`: `richHTML`
draws the same inline rules, its markers `md-mark hidden` since nothing is
typed there; `rawHTML` / `RawView` draw a raw block as `div.raw.rendered
[data-kind]` holding `.raw-view` and `.raw-src`, the source shown by CSS
while the node is selected, an HTML block or a comment staying `pre.raw` as
before; `handleClick` opens a `.md-link` on ⌘-click through `openLink`
(`window.open`), a plain click puts the caret; `CardText` and the queue's
`Body` go through `cardHTML` / `richHTML` / `clozeHTML`, so the deck's rows
and the queue read the same way as the faces. Tweaks: `show remote images`
(store `remoteImages`, default on, saved in `ilmi.tweaks`); a flip resets
the image map and the loader looks again. CSS in `reader.css`: `.md-mark {
color: var(--fg-5) }`, `.md-mark.hidden { font-size: 0 }`, the drawn blocks'
rules under `.raw-view`. Corpus: `vault/fleeting/markdown-sampler.md`
(frozen, imported, no card, no `read:`, every inline and block form) with
`markdown-sampler/mark.png` (32×20, written once by a script); the walk
lists the folder as the document's children, empty, as 24's image folders
will be. Smoke: `ILMI_SMOKE=render` written, not run (the window and port
1420 belonged to the other session). Tests: 420 (+18 in
`reader-view.test.ts`, +1 `store.test.ts`, +1 roundtrip per corpus file ×2),
22 files; typecheck clean.
Open: the window check (the `render` smoke and its screenshots, the
markers' width at 0, a blob URL in WKWebView, a list click selecting the
atom); ⌘-click goes through `window.open`, and whether the webview hands
that to the browser is for the window check (24 plans the `opener` plugin
for the inspector's `url`; `openLink` is the one place to switch); emphasis
that spans a math chip is not found, since ranges are per text node; an
image in the line draws at its natural size; a task list's `[ ]` draws as
text; `[text]` with no `(href)` still reads as a note, as before; a drawn
block's source shows only while selected and is still not editable in
place; a reading row's snippet in the queue (`snippetOf`) and the
`[figure: alt]` marks of 19 are untouched; `richHTML` keeps the hidden
markers in the DOM, so text copied from a face carries them; a code
block's `language-*` class is set and nothing colours it yet; three mixed
delimiters (`***a**b*`) follow the simple rule, not CommonMark's.
The reader is a ProseMirror editor over the document's blocks, with math
as atoms and editorial marks lit by decorations; raw blocks (lists,
quotes, code, tables, headings of other levels) sit in the flow as mono
atoms. The format does not change; what changes is what is drawn.
- Inline, in paragraphs and card faces: `*emphasis*`, `**strong**`,
  `` `code` ``, `[text](href)`, `![alt](src)` drawn as themselves by
  decorations over the raw text, the markers dimmed (`var(--fg-5)`) so
  the text stays editable and the caret lands where the source says;
  on a frozen document the markers are hidden (width 0, still in the
  DOM) since nothing is typed there. A link opens in the browser on
  ⌘-click, plain click puts the caret. The same inline rules in
  `richHTML` for the deck lens, the queue rows, and the session faces.
- Blocks: a raw block that is a list, a block quote, a fenced or indented
  code block, a table, or a heading is rendered as that element inside
  its atom, with the source shown on focus (click into it) as now; an
  image paragraph (`![alt](src)` alone) renders the image, from the vault
  (relative path, read through the fs adapter as a blob URL, released on
  unmount) or the web (absolute URL, only when a Tweaks toggle `show
  remote images` is on, default on), with its alt as a caption, a broken
  image as its alt in mono.
- Extracts and cards from rendered text keep working: the selection maps
  to the raw text as it does over math chips today, and an extract or a
  card made from a passage with emphasis carries the markers in its
  text. Clipped pages (24) and EPUB chapters (19) are the test material.

Done when: `reader-view.test.ts` renders each inline form and each block
form from a fixture document and checks the DOM (markers dimmed, hidden
when frozen; the list a `ul`, the code a `pre` with the language class,
the table a `table`, the image an `img` with the alt), and that
selection-to-source mapping over an emphasised passage yields the raw
text with its markers; `ILMI_SMOKE=render` opens the clipped corpus page
and an EPUB chapter from the fixture, screenshots each, selects an
emphasised passage, presses `e`, and logs the extract's text; the
session faces of a card with inline code read right; screenshots read;
the `*emphasis*` open item under 19 closed.

## Live editing

The reader draws Markdown and math as themselves (25) but still falls back
to source when the caret arrives: inline markers are always visible while a
document is editable, a math chip becomes its TeX when clicked, and a drawn
list, quote, code block, or table shows its source while selected. The
user: "is it possible to make markdown / latex stuff more wysiwyg like
instead of de-rendering when you click?" — yes, in two steps, the format
unchanged throughout: the file on disk stays the raw Markdown, reading and
writing it stays a fixed point, and the selection keeps mapping back to the
raw text exactly (the tests from 25 guard that), since extracts and cards
are made from it.

### [x] 26. Live inline — markers only around the caret, math edited in place
Done 2026-10-18 on main; commit `9c21047`.
Notes: `src/reader/plugins.ts`: the `marks` plugin's state is `{ set,
edge }`. A range's markers (`md-mark`, spec `{ marker: true }`) show while
the selection overlaps it (`sel.from < to && sel.to > from`) or while a
collapsed caret sits at the edge the plugin keeps (`Kept`: the range
ending at the caret after a doc change, `closedAt`, so `*word*` lights as
its `*` is typed; or the one a `revealKey` meta names, with the caret
position that earned it), and are `md-mark hidden` otherwise, frozen or
thawed alike. A selection-only transaction redraws only the markers of
the textblocks the old and the new selection touch (`touched`,
`redrawMarkers`: `set.find(pos, end, spec.marker)` removed, the block's
markers added again); a doc change or a `frozenKey` / `imagesKey` meta
redraws everything as 25 did. `revealBackward` / `revealForward`
(Backspace / Delete in `keys`, ahead of `baseKeymap`): a collapsed caret
right after (before) a range whose markers are hidden sets the edge
instead of deleting; once shown, the command declines and the browser
deletes. A `mathEdit` plugin holds the position of the chip being edited
(`mathEditKey` meta opens or closes it; mapped through doc changes, null
when the chip is gone) and marks it with a node decoration whose spec is
`{ mathEdit: true }`; `openMath` (⏎ in `keys`) opens the node-selected
chip; `editMath` is gone, a click no longer turns a chip into text.
`Reader.tsx`: `MathView(node, view, getPos, decorations)` opens its
editor when `isMathEdit(decorations)`: `span.math-edit` appended inside
the chip (`contenteditable=false`, absolute under it, `stopEvent` keeps
ProseMirror out of it) holding `textarea.field` (the TeX between the
dollars, mono, grown to `scrollHeight` on input) and `span.err`; each
input previews through KaTeX with `throwOnError: true`, the chip's
children replaced on success (`data-tex` stays the node's until written),
the message under the field on failure (`KaTeX parse error: ` and the
echoed source stripped); ⏎ commits, Escape restores the chip (meta null,
no doc change), ←/↑ at the start and →/↓ at the end commit and put a
`TextSelection` before or after the chip, a `mousedown` outside (document,
capture) commits without moving the caret; ⇧⏎ is the field's own in `$$`
and refused in `$…$`, which cannot hold a break. `close` dispatches one
transaction: `setNodeMarkup` when `mathSpanEnd` reads the new span,
`delete` when the field is blank, `replaceWith(schema.text(raw))` when
the format would not read it as math (a leading space, say); `$$` stays
`$$`. `handleClickOn` and `handleClick` are exported functions now (the
test mounts with them); a click on a chip dispatches the node selection
with the `mathEditKey` meta. CSS in `reader.css`: `.math { position:
relative }`, `.math.editing` on the accent, `.math-edit` set as the
palette (paper, hairline, radius, mono 13px), centred under a display
chip. README: the rendering paragraph. Smoke: `ILMI_SMOKE=live` written
(`rangeIn` / `caret` helpers beside `select`), run after the hand-back, see BUILD-LOG: port 1420 and the
window belonged to a run that was not this session's (a two-hour-old
`target/debug/ilmi` with its vite), left alone as the ground rules say.
Tests: 471 (+11 in `reader-view.test.ts`, +1 in `reader.test.ts`, the two
frozen-marker cases rewritten for the new rule), 25 files; typecheck
clean; cargo 12.
Open: the window check (the `live` smoke and its screenshots; a real
click's focus landing in the field; the editor's width and its place
under an inline chip near the right edge, `place()` shifting it by
margin; `execCommand('insertText')` reaching ProseMirror as typing).
The kickoff's "maxwell's inline formula" is a card's (`^cmx-area`), not
prose, so the smoke edits the binomial display chip, the only chip in
maxwell's prose. Escape writes nothing (the plan's bullet had it writing,
its "done when" did not; the "done when" was follrun after the hand-back, see BUILD-LOG). An empty field
removes the chip; a frozen document opens no editor (a click there only
selects the chip). A caret put at a range's edge by a move keeps the
markers hidden (Typora's rule), so a click right after `*em*` and then
Backspace reveals first. Undo after ⏎ restores the chip's text in one
step but does not reopen the editor; a rebuild of the view (the file
changed under us) drops an open editor's unwritten TeX. A range that
straddles a math chip is still not found (per text node, as in 25).
Milestone 27's list, quote, and code nodes get the marker rule for free
while their items are textblocks of text nodes (`touched` walks
`isTextblock`, `rangesAround` the caret's parent, `redrawMarkers` a
block's text children); a code block should skip the rule, which means
a check on the node type in `markDecorations` and `redrawMarkers`.
- Markers follow the caret, as Typora and Obsidian's live preview do: the
  `*`, `**`, `` ` ``, `[`, `](href)`, `![`, `](src)` markers of an inline
  range are shown (dimmed, as now) only while the selection touches that
  range or sits just outside it, and hidden everywhere else, on editable
  and frozen documents alike. The decoration set recomputes on selection
  change for the paragraph that gained the caret and the one that lost
  it, not the whole document. Typing a marker makes the range appear
  as you close it; backspacing into a hidden marker reveals it first
  (the caret lands after the marker, the markers show, the next backspace
  deletes a character), so nothing is deleted blind. ⌘-click on a link
  still opens it; a plain click puts the caret and shows that link's
  markers.
- Math stays rendered: clicking a chip (or ⏎ with the chip selected)
  opens a small editor anchored under it, styled as the palette, holding
  the TeX between the dollars, monospace, growing with its content; the
  chip re-renders as you type (KaTeX with `throwOnError: false`, an error
  shown quietly under the field, the chip left as it was until the TeX
  parses); ⏎ or Escape or a click outside closes it and writes the text
  once (one transaction, one disk write through the reader's existing
  debounce); ⇧⏎ inserts a line break for display math. `$$` versus `$`
  is kept as the span had it. Arrow keys at the field's ends leave the
  editor and put the caret before or after the chip. A new formula is
  typed as today (`$x$` in the text becomes a chip when closed); the
  editor is for what is already a chip. The cloze blanks inside math
  (18) are plain TeX in the field.
- The session faces, deck lens, and queue rows keep hiding every marker
  (nothing is edited there).

Done when: `reader-view.test.ts` covers markers shown only for the range
under the caret and hidden elsewhere, the caret moving between two
emphasised spans, a backspace into a hidden marker revealing it without
deleting, typing `*word*` lighting as it closes, the math editor opening
on click with the span's TeX, re-rendering on input, writing once on ⏎
and nothing on Escape, keeping `$$`, and the selection-to-source mapping
unchanged over a paragraph with hidden markers; `ILMI_SMOKE=live` opens
the markdown sampler thawed, moves the caret through the first paragraph
logging which markers show, backspaces into a marker, opens maxwell's
inline formula's editor, types into it, closes with ⏎, and logs the file's
line; screenshots read.

### [x] 27. Live blocks — lists, quotes, and code edited as themselves
Done 2026-10-18 on main; commit `05d9ead`.
Notes: `src/reader/schema.ts` gains `code_block` (`content: 'text*'`,
`code: true`, attrs `fence` and `close`, the fence lines verbatim, `close`
null when the fence never closed; `pre.dd-code[data-lang] > code.
language-*`), `list` (`list_item+`, `div.dd-list`) with `list_item`
(`inline*`, attrs `indent`, `marker` as written with the whitespace after
it, `task` the box's character or null; the list is flat, nesting read
from `indent`), and `quote` (`quote_line+`, `blockquote.dd-quote`) with
`quote_line` (`inline*`, attr `prefix`, `''` on a lazy line).
`src/reader/raw.ts`: `rawToNode(text)` reads a fence, a quote, or a list
(every item line an item of its own, nested or not; a continuation line
at the item's content column, in spaces) and hands the node back only
when `nodeToRaw(node) === text`, so a block the pair cannot round trip
stays a raw atom (a table, a rule, HTML, a comment, indented code, a
fence with nothing between its lines, a lazy or tab-indented
continuation); `itemLines`, `markerNumber`, `numbered`, `nextMarker`.
`convert.ts` goes through the pair both ways. `plugins.ts`:
`continueBlock` (⏎ splits an item or a line, the new one with
`nextMarker` and an unticked box, or the same `> `; a lazy line takes the
nearest prefix before it; `renumber` moves the ordered items after it on
where they had fallen behind), `leaveBlock` (⏎ on an empty item or line:
a paragraph after the block when last, before it when first, between the
halves otherwise, the text going with it), `joinBlock` (Backspace at the
start: the box first, then a join into the item before, the first item
leaving as a paragraph), `indentBlock` / `outdentBlock` (Tab / ⇧Tab by
the item's own marker width, every item the selection touches; Tab in
code is two spaces), `toggleTask`, `taskRule` (`[ ] ` or `[x] ` typed at
an item's start becomes its box), `Mod-Enter: exitCode`; `isCode` skips a
code block in `markDecorations`, `redrawMarkers`, `rangesAround`,
`imagesIn`, and `reformMath`. `cards.ts`: `passage` walks `nodesBetween`,
so an item's or a line's text is taken without its marker and `blocks`
are the document's child indices. `Reader.tsx`: `ListItemView`
(`div.dd-li[data-marker]` with `--indent`, `span.li-mark` showing `•` or
the number as written, `span.li-task[data-checked]` ticked on mousedown
through `toggleTask` while the view is editable, `div.li-text` as the
contentDOM); `RawView` keeps the rest. CSS in `reader.css`: `.dd-code`
with the language in its corner, `.dd-li` a flex row set in by `--indent
× 0.6em`, `.li-task` a box filled on the accent with a check, `.dd-quote`
the left rule. README: the rendering paragraph. Smoke: `ILMI_SMOKE=blocks`
written and run (see BUILD-LOG), `render`'s list click moved to the
table. Tests: 493 (+16 in `src/reader/__tests__/raw.test.ts`, new, the
corpus, the book, and the pages through the pair; +6 in
`reader-view.test.ts`; four of 25's cases changed on purpose, since a
list, a quote, and a code block are no longer atoms: the `ul li` and
`blockquote p` queries read `.dd-li .li-text` and `.dd-ql`, the atoms
list is `['table']`, the source-on-select case uses the table;
`reader.test.ts`'s pass-through case takes a table and checks the three
live nodes), 26 files; typecheck clean; cargo 12.
Open: the window's look is unseen (the smoke ran to `done` with every
write right, but the screen was locked for the first capture and another
window covered ilmi for the rest): the bullets' column against the text,
the ordered numbers, the task box and its tick, the quote's rule, the
code label, the indent step; tables and HTML blocks stay as in 25 (drawn,
source on focus); a block nested inside an item or a quote (a fence, a
heading, `> - item`) is text on that line; a quote's wrapped paragraph
reads as lines, not one paragraph; a fence with nothing between its lines
stays raw, and a code block is never made in place (type the fence and
the file re-reads it); ordered items are renumbered only on ⏎, and `1. 1.
1.` becomes `1. 2. 3.` then; Tab indents by the item's own marker width,
not the item before's content column; a Shift-⏎ line in an item is a
continuation line in the file, a blank one splits the block on re-read;
no colouring in code; Backspace at the start of a code block joins it
into the paragraph before, as a heading does.
- Fenced code: a real `code_block` node in the editor, the fence and its
  language kept as node attributes, the body edited in place (monospace,
  tab inserts two spaces, ⌘⏎ leaves the block); serialized back to the
  exact fence it came from. Indented code stays raw.
- Lists: a `list` node whose items are paragraphs, each item remembering
  its own marker text (`- `, `* `, `+ `, `1. `, `1) `) and indentation,
  so writing back reproduces the file byte for byte; ⏎ at the end of an
  item makes the next with the same marker (numbers continue), ⏎ on an
  empty item leaves the list, Tab and ⇧Tab indent and outdent by the
  item's own indentation unit, backspace at an item's start joins it
  into the one before. Task-list `[ ]` / `[x]` draws as a box that
  toggles on click and writes the character. Inline Markdown inside an
  item follows 26.
- Block quotes: a `quote` node whose lines are paragraphs, the `> `
  prefix kept per line; ⏎ continues the quote, ⏎ on an empty line leaves
  it.
- Tables and HTML blocks stay as they are in 25 (drawn, source on focus);
  say so in the notes as the open item.
- The parser is not changed: the format still stores these as `raw`
  blocks. The editor's schema gains the nodes and a lossless pair of
  functions, `rawToNode(text)` and `nodeToRaw(node)`, with the fixed
  point `nodeToRaw(rawToNode(t)) === t` for every raw block in the corpus
  and in the EPUB and clipped fixtures; a raw block the pair cannot round
  trip stays a raw atom. Extracts and cards from a selection inside a
  list item or quote line take the item's or line's text without its
  marker.

Done when: a corpus-wide round-trip test over every raw block through the
pair; `reader-view.test.ts` covers typing in a code block, ⏎ / Tab / ⇧Tab
/ backspace in a list, the task box, a quote continued and left, and an
extract from a list item without its marker; `ILMI_SMOKE=blocks` edits
the sampler's list, quote, and code block in place and logs the file's
lines after each; screenshots read.

## From use

The user ran the app on their own collection and came back with three
things, all about the chrome rather than the loops. The queue row names
its document by its title, and generated titles read as what they are:
"in the queue, right after the item type, can you just put the path of the
item instead of the title or something? Looks too claudism otherwise."
The tree's context menu "is hard to use (e.g., I can't just right-click
somewhere on the tree to add something or whatever, has to be on an item,
etc.); just hovering over move to is kinda awkward too, it should only
pull up on next context menu if clicked and not hover." And there is no
way, once a vault is open, to open another or make one: "need something
(I imagine File → Open) for collection management, like if I wanted to
open a collection or make a new one." The format does not change.

### [x] 28. From use — the path in the queue, a context menu that works anywhere, a File menu
Done 2026-10-19 on main; commit `74243da`.
Notes: `src/app/items.ts`: `pathLabel(path)` (the `.md` dropped, the folders
kept) and `sourceLabel(item, docs, by = 'title')`, `by: 'path'` for the
queue; the session's line and the inspector keep the title. `Queue.tsx`
reads the `queueTitles` tweak (`store.ts`, default off, persisted with the
others; `Tweaks.tsx` row `queue shows titles`) and sets `data-by` on the
`.src` span; `queue.css` turns the uppercase off for the path so it reads
as written, the kind tag and `new` keeping their caps. The sidebar menu:
`Tree.tsx` no longer handles its own box's `onContextMenu`; a native
`contextmenu` listener on the nearest `.side` (or the box itself when
there is none, as in a test) opens the root's menu for any target that is
not a `.trow` or inside `.ctx-menu`, so the headings, the saved queries,
and the empty space all work; a row's menu is still React's on the row.
Chosen over the tree filling the sidebar's height because the saved
queries sit under the tree and would have been pushed to the bottom.
Escape and an outside mousedown already closed the menu; `placeMenu(el)`
(exported beside `MENU_W`) shifts a menu up when its bottom passes the
window's, run from a `useLayoutEffect` on the menu state in `Tree.tsx` and
`Lenses.tsx`. `move to…` opens on a click (`onMouseEnter` gone in both,
`onMouseLeave` on `.sub-wrap` gone too, so the list stays until `◂ move
to…`, a choice, Escape, or an outside press). The File menu: `src-tauri/
src/lib.rs` builds File (`New Collection…` ⌘⇧N, `Open Collection…` ⌘O,
`Open Recent` submenu, a separator, `Close Collection` ⌘⇧W; on Windows and
Linux a separator and Quit follow, and the whole bar, File, Edit, Window,
is now set there too, where there was no menu before) between the app
menu and Edit; `Builder::on_menu_event` emits every item's id as the
`menu` event; the command `set_recent_vaults(items)` empties the Open
Recent submenu (ids `file` and `recent`) and appends one item per recent
(`recent:<path>`, the name as text), disabling it when there are none.
`src/app/menu.ts` (new): `menuAction(id)` (pure), `runMenu(id, fx)` with
the pickers and the vault injectable (Open → `pickVault`; New →
`pickVaultParent` then `closeVault` when a folder was picked, the welcome
then taking the name; Close → `closeVault`; Recent → `openVault`),
`recentRows`, `syncRecentMenu`, and `listenForMenu()` (once, from `App`
beside `listenForClips`; `listen<string>('menu')` guarded for outside
Tauri; the recents re-sent on every change through a store subscription).
`Palette.tsx`'s three commands are `open collection…`, `new collection…`,
`close collection` by the menu's ids and go through `runMenu`. `App.tsx`:
⌘W ignores shift so ⌘⇧W is the menu's. README: the menu, the keys, the
tweak, the queue row. Smoke: `ILMI_SMOKE=use` written (`smokeUse`; the
deck smoke clicks `move to…` now; the welcome smoke runs `close
collection`). Tests: 506 (+13: `items.test.ts` the path label with and
without the title and a card's section; `tree.test.ts`, new, the root
menu from the sidebar's space and heading, a row's own, `move to…` on a
click and not on `mouseover`/`mouseenter`, the list surviving
`mouseleave`, `◂ move to…`, Escape, an outside press, the right and
bottom edges; `menu.test.ts`, new, the ids and the dispatch with stubs),
28 files; typecheck clean; cargo 12, no warnings.
Open: the window check (`ILMI_SMOKE=use`) is owed, port 1420 was held by
the user's own run for the whole session: the path line's look at 10px
mono beside the uppercase tag, the native menu's items and their
shortcuts on the real menu bar, Open Recent filling in after launch and
after a vault opens, and ⌘⇧W reaching the menu rather than the webview
are all unseen; the welcome and its foot still say `open vault` / `new
vault` while the menu and the palette say collection (the README and
every other string say vault: one word is owed, the user's); the Open
Recent submenu lists every recent including the open vault; Windows and
Linux now show a menu bar where there was none, uncompiled here; a
right-click on a saved query row opens the root's menu.
- The queue row's source line shows the item's vault-relative path after
  the kind tag, not its title: `sources/attention.md` becomes
  `sources/attention`, the `.md` dropped, the folders kept with `/`, in
  mono at the size the line has now; a card's section still follows
  after the dash as it does today. `sourceLabel` in `src/app/items.ts`
  is the one place; the deck lens, the session's source line, and the
  inspector keep the title (the title is the document's name there; the
  queue is a list of files). A Tweaks toggle `queue shows titles`
  (default off) brings the old line back.
- The tree's context menu opens on a right-click anywhere in the sidebar:
  the empty space under the rows and the headings hit `.side`, not
  `.tree` (`src/app/Tree.tsx` handles only its own box, and the box ends
  at the last row), so the handler moves up to the sidebar (or the tree
  fills the sidebar's height; either, with the reason in the notes) and
  opens the root menu there, with the new-item entries landing at the
  root and `add a source` into the root. Right-click on a row keeps its
  menu. Escape closes the menu; a click anywhere outside closes it (check
  that it does today; make it so if not); the menu stays inside the
  window at the bottom edge as it does at the right.
- `move to…` opens its list on a click, not on hover, in the tree and in
  the deck lens (`src/app/Lenses.tsx` has the same pattern); the list
  closes with the menu, and its `◂ move to…` row steps back. Nothing
  opens on `mouseenter` any more.
- A File menu in the native menu bar (`src-tauri/src/lib.rs` builds the
  macOS menu; the File submenu goes between `ilmi` and `Edit`, and on
  Windows and Linux the same submenu is added to the default menu):
  `New Collection…` (⌘⇧N), `Open Collection…` (⌘O), `Open Recent` as a
  submenu of the recents by name (rebuilt when the recents change, or,
  if the menu cannot be rebuilt cheaply, a single `Open Recent…` that
  opens the palette on the vaults), a separator, `Close Collection`
  (⌘⇧W; ⌘W stays the tab). The Rust side forwards every item's id to the
  webview as one event; `src/app/chrome.ts` (or a new `src/app/menu.ts`)
  listens once and dispatches: Open → the folder picker then `openVault`;
  New → the parent picker then the welcome's name field (`newVaultIn`),
  the open vault closed first with its tabs; Close → `closeVault` to the
  welcome; Recent → `openVault(path)`. The same four as palette commands
  (`open collection`, `new collection`, `close collection`, and the
  recents the palette already indexes), so there is a path without the
  native menu and one the smoke can drive.

Done when: `items.test.ts` (or the queue test) covers the path label with
and without the toggle and a card's section after it; `tree.test.ts`
covers the menu opening from the sidebar's empty space, `move to…` not
opening on hover and opening on click, and Escape closing it; a
`menu.test.ts` covers the dispatch from an event id to the handler with
the pickers stubbed; `ILMI_SMOKE=use` opens the queue, logs the first
three rows' source lines, right-clicks the sidebar's empty space and
logs the menu's entries, clicks `move to…` and logs the list, runs the
palette's `close collection` and logs the welcome, then reopens the vault
from the recents and logs the tree; screenshots read.

### [x] 29. One menu everywhere, and a file lands where you drop it
Done 2026-10-20 on main; commit `461918b`.
Notes: `src/app/NodeMenu.tsx` (new) is the one node menu: `MENU_W`,
`placeMenu` (moved here, re-exported from `Tree.tsx`), `MenuAt`,
`menuAt(e, id, plus)`, and `NodeMenu` (new source / folder / deck /
draft, `import a file…`, `add a source`, then for a node rename, `move
to…` on a click, delete; Escape and an outside press close it; the `+`
variant orders the documents first and says `add from text or a link`).
`Tree.tsx` and the folder lens (`FolderLens` in `Lenses.tsx`) both render
it; the lens opens a row's menu from the row and the folder's own (the
menu its row has in the tree, rename and delete included; the root's for
`''`) from anywhere else in the lens, renames inline in the row
(`.fv-rename`), and starts the rename of what it makes. `+ source` opens
the intake for that folder; the menu's `new source` still makes an empty
one. The `+` sits on the sidebar's root row, beside the vault's name
(the header's `workspace` is a heading, the root row is the name), and
opens the menu for the selected folder row, else the root. `src/app/
land.ts` (new) is the landing: pure `fileKind`, `decide(kind, {decks,
cards}) → 'land' | 'ask'` (an `.apkg` with one deck and text under two
cards land; HTML is prose), `dropTarget(hit, tab)`, `hitAt(el)` (the
nearest `[data-path]`, a folder by `data-kind`), `newFolders(written,
dir, before)`; `landFile(path, dir, fx)` / `clipLink(url, dir, fx)` over
an injectable `LandFx` (readers and the vault's writers); `landFiles`
(one after another, each opened, a notice each, the asks queued in the
store's `intakeFiles` and the intake opened for the folder); `undoLanded`
(the new folders whole, then the files outside them through `removeNode`,
which takes a document's pages and children too); `notify` / `undoNotice`
/ `dismissNotice` with the undo held per notice in the module; `activeDir`;
`importFiles(dir, pick)`; the router `routeDrop` / `listenForDrops` (the
one `onDragDropEvent` subscriber, from `App`: no vault → `dropRoutes.
welcome`; over the intake's panel → `dropRoutes.intake`, which hears
every event with `here` so its veil follows; else the row under the
pointer is lit through the store's `fileOver` and a drop with paths
lands) and `dropAt(paths, x, y)` for the smoke; `onPaste` /
`listenForPaste` (a document `paste` listener; ignored in an input,
textarea, select, contenteditable, `.ProseMirror`, with the palette open,
or with no vault). `Notice.tsx` (new) draws the store's `notice` inside
`.shell` over the bottom strip's right end (`undo`, `open`, `×`; gone
after 12 s); every line is also logged to the queue's `log`. `Intake.tsx`
registers its route instead of subscribing, queues a multi-file drop's
rest, and reads `intakeFiles` in one at a time once it is empty;
`Welcome.tsx` registers its route. Rows carry `data-path` (tree and folder
lens). File → `Import…` ⌘⇧O (`src-tauri/src/lib.rs`, id `import`, between
Open Recent and Close Collection, separators either side); `menu.ts`
`MENU_ID.import`, `{ kind: 'import' }`, `MenuFx.importFiles`; the palette's
`import…`. README: the drop, Import…, ⌘V, the `+`, the shared menu. Smoke:
`ILMI_SMOKE=land` written (`smokeLand`). Tests: 539 (+33: `drop.test.ts`,
new, the target for a folder row, the root row, a document row, and
elsewhere with a document, folder, queue, intake, or no tab; `hitAt`;
the decision per kind and each kind's landing with the writers stubbed
(pdf, epub in a folder named for the book, md and txt of prose, txt and
md that read as cards asking, apkg with one deck landing and two asking,
the refusals); `newFolders`; the epub's undo removing its folder whole
and a pdf's its document; several files with an ask queued for the
intake and the notice's undo; the router to the welcome, to the intake,
and the lit row cleared on leave; the paste ignored in an editor and with
no vault, taken with nothing focused into the active tab's folder, and
offline a notice with nothing written. `node-menu.test.ts`, new: a row's
menu the same in the tree and the folder lens, the lens's empty space
opening the folder's own and a new deck landing in the folder renamed in
its row, the root lens's menu, rename inline from the row's menu, a
subfolder row sending import / intake / new into it, `+ source` opening
the intake, the rows' `data-path` and the lit row, the sidebar's `+` for
the root, a selected folder, and back to the root for a selected
document. `menu.test.ts` the `import` id and dispatch; `tree.test.ts`
the new entry), 30 files; typecheck clean; cargo 12, no warnings.
Open: the window check (`ILMI_SMOKE=land`) is owed, port 1420 was the
user's for the whole session: the real OS drop's position (physical
pixels over `devicePixelRatio`, as the intake did) and the lit row while
dragging from the Finder; whether a tree row's own HTML drag still works
beside the router (it ignores a drop with no paths); whether WebKit fires
`paste` on the body with nothing focused under ⌘V (if not, the Edit
menu's Paste or a ⌘V keydown with a clipboard read is the fallback); the
notice's place over the bottom strip; `Import…` and ⌘⇧O on the real menu
bar. Several files dropped open one after another and the notice's undo
takes back only the last; a second asking file waits until the intake is
empty, unannounced. A document row's folder can be a document's children
directory (`a/` beside `a.md`), where the file lands as its child. The
intake's own `pick a file →` still reads one file into the intake rather
than landing it.
The user, after 28: "context menu in a folder should be the same as in the
tree", and "adding epub or pdf / source can be a lil smoother UI/UX wise.
rn it works but isn't that intuitive compared to how I might expect
RemNote / Obsidian to feel." Today the folder lens has no context menu
(only `+ source` / `+ deck` / `+ draft` / `+ folder` buttons), and adding a
file takes three steps: open the intake tab (right-click → `add a source`
or the palette), drop or pick there, then press place. In Obsidian a file
dragged from Finder onto the file tree lands in the folder under the
pointer, and that is the feel wanted.

- One context menu. The tree's menu (`src/app/Tree.tsx`: new source /
  folder / deck / draft, add a source, rename, move to…, delete, `move
  to…` opened on a click, placed inside the window) moves into a shared
  component (`src/app/NodeMenu.tsx` or the like) used by the tree and the
  folder lens. In the folder lens a right-click on a row opens that row's
  menu, a right-click on the empty space opens the folder's own menu (new
  items land in the folder shown), and rename there is inline in the row
  as in the tree. The lens's `+` buttons stay; `+ source` opens the add
  flow below for that folder instead of making an empty source (an empty
  source stays on the menu as `new source`).
- Drop a file anywhere and it lands. The window takes an OS file drop
  everywhere, not only on the intake tab: onto a tree row or a folder-lens
  row it lands in that folder (a document row: its folder), the row lit as
  a drop target while dragging, as the tree's own drags are; onto the
  reader, the queue, or anywhere else it lands in the folder of the active
  tab (the root when none). Several files at once land one after another.
  What needs no choice lands straight away with the defaults the intake
  already uses, then opens: a `.pdf`, an `.epub` (its chapters in a folder
  named for the book), a `.md` / `.txt`, an `.apkg` with one deck. A
  notice says what landed and where (`placed · Ibn Khaldun, Muqaddimah ·
  12 chapters in books/`) with `undo` (removes what was written) and
  `open`. Only what needs a choice goes to the intake, pre-filled: text
  that reads as cards (the delimiter row), an `.apkg` with several decks.
  The intake's own drop keeps working.
- Import from the menu. The File menu (28) gains `Import…` (⌘⇧O): the
  native picker over the extensions the intake takes, several files
  allowed, landing in the active tab's folder exactly as a drop does; the
  same as a palette command `import…`, and as `import a file…` on the
  context menu (into that folder). `add a source` on the menu stays for
  pasting text or an address.
- Paste a link anywhere. ⌘V with an `http(s)` address on the clipboard and
  no text field or editor focused clips it (24's path) into the active
  tab's folder and opens it, with the same notice; with the focus in an
  editor nothing changes.
- A `+` in the sidebar's header, beside the vault name, opens a small menu:
  new source / deck / draft / folder, import a file…, add from text or a
  link (the intake). Everything lands in the root unless a folder row is
  selected, then in it.

Done when: `node-menu.test.ts` covers the shared menu in the tree and the
folder lens (row menu, empty-space menu, the folder lens's new item
landing in its folder, inline rename there); `drop.test.ts` covers the
target folder for a drop on a tree row, a folder row, a document row, and
elsewhere with and without an active tab, and the land-or-ask decision
per kind (pdf, epub, md, txt, apkg with one and with two decks, text that
reads as cards) with the writers stubbed; the undo of a landed epub
removes its folder; `ILMI_SMOKE=land` drops a PDF and the fixture EPUB
through the dev hook onto a folder row and onto the reader, runs
`import…` with the picker stubbed, pastes an address with nothing
focused (offline → log and skip), right-clicks a folder-lens row and its
empty space and logs both menus, and logs the tree after each; screenshots
read.

## Structure

The user, 2026-10-28: "Everything should also be nestable (like I can
throw anything under anything in the tree). Additionally, it'd be nice if
there was something similar to document tabs that Google Docs has but in
the things here (e.g., if I was taking notes for a semester-long course I
can have different tabs for different units or whatever)." The format
already gives every document a children directory (`name.md` beside
`name/`, FORMAT §1) and the walk already reads it, but only extracts land
there, the tree only drops *into* folders, and the order of a directory is
alphabetical. 30 opens the children directory to everything and gives a
directory an order of its own; 31 draws a document's children as tabs, as
Google Docs draws a document's tabs and subtabs in a rail beside the page.
Tabs are children files, not sections of one file, so a tab is a whole
document: its own cards, schedule, priority, extracts, and its own tabs.

### [x] 30. Nesting — anything under anything, in an order you choose
Done 2026-10-28 on main; commit `9ff9791`.
Notes: `src/vault/order.ts` (new, pure) is the order: `Order` (`{ "<dir>":
["name.md", "sub/"] }`), `ORDER_FILE` (`.ilmi/order.json`), `entryOf`,
`ordered(nodes, list)` (listed first, the rest in the walk's order),
`directories` / `childrenAt(tree, dir)` (the root, each folder, each
document with children by its children directory), `cleanOrder`,
`pruneOrder` (stale names and directories dropped), `followMove` (a rename
in place, a move out of the old list, the moved node's own directories
re-keyed), `forget`, `placeEntry`. `Vault` holds `order` (read at open,
reread when the watcher reports the file), `setOrder(dir, names | null)`,
`place(path, target, 'into' | 'before' | 'after')` (into: a move to
`childDirOf(target)`; before/after: a move to the target's directory and
that directory's whole list written with it beside the target), and a
`{ kind: 'order' }` event; `rename`, `move`, and `remove` write the order
they change, pruned (nothing is written while no order was ever set).
`move` also carries a sibling file the `pdf` field names (the stem's PDF
and the children directory already went along) and `dropIfEmpty` removes a
document's children directory a move or a delete leaves empty (a plain
folder stays). `rekey` now maps a document's children directory itself, so
a tab on a children lens and its order follow a rename. App: the store's
`order`; `placeNode`, `sortByName`, `openDir` (the row holding a
directory, a document's own row for its children) in `src/app/vault.ts`;
`dropMode` (thirds; the root row only into) in `NodeMenu.tsx`, used by the
tree and the folder lens, both of which draw `ordered` lists and take the
same drags. The menu's `new …`, `import a file…`, and the intake go into
`childDirOf(id)` (inside a document); `move to…` is `moveTargets` (names.ts:
the root, folders, and documents, depth first in order, indented 12 px a
level, the node, its subtree, and its present directory left out); `sort
by name` shows only when the directory has an order; delete on a node with
something under it turns into `delete with N inside?` and takes a second
click. `FolderLens` takes a document's children directory as its id (its
title the document's, crumb `inside <kind>`, its empty space the
document's own menu); it is opened from the inspector's new `children`
line (every document type) or ⌥-click on a document's chevron. `titleOf`
names a children directory for its document. The plugin API's watch skips
`order` events. FORMAT §1 and §6.3 say a children directory holds any
node, the order file, and that a backref is not rewritten by a move.
Corpus: `courses/linear-algebra.md` with a deck (two cards due in
September), a draft (not enrolled), and `unit-2/eigenvalues.md`; the
corpus counts in `schedule.test.ts` (upcoming 20 → 22, cards 29 → 31),
`vault.test.ts`, `tree.test.ts`, `plugins.test.ts` follow. README: the
nesting paragraph. Smoke: `ILMI_SMOKE=nest` (`smokeNest`). Tests: 569
(+29 over 540: the new corpus files' round trips; `vault.test.ts`
nesting (the course's children of every kind, a deck into a source with
its directory made, a folder into a draft through `place`, a document
with children and a PDF moved and its pages found, a named sibling PDF
carried, the empty children directory removed and an empty folder kept,
no move into its own children) and order (none until set, unknown names
after, reopen, before/after writing the whole list, stale names dropped on
the next write, a rename followed in place and the parent's rename
re-keying, a move out, sort by name, a delete, the file edited by hand)
and the pure functions; `tree.test.ts` (app) into/before/after on a
document row, a folder row, the root, no drop into its own subtree, the
order drawn, `move to…` listing documents indented; `node-menu.test.ts`
new items inside a document, the children lens, sort by name, the delete
that asks; the `rekey` line), 30 files; typecheck clean; cargo 12.
Open: a real pointer drag in the window (the smoke dispatches the drag
events on the rows; WebKit's own drag image and the thirds under a real
pointer are not seen); the folder lens has no drop on its empty space
(only on rows) and no `into` the folder shown; ⌥-click on the chevron is
the only way from the tree to a children lens; a move of an extract out
of its parent leaves the backref pointing at nothing, as FORMAT says; an
order is kept for the root of a children directory only while it has
children (an emptied one is removed with its directory).
- FORMAT §1: a document's children directory holds any node, documents of
  every type and folders, not only extracts; say so, and that an extract's
  backref (§6.3) is unchanged by where its file sits. The corpus gains a
  document with a deck, a draft, and a folder among its children
  (`vault/courses/linear-algebra.md` with `linear-algebra/`), and the
  round-trip and walk tests cover it.
- The tree: a drop on the middle of any row goes *into* it (a document's
  children directory created on demand, its row gaining a chevron and
  opening); the top and bottom thirds place before and after, as folders
  do now, for every row. `move to…` lists documents as well as folders
  (nested, indented by depth, the node itself and its own descendants
  left out). The node menu's `new …` entries on a document row create
  inside that document (today they land beside it); the folder lens of a
  document's children (opened from a document's row chevron area or the
  inspector's `children` line) works as a folder's does. Moving or
  renaming a document carries its children directory and its PDF (check
  that it does today; make it so if not), deleting a document asks first
  when it has children and says how many. A children directory left empty
  by a move is removed.
- Order: each directory may have an order, kept in `.ilmi/order.json` as
  `{ "<dir>": ["name.md", "sub/", …] }` (view state, per FORMAT §1's rule
  that view state lives in `.ilmi/`). Names not listed follow in today's
  order; listed names that no longer exist are dropped on the next write;
  renames and moves through the app update it. A before/after drop in the
  tree writes the order (today it only moves to the directory); the folder
  lens lists in the same order and takes the same drags. `sort by name`
  on a folder's or document's menu clears its order. The palette's index,
  the queue, and the session are unaffected.

Done when: `walk.test.ts` / `vault.test.ts` cover a document's children of
every kind, a move into a document creating its directory, the move of a
document with children and a PDF, the empty directory removed, and the
order file (write, unknown names after, stale names dropped, rename
followed); `tree.test.ts` covers into/before/after on a document row and
`move to…` listing documents; `ILMI_SMOKE=nest` drags a deck into a
source, a folder into a draft, reorders three rows, renames the parent,
and logs the tree and `.ilmi/order.json` after each; captures read (by
window id, see the 2026-10-28 entry).

### [x] 31. Tabs — a document's children as tabs beside the page
Done 2026-10-28 on main; commit `a6e97d9`.
Notes: `tabs: true` is a front-matter field (FORMAT §3, a **Tabs**
paragraph; `tabs: false` written only by hand; a bad value a raw line);
the corpus course `courses/linear-algebra.md` carries it. `src/app/tabs.ts`
(new, pure but for `addTab`) is the model: `notebookOf(path, docs)` (the
outermost document at or above `path` with `tabs`; a children directory
as 30's folder lens is not a page), `notebookPages` (the step order, depth
first, subtabs counted), `railRows(tree, nb, order, open)`, `tabAncestors`,
`stepPage`, `tabLabel` (`linear algebra › unit-2`), `notebookTrail` (the
palette's sub), and `addTab(vault, dir, type, name)` (a document last in
the directory's order, the whole list written). A pane tab on a notebook
holds the path of the page it shows; `openTab` takes a `same` predicate
and `openNode` passes "same notebook", so a page opened from anywhere (the
tree, the queue, a card from the palette, a session's source) shows in the
notebook's existing tab with its key kept, and the last tab reopens on
its page. `Lens` wraps a notebook's page in `Notebook` (`src/app/Rail.tsx`,
new) around `PageLens` (the old dispatch); the page sits in its own
`.pane-body.nb-page` (so the PDF lens and the session find their scroller),
keyed by the page. The rail: overview row, tabs in 30's order, subtabs
under a chevron (local state; the tabs above the page shown open by
themselves), click, double-click rename, the node menu with `add subtab`,
drags through `placeNode` (overview only `into`), `+ tab` (a draft named
`untitled`, renamed in place) and `+` (source, deck, draft, import a
file…). ⌘⌥↑/↓ step, ⌘⇧[ or «/» fold; the fold is `railFolded` in the
store and `rails` in `.ilmi/state.json`, re-keyed on a rename. The node
menu on any document has `show as tabs` / `show as tree` (`setTabs`). A
deleted page's tab goes back to its notebook's overview (`pagesToNotebook`
in the `gone` handler). The bottom strip shows `⌘⌥↑↓ tabs` on a notebook's
page. The sidebar tree is unchanged: a notebook's children are rows there,
folded unless opened. Smoke `ILMI_SMOKE=tabs` (`smokeTabs`). Tests: 587
(+18 over 569: `format.test.ts` 1, the field and the corpus file; `tabs.test.ts` 17:
the notebook of a page, the label, the rail's order with subtabs folded
and open, the step order, the palette's trail, one pane tab per notebook,
and in the canvas a click keeping the rail, the chevron, a page from the
queue landing on its tab, the step keys, the fold, `+ tab` and `+`, the
row menu, drags; `addTab` over a real vault), 31 files; typecheck clean;
cargo 12. Open: a real pointer drag on the rail (the smoke dispatches the drag events, as 30's did); the wider pane tab for a notebook's label (340 px, after the window showed `linear algebra › problem…` cut at 220) is not seen in the window; ⌘⇧[ and ⌘⌥↑↓ were dispatched as events, not typed (the File menu binds neither, but a real keypress through WebKit is unseen); a folder tab deleted leaves its pane on
"no longer in the collection" (only a document's `gone` sends the tab
back); subtab open state is not remembered; the rail takes no drag from
the sidebar tree or an OS file onto a row as `into` (an OS file on a rail
row lands beside it, as 29's rule for a document row).
- A document whose front-matter says `tabs: true` (FORMAT §3, a new
  optional field, round-trip test, corpus file: the linear-algebra
  document from 30) opens with a tab rail on the left of the reader, as
  Google Docs' "document tabs" panel: the document itself first (its own
  title, the "overview"), then its children in their order (30), each a
  row with its glyph and title, subtabs (a child's own children)
  indented under it and folded by a chevron. A click shows that child in
  the same pane, the rail kept; the pane's tab strip keeps one tab for
  the whole notebook, its label the parent's title and the open tab's
  (`linear algebra › unit 2`). The rail folds to a strip with ⌘⇧[ or its
  own handle, remembered per document in `.ilmi/`. Every lens works in
  the rail's page: a source, a draft, a deck, a PDF, a folder.
- Making and arranging tabs: `+ tab` at the rail's foot makes a new
  draft child (named `untitled`, renamed inline); its menu (`+` beside
  `+ tab`) offers source, deck, draft, and `import a file…` landing in
  the children directory (29's landing); the rail's rows take the node
  menu (rename, move to…, delete, `add subtab`) and drag to reorder or
  nest (30's order and into). `show as tabs` / `show as tree` on any
  document's menu sets or clears `tabs`; a document with tabs still shows
  its children in the sidebar tree (folded by default).
- The queue and the session name a tab's item by its path as now
  (`courses/linear-algebra/unit-2`); opening one from the queue opens the
  notebook on that tab. ⌘⌥↑ / ⌘⌥↓ step to the previous and next tab;
  the palette indexes tabs under their notebook.

Done when: `format.test.ts` covers `tabs` and the corpus file;
`tabs.test.ts` covers the rail (order, subtabs folded and open, a click
showing the child with the rail kept, the pane label, `+ tab` creating a
draft child in order, a drag reorder writing the order, opening a tab's
item from the queue landing on that tab, the step keys); `ILMI_SMOKE=tabs`
turns the corpus course into tabs, adds two tabs and a subtab, reorders
them, opens a deck tab and a source tab, folds the rail, and logs the
rail and the file tree after each; captures read.

## Decks

The user, 2026-10-28: "I think decks need some richer features." Asked
which first, they chose three: a card browser, editing cards in place,
and studying one deck. Per-deck stats and options wait. Today the deck lens
(`DeckLens` in `src/app/Lenses.tsx`) lists a deck's cards with `+ card`
(m), delete (⌫ or ×), `move to…` another deck, and j/k; a card is edited
only in the reader over the deck's file. "Deck" below means any document
with cards (a deck file, a source with cards in it, a tab from 31), and a
folder or a document with children means every card under it.

### [x] 32. Decks — a browser, cards edited in place, and studying one deck
Done 2026-10-28 on branch worktree-agent-aedb6add9558a8a41; commit `e83b596`.
Notes: FORMAT §6.2 gains `sus` (bool, written `sus=1`, `sus=0` dropped on
the first write, §8): on the bare line the whole card, on an `sr cN` line
that blank alone; the schedule is kept. `isSuspended(card, group)` in
`src/schedule/queue.ts`; `cardItems` leaves suspended groups out, so the
queue, every session, the counts, and `DocInfo.due` lose them; `fromFsrs`
carries `sus` like `pri`. Corpus: `problem-set-1.md` gains a suspended
q&a (`la-eigvec`) and a two-blank cloze with `c2` suspended (`la-rank`);
the schedule counts follow (upcoming 22 → 23, cards 31 → 32). The model
is pure: `src/app/deck.ts` (rows per card, the soonest unsuspended blank's
schedule shown for a multi-blank cloze; `fold` for the search, NFKD with
every combining mark and the tatweel stripped, so Arabic without marks
finds the voweled word and a voweled search the bare one; `faceText`;
`filterRows`: every search word in either face, any chip within a kind,
both kinds; `sortRows`; `clickSelect` / `selectAll`; `docsUnder` the lens's
documents in tree order; `docTargets`; `applyBulk`, one `update` per file,
a move writing the destination first; `restore`; `bulkLine`),
`src/app/cardEdit.ts` (faces, `switchForm`, `planEdit`, `applyEdit`,
`insertCard`, `withPri`), `src/app/study.ts` (`studyItems`). The writes
and the session are `src/app/deckOps.ts` (`bulkCards` with its notice and
undo, `saveCardEdit`, `newCardAt`, `studyDeck`, `hasCards`). The view is
`src/app/DeckBrowser.tsx` (`DeckBrowser`, `CardEditor`, `FaceField`: a
one-paragraph ProseMirror state from `makeState` with the reader's node
views, so a face edits with 26's inline rules and math chips; ⌘B makes a
blank in a cloze) and `src/app/deck.css`. `DeckLens` in `Lenses.tsx` is
now the browser under the deck's title; `FolderLens` gains `items · cards`
(local, not remembered), the cards side being the browser over everything
under it, a children directory's owner first; the root's lens is the
whole collection. Choices made: `both ways` is the chip's word, the row's
tag stays the queue's `bidir`; `created` sorts newest first by position
(a card carries no date; new cards are written at the end); `difficulty`
and `lapses` sort high first, `last reviewed` most recent first, `due`
and `interval` low first; state chips leave suspended cards out of
new/learning/review/due; `reset` asks with a second click (`reset 3 cards
to new?`) and keeps the card's `pri` and `sus`; `set priority` is a number
field in the bar, empty meaning the document's; the q&a front of a cloze
shows the first blank as `[…]` and the other blanks filled in; with no
bare line, a form change that leaves no numbered blank makes the lowest
group line the bare one (a one-blank Anki cloze keeps its history), and
the rest are dropped, asking (`drops the schedule of blank 2 (3
reviews)`, ⌘⏎ again to save) when any has reviews; a press outside the
editor saves, or lets go when the faces are no card; ⇧⌘⏎ saves and opens a
new card after it; single deletes (⌫, ×, the row menu) are `removeCard`
as before, without an undo, several selected go through the bulk delete
with one. Cram (`include not due`): the reviewed cards in the queue's order
(due first, then by due), new cards last; FSRS takes an early review in
stride (elapsed days from `last`, stability grown less), the test grades
one a fortnight early. The session's store gains `deck` (`{ id, title }`):
its header reads `german · A1 · 5 left` and its end opens the deck's lens
again (the session tab is replaced). The node menu shows `study` on
anything with cards under it; the palette's `study…` lists every folder
and document with cards (`the whole collection` for the root). The
filter chips and sort are remembered per lens id in `.ilmi/state.json`
under `decks` (`setDeckView`), re-keyed on a move. The deck hints add ⏎
edit and / search. Smoke: `ILMI_SMOKE=decks` (`smokeDecks`). Tests: 611
(+41 over 570 with the `sus` format test: `deck-browser.test.ts` 21,
`card-edit.test.ts` 12, `study.test.ts` 8), 33 files; typecheck clean;
cargo 12. Open: the window run (`ILMI_SMOKE=decks`) is owed; `has flag`
waits for flags; a real typing check of the face fields in WebKit (the
smoke types with `execCommand('insertText')`); the editor's place near the
bottom of a long list; a filter that hides the cursor's row leaves the
inspector on it; the folder lens's `items · cards` is not remembered;
`study` on a lens with nothing due says so in a notice rather than
offering the cram.
- Browser. The deck lens gains a bar over the list: a search field (`/`
  focuses it; text in either face, a cloze's answers included, case and
  accent folded so Arabic without its vowel marks finds the voweled
  word), filter chips (form: q&a / cloze / both ways; state: new /
  learning / review / due / suspended; `has flag` once flags exist below),
  a sort (deck order, due, interval, difficulty, lapses, last reviewed,
  created), and the count `12 of 340`. Each row shows its form tag, the
  front, the back dimmed, and on the right its due and interval (the
  queue's labels). The deck lens of a folder or of a document with
  children (30) lists every card under it, each row with its file's path
  in mono (28's label), so the browser doubles as a whole-collection
  browser from the root's lens. The filter and sort are remembered per
  deck in `.ilmi/`.
- Selection. Click selects, ⇧-click a range, ⌘-click toggles, ⌘A all
  shown; with a selection the bar shows `N selected` and the actions:
  move to… (any deck or document, 30's nested list), delete, suspend /
  unsuspend, reset (the schedule back to new; asks), set priority, and
  `study these`. Every action is one write per file and undoable from
  its notice (29's notice).
- Suspended. FORMAT §6.2 gains `sus=1` on a card's bare `sr` line (or a
  group's line for one blank): the card keeps its schedule and is left
  out of the queue, the session, and the counts until unsuspended. A
  round-trip test and a corpus card. The deck row shows it dimmed with
  `suspended` in place of its due.
- Edit in place. ⏎ or a double-click on a row opens it as an editor in
  the list (the session's two-face look from 16, smaller): the front and
  the back as live-rendered fields (26's inline rules and math chips), a
  form switch (q&a ⇄ both ways ⇄ cloze: q&a to cloze turns the back into
  `{{c1::…}}` after the front; cloze to q&a takes the first blank's answer
  as the back and the text with the blank as the front; both ways is the
  q&a with `:::`), and the card's priority. ⌘⏎ or a click outside saves
  (one write: the card's lines, its `sr` line and id kept), Escape
  cancels. A schedule survives every edit; a form change keeps the bare
  line and drops group lines that no longer exist, asking first when
  they carry reviews. `m` makes a new card as the composer does, now in
  the same editor at the cursor's place.
- Study this deck. A `study` button on the deck lens (and `study` on the
  node menu of any deck, folder, or document with cards; and `study…` in
  the palette) opens a session over the cards under it that are due, in
  the queue's order, with the session's look and grades. A toggle beside
  it, `include not due`, crams: every unsuspended card under it, new
  ones last, graded as usual (FSRS takes an early review in stride; say
  so in the notes). `study these` from a selection does the same over
  the selection. The session's header names the deck and counts down;
  the end returns to the deck lens.

Done when: `format.test.ts` covers `sus` on a bare and a group line and
the corpus card; `deck-browser.test.ts` covers the search (both faces, a
cloze's answer, Arabic with and without marks), each filter, each sort,
the folder lens listing cards under it with paths, selection by click /
⇧ / ⌘ / ⌘A, and each bulk action's writes with one write per file;
`card-edit.test.ts` covers an edit of each face, the three form switches
with their schedule rules, the cancel, and a new card at the cursor;
`study.test.ts` covers the session over a deck, a folder, a selection,
with and without `include not due`, suspended cards left out;
`ILMI_SMOKE=decks` searches the german deck, filters to due, sorts by
interval, selects three and suspends them, edits one card's back and
switches another to cloze, studies the deck with two grades, and logs the
file's lines after each; captures read.

## Refinement

The user, 2026-10-30: "The tabs feature still seems a little bit hard to
use … with nesting, there needs to be better UI/UX there as well. I think a
lot of cleanup is needed, overall, to make this feel like an actual refined
product. The markdown text editor also feels quite primitive … The
nomenclature between source/draft is also confusing … consider how an
actually mature [collection] would look like. Use a 3rd year arabic &
physics double major as an example … perhaps someone takes written notes
in class writes them up here later, then incremental flow is just making
cards / spaced repetition material from those. Or alternatively, someone is
going through a textbook and makes the SR material from there … Need to
keep the incremental workflow flexible."

That collection is `samples/double-major/` (74 files, ~91k words, 755
cards, 133 due on 2026-10-30; `ILMI_VAULT=…/samples/double-major
ILMI_SMOKE=tour` walks its screens). Every milestone below is judged on it:
its window check runs over a copy of it, not only the corpus. Two reports
feed this section and are summarized in each milestone: a survey of
Obsidian, Typora, Bear, Notion, RemNote, SuperMemo, Google Docs tabs and
tree libraries, with an audit of our editor, tree and rail; and the
friction the sample's author hit writing a real student's collection with
today's kinds. Copy rules (BUILD-PROMPT) hold for every new string.

Order: 33 first (it touches every label). Then two tracks: the editor
(34 → 35 → 36 → 37) on main, structure (38 → 39) on a branch. 40 and 41
after both.

### [x] 33. Notes — what you write is a note, what you read is a source
Done 2026-10-30 on main; commit `8dceb49`. The window check is pending:
run `ILMI_SMOKE=notes` with `ILMI_VAULT` on a copy of
`samples/double-major` and read its `shot:` captures (the screen was
locked this session, so nothing was run in the window).
Notes: FORMAT §3 has `note` in the `type` row, the default, and a **Type**
paragraph; the read line on a note is *revisited* and has no `pos` (one
written by hand is kept and dropped on the next pass). Choices made here:
- **A typeless file with `imported` is a source.** The importers wrote no
  `type` before this milestone, so an old imported file (frozen,
  `imported`) would have turned into a note; `meta()` reads it as a source
  until something writes a `type`. Every importer now writes `type:
  source` (`importDoc`, `importPdf`, the EPUB chapters through it, the
  clipper, SuperMemo topics); `createDoc` writes no `type` for a note and
  `type: source` for a source.
- **How revisit picks a heading:** it does not store one. On a revisited
  note the reader's top row has a quiet `from…` select (the top, then the
  note's headings to level 3, indented); choosing scrolls the page to it.
  A pass always opens at the top, in the session and out of it; nothing is
  written, so edits never shift it.
- **The read line on a note:** `due ivl reps` (and `af` when not the
  default, `pri=` as on any line); `enrolReading` writes it without `pos`,
  `advanceRead` drops a `pos` on a note, `Vault.extract` leaves a note's
  line alone, and the reader draws no marker or gutter. In the queue it is
  a read item with `note: true`, `pos` 0, its row tagged `note`; the
  session's bar says `note` and `went over it ⏎`.
- **The new menu's order:** new note, new source, new deck, new draft, new
  folder (then import a file…, add from text or a link). The folder lens:
  `+ note`, `+ source` (the intake, as before), `+ deck`, `+ draft`, `+
  folder`. The rail's `+ tab` and `add subtab` make notes; its `+` lists
  note, source, deck, draft, import a file…. The node menu has `revisit` on
  a note not yet enrolled. The intake lands text pasted or typed into its
  field as a note (no `type`, editable, no `imported`, h1 `Add a note`); a
  file, a PDF, a fetched page, or a book still lands as a source.
- **Glyphs:** note `¶` (one's own paragraphs), source `“` (someone else's
  words); extract `↳`, deck `◫`, draft `✎` unchanged. 38 is to pick the
  final quiet set at 13px.
- Notes extract (`⌘⇧E`, or `e` when frozen); drafts still only make cards.
- **Keys:** `readerAction` (Reader.tsx) decides: bare `e` `m` `r` only
  where the text is not being edited (a frozen page, or the surface not
  focused); ⌘⇧E extract and ⌘⇧M card anywhere there is a selection. The
  focused surface's `handleKeyDown` passes `view.editable`; the window
  listener skips contenteditable targets. ⌘⇧M was free; ⌘⇧E was the
  sidebar's toggle (App.tsx, from milestone 9), which moves to ⌃⌘S
  (macOS's own View › Show Sidebar); the native menu (src-tauri lib.rs)
  binds only ⌘⇧N, ⌘O, ⌘⇧O, ⌘⇧W and the standard Edit/Window items, none of
  them these. The selection cue shows `⌘⇧E` / `⌘⇧M` on an editable page and
  `e` / `m` on a frozen one; the bottom strip does the same (`frozen` and
  `note` in `HintContext`; a session's element reads its own document).
- F2 renames only while the tree has focus: the tree box is focusable
  (`tabIndex 0`, a click on a row gives it focus) and F2 is its own
  `onKeyDown`, not a window listener.
- The sample: four notes lost `type: draft`, `started`, and `write:`
  (conditional sentences, WKB, grand canonical, and the term paper's
  reading notes: notes toward the paper, not the paper); the term paper
  and its outline stay drafts. Five revisited notes lost `pos`. The two
  book documents under `library/` became `type: source` (their chapters
  and passages already were). Done through `parse`/`setField`/`serialize`
  by a scratch script, not the generator. Now: 34 notes, 11 sources, 17
  extracts, 10 decks, 2 drafts; 31 reading lines, 1 open draft.
  `src/format/__tests__/samples.test.ts` walks `samples/` (parse clean,
  fixed point) and holds the migration.
- Corpus: `fleeting/lecture-9.md` (typeless) and `fleeting/office-hours.md`
  (`type: note`, `read:` with no `pos`); the queue's corpus counts gain one
  upcoming and one reading.
Left for later: the intake's empty h1 still says `Add a source`; a note's
`from…` pick is not remembered; `stop revisiting` is only the session's
`done`; the Pdf lens is unchanged (its pages are always a source's).
Today a file with no `type` is a `source`, so typed-up lecture notes sit in
the same kind and lens as a frozen textbook chapter, and notes still being
typed had to be `draft` with `write:` to come back, which puts
transcription in the essay queue. The names, settled with the survey
(Obsidian and Readwise say *note*; RemNote and Readwise say *source*;
SuperMemo's *extract*; Anki's *deck*):
- **note**: your own writing. Editable, cards anywhere in it, no schedule
  unless asked. `type: note`, and the default for a file with no `type`
  (a plain Markdown folder opened in ilmi is notes). New, `+ tab`, and
  paste-as-text make notes.
- **source**: what someone else wrote, read incrementally: imports, PDFs,
  EPUB chapters, clippings. Every importer writes `type: source`
  explicitly, so old imported files keep reading as sources.
- **extract**, **draft** (incremental writing, resurfaces until done),
  **deck** unchanged.
- A note can be **revisited**: `revisit` (the reader's top row and the
  menu) enrols it in the reading loop the way `start reading` enrols a
  source, but a pass over a note starts at the top or at a heading the
  user picks, not at a remembered `pos` (edits shift `pos`, the sample's
  author found). On a note, the read line keeps `due`/`ivl`/`reps`/`af`
  and has no `pos`; FORMAT §3 says so.
FORMAT §3: `note` in the `type` row, the default changed, a corpus file
(`fleeting/` gains a typeless note and a `type: note` with `read:`), the
default-change test. The menus, the "+" list, the palette, the queue's
row tags (`NOTE`/`READ`/`WRITE`/card forms), the inspector, glyphs, and
the tree's kind tags all use the five words. `samples/double-major` is
migrated: typed-up lecture notes become notes (those enrolled in writing
only because they were unfinished lose `write:`), textbook and reader
chapters stay sources. A test parses every file in `samples/` with no
diagnostics and the round-trip fixed point.
Also here, because it is the worst thing in the editor today: bare `e`,
`m`, `r` fire only where the text is not being edited (a frozen page, or
the surface not focused). In editable text, with a selection: ⌘⇧E
extract, ⌘⇧M card (the selection cue shows these keys instead of the
bare ones; no ⌥-letter keys, which are dead keys on a Mac keyboard).
Typing over a selection types. F2 renames a tree row only when the tree
has focus.
*Done when:* a typeless file opens as a note, imports land as sources, the
five words are the only words on screen for the kinds, a note can be
revisited from the top, selecting a word in a note and typing `e` types
`e`, and the sample collection migrated parses clean.

### [ ] 34. Editing like an editor — keys, rules, lists
Today the keymap is undo, redo, Enter, Tab, Backspace (plugins.ts:640),
and only the `#` heading rule exists; lists, quotes and code appear only
after a re-read. Table stakes from Obsidian Live Preview, Typora, Bear:
- **Formatting keys** that write the Markdown markers: ⌘B bold, ⌘I
  italic, ⌘E inline code, ⌘⇧X strike, ⌘K link (a small field for the
  address; pasting a URL over a selection links it), ⌘1–⌘6 heading
  level, ⌘0 paragraph, ⌘⇧7 numbered list, ⌘⇧8 bullet list, ⌘⇧9 task
  list, ⌘⇧. quote. Toggling off removes the markers.
- **Block input rules**, live: `- ` `* ` `1. ` `[ ] ` `> ` ```` ``` ```` +
  language + ⏎, `---`, `$$` ⏎. Backspace right after a rule fires undoes
  it to the typed text.
- **Lists**: Tab/⇧Tab indent and outdent the item with its children; ⏎
  on an empty item outdents, then leaves the list; Backspace at an item's
  start makes it a paragraph; ⌥⇧↑/↓ moves the item with its children;
  a task's box toggles by click and ⌘⏎.
- **Selection toolbar**: on a selection in an editable page, a small bar
  above it: bold, italic, code, link, then `card ⌘⇧M` and `extract ⌘⇧E`
  (in a frozen page, only the last two, as the cue is today). Quiet,
  hairline, no icons that need learning: letters and the existing glyphs.
*Done when:* each key and rule works in the window on a note in the
sample (the smoke drives them and logs the file after each), lists move
and indent with their children, and the toolbar appears over a
selection and is gone when it is.

### [ ] 35. Insert, paste, find
- **Slash menu**: `/` at a block's start or after a space opens a list
  filtered as you type (↑↓ ⏎, Esc leaves the `/`): heading 1–3, bullet,
  numbered, task, quote, code, math block, divider, table, image, and the
  three card forms (cloze, q&a, both ways) that wrap the current
  paragraph. Each row shows its Markdown and its key.
- **Paste**: HTML → Markdown (reuse the EPUB importer's reducer,
  `reduceChapter`, src/import/epub.ts), ⌘⇧V plain; an image pasted or
  dropped into a page lands in the document's children directory as
  `img-NN.png` (§1) and is linked there.
- **Find in page**: ⌘F a field at the page's top with match count, ⏎/⇧⏎,
  ⌘G; ⌥⌘F replace (editable pages only). Matching folds marks the way the
  deck search does (Arabic ḥarakāt, accents).
*Done when:* the slash menu inserts every block kind and the card forms
on a sample note, a pasted web fragment (lists, emphasis, a link, a
heading) lands as the right Markdown, a pasted image is a file beside the
note, and find walks every match of an unvoweled Arabic word in a voweled
page.

### [ ] 36. Arabic beside English — direction, type, marks
The double major writes Arabic with ḥarakāt between English sentences and
math. Today there is no `dir` anywhere, the layout is left-anchored
(reader.css:222–259), and no Arabic face is in the stacks (tokens.css).
- Each block's direction from its first strong character (Obsidian's
  rule): a block with none (empty, digits, math only) takes the previous
  block's. A decoration, never written to the file. Lists, quotes, card
  faces, the queue's rows, tree names, the deck browser, and the session
  get `dir="auto"` or the same rule.
- Inline math and code are isolated LTR (`unicode-bidi: isolate`), so a
  formula in an Arabic sentence keeps its order; card markers (`::`,
  `{{…}}`) and `^id` stay readable in an RTL line.
- Arabic faces bundled through @fontsource (no CDN): a Naskh for prose
  (Noto Naskh Arabic or Amiri) and IBM Plex Sans Arabic for chrome; RTL
  blocks a little taller (≈1.85) so marks are not clipped; no
  letter-spacing on Arabic; no overflow clipping that cuts ḥarakāt.
- Logical CSS (`margin-inline-start`, `padding-inline-…`) in the reader,
  the read marker and the card chips follow the block's start side.
- A cloze whose answer is only combining marks (a case ending) shows its
  blank on the letter it sits on, not as an empty chip.
*Done when:* the sample's grammar notes, the classical prose reader, and
the vocab deck read right in the window in light and dark, a formula
inside an Arabic sentence stays in order, and a voweled word never shows
a clipped mark.

### [ ] 37. Cards where notes put them, and review in their place
The class-notes workflow (RemNote's benchmark): cards are made while
typing, in whatever shape the notes have, and review shows where a card
came from.
- **Cards in list items** (FORMAT §5): a list item whose text is a card
  is a card; its `sr` line sits under the item, indented as the item's
  continuation. Today `- term :: def` is silently not a card (the sample's
  author hit this). Corpus file and round-trip tests for bullets, numbered
  items, nested items, and a cloze inside an item.
- Card backs may hold step lines (`1.`, `- `) for derivations, as the
  continuation of the card's paragraph or item (§5), if the parser can
  take it without ambiguity; otherwise say why in the notes.
- **Review in context**: the session shows the card's heading path
  (`stat mech › canonical ensemble › the partition function`) above it,
  and `go to source` opens the document scrolled to the card with the card
  marked, not at the top (Session.tsx:369).
- **Study from anywhere**: `study` in the reader's top row of any note or
  source with cards, and on the rail's rows (32's `studyDeck`).
*Done when:* bullet cards in a sample note are in the queue, reviewed,
and their lines rewritten in place; the session shows the heading path;
go to source lands on the card.

### [ ] 38. The tree, refined
From the survey (Atlassian's pragmatic-drag-and-drop, VS Code, Obsidian,
the WAI-ARIA tree) and the audit (Tree.tsx, NodeMenu.tsx, app.css:228):
- **One drag model** for the tree, the tab rail, and the folder lens (one
  module, used by all three; drags cross between them): a row's top and
  bottom quarters place before/after, the middle half nests; an open
  parent has no "after" zone (it means first child); below a last child,
  the pointer's horizontal position picks how far out it lands. Before/after
  draw a line indented to the landing depth with a small ring at its
  start; nesting draws a hairline box around the target; a refused drop
  shows nothing and the cursor says no. No flicker crossing a row's text.
  During a drag: a folded row opens after 500 ms of hover, the tree
  scrolls at its edges, Esc cancels.
- **Keyboard**: ↑↓ move, → opens / goes to first child, ← closes / goes
  to parent, ⏎ opens, F2 renames, ⌘⌫ deletes (asking as today), ⌥⌘↑↓
  moves the row among its siblings, ⌥⌘←→ outdents/nests it, typing a
  letter jumps to the next name starting with it.
- **What's shown**: the selected row drawn (it decides where `+` creates);
  the open document revealed and highlighted in the tree; indent guides
  (hairline) under an open parent; a name is never truncated for its
  counts: one due number, right-aligned, shown only when something is
  due, the full counts in the row's tooltip; folders and documents told
  apart by type, not by `/`, `¶`, `◫`, `✎` alone (pick one quiet set with
  the user's five kinds, tested at 13px). Slugs show as names (`unit-2` →
  `unit 2` only when there is no `title`; never rename the file).
- **Row affordances**: on hover, `+` (the new menu, placed inside) and
  `⋯` (the row's menu) at the row's end; an empty folder or document
  shows one quiet placeholder row that takes drops.
- **Breadcrumbs** in the reader are links; ⌥-click a tree row hoists it
  (the tree shows only that subtree, a crumb to go back).
*Done when:* in the sample, every drag of the smoke lands where its line
or box said, a reorder never nests by accident, the tree is fully
usable from the keyboard, the open note is revealed, and no name is
truncated by its counts at the default width.

### [ ] 39. Tabs, refined
Today tabs are reachable only from `show as tabs` in a right-click menu,
the rail is a second full tree beside the sidebar's, extracts appear as
subtabs (a chapter with 40 extracts has 40 tabs), `+ tab` makes a draft
with a writing schedule, rows have no keyboard path, and ⌘⇧[ (macOS's
previous-tab key) folds the rail. Google Docs' document tabs are the
model:
- **Turning it on**: a `tabs` toggle in the reader's top row of any
  document with children (and in the menu as today). An EPUB import and
  a multi-chapter PDF land as a notebook, chapters as tabs.
- **The rail**: narrow (≈200px, resizable by its edge, width remembered),
  the document first, then its children; subtabs indented under a
  chevron, three levels at most; extracts never tabs (a tab's extracts are
  one folded `n extracts` line under it, opening the folder lens of them);
  the active tab's headings listed under it, indented, a click scrolls to
  the heading (Docs does this).
- **Rows**: a click opens; hover shows `⋯` (add subtab, rename, duplicate,
  move to…, delete) and `+` places a new note after it; drag reorders and
  nests with 38's model, and drags cross to the sidebar tree.
- `+ add tab` at the rail's top makes a note, named in place.
- Keyboard: the rail is focusable, ↑↓ ⏎ F2 as in the tree; ⌘⌥↑↓ steps tabs
  from the page; the fold key moves off ⌘⇧[ (pick one that collides with
  nothing in macOS or the app; say which in the notes).
- In the sidebar a notebook's row stays a document with its children
  under it (both views are the same files); the tab open in the pane is
  revealed in both.
*Done when:* on the sample's courses, tabs turn on from the top row, the
rail shows units without extracts, the active tab's headings navigate,
a tab is added, renamed, nested and moved by drag and by keyboard, and a
drag from the rail into the sidebar lands.

### [ ] 40. A pass over everything, on a full collection
With 33–39 in, run `ILMI_SMOKE=tour` over the sample and read every
capture in light, dark, and e-ink as the BUILD-PROMPT's test asks ("it
should read as a piece of software someone maintained for years for
their own use"). Fix what the captures show: copy that narrates or piles
up middots, uppercase tags, mono where prose belongs, spacing and
alignment, empty states, the queue's identical rows for a multi-blank
cloze (one row per card, blanks counted), stale or misleading counts.
Measure with the sample: open time of the collection, opening a 4,000-word
note, typing latency in it, the queue's build, and the deck browser over
755 cards; fix anything over 100 ms that a person feels. List what was
changed and what was measured, before and after.
*Done when:* every capture of the tour passes the BUILD-PROMPT's test in
all three themes, and the measurements are recorded with nothing a
person would feel as slow.

### [ ] 41. The editor's rest — outline, folding, code, tables
- An outline of the page's headings (in the inspector, or the rail's
  heading list when tabs are on), a click scrolls; headings fold by a
  chevron in the margin, folds kept in state.
- Code blocks coloured by language (a small highlighter, bundled, themed
  in the three themes; a language picker on the fence).
- Tables edited as tables: cells in place, Tab between cells, a row or
  column added at the edges; written back as the pipe table.
Wikilinks and backlinks are not here; ask the user after this one.
*Done when:* each works in the window on the sample and round-trips the
file.

## Notes for the next session

Milestone 33 (notes and sources, the reader's keys, F2) is done on main;
its window check is owed: `ILMI_VAULT=<a copy of samples/double-major>
ILMI_SMOKE=notes`, captures read and recorded under BUILD-LOG's 33 entry.
Next is 34 (editing like an editor), on main; 38 → 39 can start on a
branch. The sidebar toggle is ⌃⌘S now (⌘⇧E is extract).

Milestones 0–32 are ticked (13 dropped); 32 (decks) was built on a branch
beside 31 and merged by hand on 2026-10-28; its window check
(`ILMI_SMOKE=decks`) is recorded under BUILD-LOG's 32 entry. 31's window check (`ILMI_SMOKE=tabs`) is in BUILD-LOG's top
entry, 30's (`ILMI_SMOKE=nest`) in the one under it. The window
checks of 21, 24, 25, 26, and 27 are recorded in BUILD-LOG under their
entries with the fixes they forced (a fetched page is never auto-read as
cards and the comma rule wants a gloss for a back; the clipper
percent-encodes image paths; an image with an empty alt is drawn; `[^1]` is
not a note; the live smoke waits for maxwell's own surface). The window
checks of 27, 28, and 29 ran on 2026-10-28 and are recorded in BUILD-LOG's
top entry; the on-screen word is "collection" (the user's choice; the code
keeps `vault`), and Open Recent leaves out the open collection. Only a
person can still check a real Finder drag, ⌘V with nothing focused, and the
File menu by hand. What is left is a polish pass over the open
items each milestone's notes record (29: the notice's undo covers only the
last of several files, a second asking file waits unannounced, the
intake's own pick does not land, the paste with nothing focused unproven
in WebKit; 27: nested blocks inside an item, a quote's wrapped
paragraph as lines, no code block made in place, Tab by the item's own
width; 26: the editor's place near the right edge, undo not reopening it;
21: the popover's height and anchor, one meaning per card, one clitic; 24:
`.html` drops on the old pass, images fetched after landing with no cap;
25: tables and HTML blocks still atoms, an inline image's alt shown beside it, the queue row's inline code
not read in the window, emphasis across a math chip, no code colouring;
19: images and `linear="no"`; 17: media, suspended cards; 14: the user's
real collection; 10–15: their lists), the plugin directory the user set
aside ("can wait"), and, with the user, whatever is next. The handoff
prompt at the top of `BUILD-LOG.md` says so.
