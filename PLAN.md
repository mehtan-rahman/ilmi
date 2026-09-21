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
date, as ts-fsrs counts it; stability and difficulty are rounded to two
decimals. Reading: `reading.readOn` (ivl × 1.6, `pos` only moves forward),
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

### [ ] 4. Tree — sidebar and lenses
- Sidebar tree over the vault: folders, documents (source / deck / draft /
  extract) with the prototype's icons and per-type colour. Create, rename,
  move (drag), delete for folders and documents. Right-click menu.
- Tabs and panes as in the prototype (`app.jsx`): opening a node opens a
  lens. Folder and deck lenses can be lists for now.
- Resizable, hideable sidebar; persisted in `.ilmi/state.json`.
- Done when: every tree operation round-trips through disk (rename moves the
  file and its children directory) and the tests for it pass.

### [ ] 5. Reader — the unified document editor
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

### [ ] 6. Extracts and card making
- Select a passage in a reading lens → `e` carves an extract: child file under
  the parent's directory with `type: extract`, its own `read`; parent gets
  `<!-- extract name -->` under the touched paragraphs; marker advances.
- Select in any container → `m` opens the composer (cloze / q&a / bidir,
  ⌘B wraps `{{ }}`); the card is inserted after the selected paragraph.
- Card editor in the inspector edits a card in place.
- Done when: both flows produce files that `parse` cleanly and appear in the
  tree and the queue.

### [ ] 7. Import
- Intake: paste, drop a text file, or a URL → readable text. Title, target
  folder. Lands as a frozen source, unread, not enrolled.
- Done when: the prototype's intake sample imports and opens in the reader.

### [ ] 8. Queue and review session
- Queue view (today / upcoming / reading / writing / cards). Session shell
  with prev/next (`[` / `]`). Cards: reveal, grade again/hard/good/easy.
  Reading: read on / postpone / done with the marker live. Writing: worked on
  it / postpone / done. Multi-blank clozes show the other blanks dimmed.
- Done when: a full session over the sample vault writes every result to disk
  and the queue empties to one quiet line.

### [ ] 9. Chrome and polish
- Top strip, bottom strip with real key hints, inspector per node type,
  command palette, global keyboard router, tweaks panel (theme / accent /
  density). Copy pass: remove words.
- Done when: a screenshot of each screen passes the brief's "someone
  maintained this for years" test, and the whole loop (import → read →
  extract → card → review) runs end to end.

## Notes for the next session

Start at milestone 4, the tree. The sidebar reads `vault.tree` (`TreeNode`:
`folder`, or `doc` with optional `children` for the sibling `name/`
directory) and `meta(doc).type` gives the per-type icon and colour;
`App.tsx` today only lists `vault.documents()`. The prototype's tree is
`spec/hashiyah/tree.jsx` (`renderNode`, rename, drag, right-click menu) and
the pane/tab model is in `app.jsx`. Create, rename, move, and delete need to
go through `Fs` (`mkdir`, `rename`, `remove` exist; check `tauri-fs.ts` for
renaming across directories and removing non-empty directories) and the
`Vault` should re-walk afterwards and move `name/` together with `name.md`.
Open folders persist in `.ilmi/state.json` (`folders` is already in
`VaultState`). The queue is `queue(vault, now)` from `src/schedule/`; the
tree does not need it yet. Ask before adding a screen not in the prototype.
