# ilmi — build log

One entry per session, newest first. `PLAN.md` holds the milestone list and
the per-milestone notes; this file holds the narrative: what was done, what
was verified, what was not, and the prompt to resume with.

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
