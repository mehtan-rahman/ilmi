# ilmi today: on-disk format, load path, derived state, search, git sync, and measured scaling

Scope: codebase research on `/Users/mehtan/foundry/projects/ilmi` at commit `6d1b30b` (main, 2026-11-05) plus measurements run for these notes. No web sources were used. Every "Cited Finding" is either read from a file in the repository (path and lines given; links are relative to this notes file) or **measured** by scripts written for these notes. Anything not read or measured is under "Inferences" or "Gaps".

**How the measurements were made (applies to every "measured" line below).**
- Machine: Apple M5, 10 cores, 16 GB RAM, macOS 26.6.2, internal SSD. Node v26.8.2 (V8), run with the repo's own `tsx`.
- Scripts (in the session scratch directory, not in the repository, and not kept after the session): `/private/tmp/claude-501/-Users-mehtan-foundry-projects-ilmi/202d894a-ee60-4508-a489-5cf6c0106d42/scratchpad/research-load/bench.ts` (load, queue, search, memory), `revbench.ts` (review log), `extra.ts` (stat-only, JSON cache round trip), `gen.ts` (synthetic vaults), `fts.py` (SQLite 3.53.1 FTS5 comparison through Python's `sqlite3`). Raw outputs: `…/research-load/results/*.json`.
- The scripts import the project's own code by absolute path: `src/vault` (`Vault`, `walk`, `nodeFs`), `src/format` (`parse`, `serialize`), `src/schedule` (`docItems`, `examQueue`, `buryLinked`, `meterQueue`, `spentToday`, `sortQueue`), `src/app/deck.ts`, `src/app/chrome.ts`, `src/app/numbers.ts`, `src/app/same.ts`. `buildQueue`/`withDue`/the `publishDocs` loop are copied line for line from `src/app/vault.ts` because that module imports Tauri and cannot load in Node.
- Vaults: the sample `samples/double-major` as it is; `s1k`/`s10k`/`s50k` = 15/152/758 copies of the sample's Markdown in sub-folders, card ids and `link=` made unique per copy, the two PDFs hard-linked beside each copy, the sample's review log once; `p10k`/`p50k` = one tiny Markdown file per card (the commenter's assumption), 500 files per folder; `r100k`/`r500k`/`r1m` = review logs of that many lines over 60 month files.
- **Limits, stated once:** (1) File access is through Node's `fs`, not Tauri's IPC. The real app pays one IPC round trip per `stat`, per `readTextFile`, per `readDir`; that cost was **not measured** (the app was not run, by instruction). (2) File cache was **warm** (files written minutes before; `purge` needs root, so no cold-cache figure). (3) The engine is V8 under Node; the app's renderer is WebKit's JavaScriptCore (macOS/iOS WKWebView), so absolute times and heap sizes will differ. (4) The synthetic sample-shaped vaults are copies, so text repeats; sizes scale honestly but content is not varied. (5) Each size was run once in a fresh process; repeated in-process timings give min/median where noted.

---

## 1. Format: is a card a file? Where do schedule fields live? What lives outside the Markdown? How big is the sample?

### Takeaway
A card is **not** a file: a card is a paragraph (or list item) inside a document, and its schedule is one HTML-comment line directly under it; a deck is one Markdown file holding many cards. In the sample, 66 Markdown files (654 KB) hold 758 cards and 774 card schedule lines; the largest deck is one 32 KB file with 178 cards. Outside the Markdown there are only small app-private files under `.ilmi/` (order, review log, not-the-same pairs, per-device view state) and PDFs read in place.

### Cited Findings
- "A vault is a directory of Markdown files. The app is a viewer over them, never their owner." Three rules: only annotations are the app's; "One review touches one line. A card's schedule is one comment line directly under the card. Grading rewrites that line and nothing else"; damage is local. — [FORMAT.md:3-21](../../FORMAT.md)
- Layout: a directory is a folder, a `.md` file is a document, anything else is ignored; dot-directories are ignored; `name.md` beside `name/` means the directory holds that document's children; `name.pdf` beside `name.md` is that document's pages, "read in place and never written". — [FORMAT.md:25-69](../../FORMAT.md)
- A deck is a file: `german.md  a deck (type: deck in front-matter)`. Types are `note`, `source`, `deck`, `draft`, `extract`. — [FORMAT.md:33](../../FORMAT.md), [FORMAT.md:166](../../FORMAT.md)
- "A card is a paragraph. What makes it a card is its text" (cloze `{{…}}`, `?`/`??` line, ` :: `, ` ::: `); cards also live in list items; cards may sit anywhere in a note or source, not only in decks. — [FORMAT.md:413-427](../../FORMAT.md), [FORMAT.md:502-515](../../FORMAT.md), [FORMAT.md:188-196](../../FORMAT.md)
- Card schedule: `<!-- sr due=… st=… s=… d=… r=… l=… ivl=… last=… g=… -->` directly under the card; one bare line per card, plus `sr cN` per cloze group and `sr r` for a both-ways card's reverse; attributes `due st s d r l steps ivl last g pri sus link`. "Every attribute is optional. A card with no `sr` line at all is a new card, due now". — [FORMAT.md:579-622](../../FORMAT.md)
- Card identity: `^id` at the end of the card's last line; "The app assigns an id to a card the first time it writes a schedule for it and never changes it". — [FORMAT.md:568-577](../../FORMAT.md)
- Document-level schedules are front-matter fields: `read: due=… ivl=… reps=… pos=…` (incremental reading) and `write: …` (incremental writing); `pri` is one 0–100 scale. — [FORMAT.md:120-126](../../FORMAT.md), [FORMAT.md:171-174](../../FORMAT.md), [FORMAT.md:198-218](../../FORMAT.md), [FORMAT.md:260-262](../../FORMAT.md)
- A section that comes back is a `<!-- read made=… due=… ivl=… -->` line directly under a heading; it may carry `boxes=` (rectangles on PDF pages). — [FORMAT.md:713-761](../../FORMAT.md)
- Outside the Markdown, all under `.ilmi/` and "app-private state, never required": `order.json` (children order per directory), `reviews/<yyyy-mm>.jsonl` (review log), `same.json` (pairs said not the same fact); "Folder open/closed state, window layout, and other view state live in `.ilmi/`" (`state.json`). — [FORMAT.md:45-49](../../FORMAT.md), [FORMAT.md:73-81](../../FORMAT.md), [FORMAT.md:109-115](../../FORMAT.md)
- `.ilmi/state.json` fields: open folders, last tab, sidebar/inspector widths, day budget, clippings folder, folded rails, rail width, deck-browser chips and sort per deck, folded headings per document, `lastDay`. — [src/vault/vault.ts:34-58](../../src/vault/vault.ts)
- Nothing reads the review log to schedule a card: "A card's `sr` line holds its latest state; the log holds how it got there, for the numbers a lens shows. Nothing reads it to schedule a card, so a vault without it loses only history". — [FORMAT.md:82-88](../../FORMAT.md)
- Sync settings (remote, token, nudge server), tweaks and recent vaults are in the webview's `localStorage`, per device, outside the vault. — [src/app/sync.ts:60-89](../../src/app/sync.ts), [src/app/store.ts:62-101](../../src/app/store.ts)
- **Measured, sample `samples/double-major`:** 83 files, 2.0 MB on disk, 26 directories; 66 `.md` files totalling 654,042 bytes (mean 9.9 KB, largest `arabic/vocabulary.md` 31,997 bytes); 2 PDFs (248,413 and 85,642 bytes); `.ilmi/order.json` 1,992 bytes; 14 review-log files, 5,144 lines, 973,631 bytes. Types: 10 deck, 12 source, 8 extract, 2 draft, 34 with no `type` (notes). 758 card blocks, 774 card schedule lines, 2,812 blocks; 56 of 66 files hold at least one `sr` line; 17 section `read` lines; 4 documents name a `pdf:`; no `link=` in the sample. — measured with `find`/`wc`/`grep` and `bench.ts` on [samples/double-major](../../samples/double-major)
- The vocabulary deck is one file with 178 cards. — [PLAN.md:4264](../../PLAN.md) ("deck browser over the vocab deck (178)")

### Inferences
- The commenter's assumption "one markdown file per card" does not describe ilmi: the sample averages 11.5 cards per Markdown file, and decks are single files. A vault of 10,000 sample-shaped files would hold about 115,000 cards (measured for the synthetic `s10k`: 10,032 files, 115,216 cards).
- "Parsing 10,000 files to extract due dates" in ilmi means parsing whole documents (prose and cards together), since schedule lines are interleaved with content; there is no separate schedule store to read instead.

### Gaps
- No real user vault was measured; the sample is a designed demo collection, so real file-size and cards-per-file distributions are unknown.
- Ink (`ink-NN.png` + `.pkdrawing`) is planned (milestone 58) and not in the format yet; its sizes are unknown. — [PLAN.md:6178-6195](../../PLAN.md)

---

## 2. Load path: what happens at vault open and on each change? Batch or per-file IPC? Renderer or Rust? Any persistent cache?

### Takeaway
At open the renderer walks the tree (one `readDir` IPC per directory), then reads **every** Markdown file one at a time (one `stat` + one `readTextFile` IPC each, awaited sequentially) and parses each in TypeScript in the renderer; nothing is batched and there is **no persistent index or cache**: everything is re-derived on each launch into in-memory maps. A change to one file re-reads and re-parses only that file, but then rebuilds the whole queue from every parsed document.

### Cited Findings
- `openVault`: `allow_vault` (widen fs scope) → `Vault.open(tauriFs, path)` → `loadState` → `loadReviews` → `loadNotSame` → `publishTree` → subscribe → `vault.watch()` → `publishDocs(vault)` → plugins → `startSync`. — [src/app/vault.ts:322-376](../../src/app/vault.ts)
- `Vault.open` stats the root, runs `walk(fs, root)`, loads `.ilmi/order.json`. — [src/vault/vault.ts:273-281](../../src/vault/vault.ts)
- `walk` is recursive: one `fs.readDir` per directory, skipping dot-directories; it collects `.md` and `.pdf` names only (no stat, no read). — [src/vault/walk.ts:50-81](../../src/vault/walk.ts)
- `publishDocs` loops over **every** document path: `await vault.read(path)` (parse), `docItems(path, doc, now)`, `await vault.pagesOf(path)`, then one `publishQueue`. Sequential `await`s, no concurrency. — [src/app/vault.ts:186-204](../../src/app/vault.ts)
- `Vault.read`: cache hit returns; otherwise `fs.stat` then `fs.readText` then `parse(text)`; the cache entry keeps **both** the raw `text` and the parsed `doc`, plus diagnostics and the stamp (mtime, size). — [src/vault/vault.ts:331-342](../../src/vault/vault.ts), [src/vault/vault.ts:14-21](../../src/vault/vault.ts)
- The app's `Fs` is `@tauri-apps/plugin-fs`: `readDir`, `stat`, `readTextFile`, `readFile`, `writeTextFile`, `rename`, `watch` — each a separate call; `readTextFile` is one `invoke('plugin:fs|read_text_file')` returning bytes decoded by `TextDecoder` in the webview. There is no batch-read command. — [src/vault/tauri-fs.ts:12-40](../../src/vault/tauri-fs.ts), `node_modules/@tauri-apps/plugin-fs/dist-js/index.js:489-499`
- Parsing is TypeScript in the renderer (`src/format/parse.ts`, `export function parse`). The Rust side has no Markdown code: its modules are `anki.rs`, `epub.rs`, `plugin.rs`, `nudge.rs`, `sync.rs`, `lib.rs`; its commands are `allow_vault`, `read_dropped*`, `read_anki_package`, `read_epub`, `read_plugin_zip`, `platform`, `documents_vaults`, `dev_*`, `set_recent_vaults`, and eleven `sync_*`. — [src/format/parse.ts:82](../../src/format/parse.ts), [src-tauri/src/lib.rs:399](../../src-tauri/src/lib.rs)
- The in-memory state is: `Vault.cache: Map<path, Loaded>` (text + doc); `bodies: Map<path, Doc>` in `src/app/vault.ts` ("Every document's parsed form, by path … the queue is built from it"); `reviews: Review[]`; and the Zustand store's `tree`, `files`, `docs: Record<path, DocInfo>`, `queue: QueueItem[]`, `reviews`. — [src/vault/vault.ts:266](../../src/vault/vault.ts), [src/app/vault.ts:38-39](../../src/app/vault.ts), [src/app/vault.ts:64-65](../../src/app/vault.ts), [src/app/store.ts:240-290](../../src/app/store.ts)
- The Vault class describes itself: "The files are the store of record; this class is a cache with a conflict rule: never overwrite a file whose stamp moved since we read it." The cache is in memory only; `closeVault` clears `bodies`. — [src/vault/vault.ts:1-4](../../src/vault/vault.ts), [src/app/vault.ts:379-390](../../src/app/vault.ts)
- Nothing on disk holds derived data: the only files the app writes besides documents are `.ilmi/state.json`, `.ilmi/order.json`, `.ilmi/same.json`, `.ilmi/reviews/*.jsonl`. — [src/vault/vault.ts:214-218](../../src/vault/vault.ts), [src/vault/vault.ts:1322-1402](../../src/vault/vault.ts)
- Watcher: `fs.watch(root, …, { recursive: true, delayMs: 100 })`; `Vault.apply(paths)` stats each changed path; a cached `.md` whose stamp moved is re-read and re-parsed (`read(rel, true)`) and a `doc` event is emitted; a new/removed `.md`, a directory, or a PDF coming or going triggers a full re-`walk` and a `tree` event; paths under dot-directories are reported as `hidden`. — [src/vault/tauri-fs.ts:10](../../src/vault/tauri-fs.ts), [src/vault/tauri-fs.ts:38-39](../../src/vault/tauri-fs.ts), [src/vault/vault.ts:411-483](../../src/vault/vault.ts)
- On a `doc` event the app recomputes `docItems` for that one file, then `publishQueue` (the whole queue, §3). On a `tree` event it runs `publishTree` and `publishDocs` again over every document (cached ones are not re-read, but `docItems`, `pagesOf` and the queue are redone for all). — [src/app/vault.ts:264-286](../../src/app/vault.ts)
- Writes: `vault.update` clones the doc, mutates, `serialize`s, stats (conflict check), writes a temp file and renames it, stats again, re-parses the text it wrote, and emits `doc`. — [src/vault/vault.ts:355-407](../../src/vault/vault.ts)
- `pagesOf(path)` ends in `this.node(path)`, a depth-first search of the whole tree for that path; `publishDocs` calls it once per document. — [src/vault/vault.ts:291-318](../../src/vault/vault.ts), [src/app/vault.ts:195](../../src/app/vault.ts)
- The project's own earlier measurement: "collection open (walk, read, parse 74 files, the queue) 24 → 27 ms; queue build 2.2 → 2.3 ms … the collection's open is through node's fs, not Tauri's IPC". — [PLAN.md:4255-4260](../../PLAN.md), test at [src/app/__tests__/perf.test.ts](../../src/app/__tests__/perf.test.ts)

### Inferences
- IPC round trips at open, counted from the code: one `readDir` per non-hidden directory + two per document (`stat`, `readTextFile`) + one extra `stat` for each document naming a `pdf:` + a handful for `.ilmi` (state, order, same: stat + read each; reviews: stat, readDir, one read per month file). For the sample that is roughly 24 + 132 + 4 + ~22 ≈ 180 round trips; for 10,000 files roughly 20,000+; for 50,000 files 100,000+. All are awaited one after another.
- `pagesOf` → `node()` makes the open loop quadratic in the number of documents (confirmed by measurement in §8: 6.5 s of a 9.1 s open at 50,000 one-card files). It is an in-memory lookup that a `Map` would make constant; it is unrelated to the storage format.
- Because the cache keeps `text` and `doc` for every file, renderer memory is a multiple of the vault's Markdown size (measured in §8: about 3.7× for sample-shaped content under V8).

### Gaps
- Per-call Tauri IPC cost (macOS and iOS) was not measured; no figure for it exists in the repository (`grep -i ipc` over PLAN.md, BUILD-LOG.md, docs finds only the note above). The real open time is the Node figure plus (round trips × per-call cost).
- Whether the fs watcher delivers events on iOS is unchecked by the project itself: "A pull landing on the iPad (the watcher under iOS): the iPad only pushed." — [PLAN.md:6066-6068](../../PLAN.md)

---

## 3. Queue: how is the day's queue derived, and is it recomputed from all documents on every change?

### Takeaway
The queue is a pure in-memory query (`src/schedule/queue.ts` + `options.ts`, `exams.ts`, `links.ts`) over every parsed document; nothing about it is stored. It is rebuilt **from all documents on every change**: every `doc` event, every grade (twice per grade), every review-log reload, and on demand. This full rebuild, not file parsing, is the cost that grows with every interaction: measured 5 ms at the sample's 758 cards, 75 ms at 11,370 cards, ~0.95 s at 115,216 cards, ~5.7 s at 574,564 cards.

### Cited Findings
- "The queue: a query over a vault for what is due … Nothing here is stored; `gradeItem` is the one mutation, and it rewrites one schedule line." — [src/schedule/queue.ts:1-9](../../src/schedule/queue.ts)
- `docItems(path, doc, now)` walks one document's blocks and emits a `read` item (front-matter `read`), a `write` item, `section` items (heading `read` lines) and one `card` item per cloze group / per direction. — [src/schedule/queue.ts:251-298](../../src/schedule/queue.ts)
- `buildQueue(now)`: `docItems` for **every** entry of `bodies`; then `examQueue`; then `buryLinked(out, cardsById(bodies), now)` (a second pass over every block of every document to map ids); then `meterQueue` (sorts, applies new-per-day / reviews-per-day, may sort again) with `spentToday(reviews, …)` (a pass over the whole review log). — [src/app/vault.ts:86-103](../../src/app/vault.ts), [src/schedule/links.ts:70-80](../../src/schedule/links.ts), [src/schedule/options.ts:138-183](../../src/schedule/options.ts), [src/schedule/options.ts:193-208](../../src/schedule/options.ts)
- Order of the day: a seeded Beta draw per due item (`sampleKey` of path/id/day and `pri`), then stored due; "Nothing of this is written." — [src/schedule/queue.ts:300-326](../../src/schedule/queue.ts), [FORMAT.md:289-299](../../FORMAT.md)
- Callers of `publishQueue` (= `buildQueue` + `withDue`): `refreshQueue`, `recordReview`, `reloadReviews`, `publishDocs`, the `doc` event, the `gone` event, an Anki import. — [src/app/vault.ts:125-135](../../src/app/vault.ts), [src/app/vault.ts:164-184](../../src/app/vault.ts), [src/app/vault.ts:202](../../src/app/vault.ts), [src/app/vault.ts:272-293](../../src/app/vault.ts)
- One grade (`gradeCard`): `vault.update` (write + `doc` event → `publishQueue`), then (for a grade of a card's bare line) `cardsById(allDocs())` over every document to find a linked twin, then `recordReview` (→ `publishQueue` again, and an append to the log). The log append then comes back through the watcher as a `hidden` event and, 500 ms later, re-reads the whole log and, if its length changed, publishes the queue again. — [src/app/grading.ts:40-72](../../src/app/grading.ts), [src/app/vault.ts:164-184](../../src/app/vault.ts), [src/app/vault.ts:311-312](../../src/app/vault.ts)
- **Measured, `publishQueue` (queue rebuilt from all parsed documents, min/median of 5):** sample (758 cards → 1,088 items, 439 due) 5.1/5.8 ms; `s1k` (11,370 cards → 16,320 items) 75/77 ms; `s10k` (115,216 cards → 165,376 items) 952/989 ms; `s50k` (574,564 cards → 824,704 items) 5,704/6,601 ms; one-card files: `p10k` (10,000 cards) 40/43 ms, `p50k` (50,000 cards) 217/222 ms. — `bench.ts`, `results/*.json`
- **Measured, parts of it:** `docItems` over all documents 2.0 / 28 / 285 / 1,463 ms (sample / s1k / s10k / s50k); `sortQueue` alone 1.25 / 25 / 336 / 2,044 ms; `cardsById` 0.07 / 0.66 / 14 / 78 ms. — `bench.ts`
- **Measured, one file changed on disk** (stat + read + parse of one mid-list file): 0.16–0.22 ms at every size; a structural change (re-`walk` of the tree): 0.7 / 9.7 / 103 / 817 ms. — `bench.ts`

### Inferences
- Complexity per change is O(total blocks + queue items · log(queue items) + review-log length), independent of which file changed; the cost of one grade is at least two such rebuilds plus one `cardsById` pass. At the sample's size that is about 10 ms; at ~11,000 cards about 150 ms; at ~115,000 cards about 2 s per grade (V8 figures).
- This cost is the same whether the bytes came from Markdown or from a database: it is the in-memory derivation that is not incremental. An incremental update (replace one document's items, re-meter) would remove it without changing storage; a stored `due` index would also remove it. The code today does neither.
- Per card, queue cost is similar across shapes: ~6.7 µs/card (sample), ~6.6 (s1k), ~8.3 (s10k), ~9.9 (s50k), ~4.0–4.4 (p-series, single-item cards).

### Gaps
- Not measured: the React re-render that follows each store update (rows, counts), which is additional to the script cost above. The project's own note gives a jsdom figure for the deck browser only. — [PLAN.md:4263-4268](../../PLAN.md)

---

## 4. Relations and cross-entity queries (the "joins" claim): what are ilmi's equivalents of Note Type → Note → Cards → Revlog, where is each held, and how are cross-entity queries answered?

### Takeaway
ilmi's relations are held **in the files by position, path and id**, and every cross-entity query today is an **in-memory scan over parsed documents** (plus the in-memory review log), mostly linear in total blocks; there is no join engine and no index, only a few per-call `Map`s. "Saved queries" are five fixed filters over the in-memory queue, not stored user queries.

### Cited Findings
Relations and where each lives:
- **Folder / document / children** (book → chapters, notebook → tabs, source → extracts): by path convention — `name.md` beside `name/`; a chapter carries `pdf: ../name.pdf` and `pages: n-m`; held in the directory tree, read into `TreeNode.children` by `walk`. — [FORMAT.md:55-66](../../FORMAT.md), [FORMAT.md:235-252](../../FORMAT.md), [src/vault/walk.ts:14-26](../../src/vault/walk.ts)
- **Document → blocks → cards**: file order; in memory `Doc.blocks[]` with `kind: 'card'`. — [FORMAT.md:379-396](../../FORMAT.md), [src/app/vault.ts:49](../../src/app/vault.ts)
- **Section → its cards and prose**: positional — "the heading and every block under it up to the next heading of the same or a higher level"; computed by scanning blocks (`sectionState`, the `open` heading stack in `docItems`). — [FORMAT.md:720-726](../../FORMAT.md), [src/schedule/section.ts:36-46](../../src/schedule/section.ts), [src/schedule/queue.ts:282-296](../../src/schedule/queue.ts)
- **Card → schedule line(s)**: the comment lines directly under the card; in memory `card.sched`, `card.blanks[n]`, `card.reverse`. — [FORMAT.md:555-566](../../FORMAT.md), [src/schedule/queue.ts:153-161](../../src/schedule/queue.ts)
- **Card → review-log entries**: a log line carries `doc` (vault-relative path when graded) and `card` (the `^id`); "A card moved to another document is found again by its id when its old document is gone." Held in `.ilmi/reviews/*.jsonl`, loaded whole into `reviews: Review[]`. — [FORMAT.md:82-108](../../FORMAT.md), [src/format/reviews.ts:14-41](../../src/format/reviews.ts)
- **Extract ↔ parent**: `<!-- extract NAME -->` under the parent's paragraph + the child file in the parent's children directory. — [FORMAT.md:694-704](../../FORMAT.md)
- **"Both ways" twins**: one card, two schedule lines (bare = front→back, `sr r` = back→front), siblings buried by the queue, nothing written. — [FORMAT.md:624-644](../../FORMAT.md), [src/schedule/queue.ts:187-209](../../src/schedule/queue.ts)
- **Linked cards across files**: `link=<id>` on each card's bare `sr` line; resolved through `cardsById(docs)`, a `Map` rebuilt by scanning every card of every document each time. — [FORMAT.md:646-681](../../FORMAT.md), [src/schedule/links.ts:65-80](../../src/schedule/links.ts)
- **Pairs said not the same**: `.ilmi/same.json`. — [FORMAT.md:109-115](../../FORMAT.md)
- **Options and exams inherited down the tree** (`new-per-day`, `retention`, `exam`, …): set in an ancestor document's front matter; resolved by walking the path's owners with `metaOf` (a `bodies` lookup), cached per queue build. — [FORMAT.md:329-372](../../FORMAT.md), [src/schedule/options.ts:70-85](../../src/schedule/options.ts), [src/app/vault.ts:67-84](../../src/app/vault.ts), [src/app/vault.ts:94-97](../../src/app/vault.ts)
- There is no "note type" entity: a card's form (cloze / q&a / both ways) is detected from its text. — [FORMAT.md:413-427](../../FORMAT.md)

How cross-entity queries are answered:
- **The queue**: full scan of `bodies` (§3). — [src/app/vault.ts:91-103](../../src/app/vault.ts)
- **"Saved queries"**: the palette lists `today`, `upcoming`, `reading`, `writing`, `cards` as entries with `sub: 'saved query'`; each is `inScope(item, scope, now)` over the in-memory queue. They are fixed in code, not stored. — [src/app/names.ts:15](../../src/app/names.ts), [src/app/chrome.ts:191-193](../../src/app/chrome.ts), [src/schedule/queue.ts:346-356](../../src/schedule/queue.ts)
- **"All cards" / a deck's cards** (deck browser over a document, folder, or `''` the root): `docsUnder(tree, home, …)` → `docsOf(paths)` → `deckRows(bodies, now)` in a `useMemo` keyed on the store's `docs`, then `filterRows` + `sortRows`. — [src/app/DeckBrowser.tsx:357-362](../../src/app/DeckBrowser.tsx), [src/app/deck.ts:75-115](../../src/app/deck.ts)
- **The numbers lens** (reviews a day, true retention, intervals, leeches): `linesOf(docsOf(docsUnder(…)))` + `reviewsUnder(log, lines, files)` (two `Set`s, one filter over the whole log) + `numbersOf(…)`, in a `useMemo`. — [src/app/NumbersLens.tsx:89-95](../../src/app/NumbersLens.tsx), [src/app/numbers.ts:62-67](../../src/app/numbers.ts)
- **The palette's index** (documents, folders, every card): `buildIndex(tree, docs, cardRefs(), …)`, where `cardRefs()` walks the store's queue; rebuilt when `tree` or `docs` changes. — [src/app/Palette.tsx:87-98](../../src/app/Palette.tsx), [src/app/Palette.tsx:127](../../src/app/Palette.tsx)
- **Per-document counts in the tree** (`cards`, `due`, `sections`): `infoOf` + `withDue` over the queue. — [src/app/vault.ts:41-62](../../src/app/vault.ts), [src/app/vault.ts:105-123](../../src/app/vault.ts)
- **"The same fact twice" finder**: `sameCards` + `findSame` over cards' feature vectors. — [src/app/same.ts:212](../../src/app/same.ts), [src/app/same.ts:307](../../src/app/same.ts), [src/app/DeckBrowser.tsx:285-289](../../src/app/DeckBrowser.tsx)
- **Measured costs of the main ones** (V8, min of 3–5 runs; card counts: sample 758, s1k 11,370, s10k 115,216, s50k 574,564):

| query (code) | sample (66 files) | s1k (990) | s10k (10,032) | s50k (50,028) | p50k (50,000 files, 50,000 cards) |
|---|---|---|---|---|---|
| queue rebuild (`publishQueue`) | 5.1 ms | 75 ms | 952 ms | 5,704 ms | 217 ms |
| all cards as deck rows (`deckRows`, root lens) | 4.2 ms | 62 ms | 621 ms | 3,353 ms | 155 ms |
| numbers over everything (`linesOf` + `reviewsUnder` + `numbersOf`, 5,144-line log) | 5.7 ms | 26 ms | 302 ms | 1,676 ms | 78 ms |
| palette index (`buildIndex`) | 6.9 ms (828 entries) | 89 ms (12,365) | 914 ms (125,253) | 6,246 ms (624,597) | 345 ms (100,105) |
| id map for links (`cardsById`) | 0.07 ms | 0.66 ms | 14 ms | 78 ms | 3.7 ms |

  — `bench.ts`, `results/*.json`
- **Measured, same-fact finder:** 135 ms for the sample's 758 cards (43 pairs); 13.3 s for `s1k`'s 11,370 cards (89,040 pairs). — `bench.ts`

### Inferences
- Complexity: the queue, deck rows, numbers and palette index are O(total blocks) (plus a sort); they are recomputed whole when any document under the lens changes, because their `useMemo` keys are the store's `docs`/`tree` objects, which are replaced on every `doc` event.
- These are the operations a relational store would answer with indexed queries (`WHERE due <= ?`, `JOIN revlog`). At the sample's size each is single-digit milliseconds; at ~11,000 cards tens of milliseconds; they reach about a second at ~115,000 cards.
- The 13.3 s same-fact figure at `s1k` is inflated by the synthetic data: every card has 14 exact copies, so candidate pairs explode. It shows the finder is superlinear, not what a real 11,000-card vault would cost.

### Gaps
- No measurement on a real collection with tens of thousands of distinct cards (the user's SuperMemo/Anki collection is noted as never imported for a check: "14: the user's real collection"). — [PLAN.md:6266-6267](../../PLAN.md)

---

## 5. Search: how do the palette, find, and deck search work? Is there vault-wide full-text search? Arabic handling? What does a linear scan cost?

### Takeaway
There are three searches, all linear scans over in-memory data, and **no vault-wide full-text search over prose**: the palette (fuzzy subsequence over document titles, folder names and card names), the deck browser (folded substring over card faces under a lens), and find-in-page (folded substring in the open document). The deck search and find fold case, combining marks and the Arabic tatweel, so unvoweled Arabic finds voweled text; the palette's fuzzy match only lower-cases. A plain substring scan over all raw text measured 5 ms (absent term) to 40 ms (common term) at 100 MB / 10,032 files; SQLite FTS5 answered the same in 0.01–0.66 ms but its default tokenizer breaks voweled Arabic.

### Cited Findings
- Every search call site in `src/` (outside tests): `search(index, q)` in the palette; `fold(q)` in `filterRows` and the similar-pairs list; `findIn` in `src/reader/find.ts`. — [src/app/Palette.tsx:144](../../src/app/Palette.tsx), [src/app/deck.ts:181-187](../../src/app/deck.ts), [src/app/DeckBrowser.tsx:287](../../src/app/DeckBrowser.tsx), [src/reader/find.ts:39-55](../../src/reader/find.ts)
- Palette: the index is saved queries, folders, documents (by title), every card (by its name, formulas as plain text), commands, other vaults; `search` scores each entry with `fuzzy(q, find ?? title + ' ' + sub)`, sorts, keeps forty. `fuzzy` lower-cases both sides and matches the query's characters in order. Document bodies are not in the index. — [src/app/chrome.ts:190-228](../../src/app/chrome.ts), [src/app/chrome.ts:123-132](../../src/app/chrome.ts)
- Deck search: each row carries `hay: fold(faceText(b.text))` (both faces; a cloze's answers in place), computed when rows are built; `filterRows` requires every whitespace-separated word of the folded query to be a substring of `hay`. — [src/app/deck.ts:46-47](../../src/app/deck.ts), [src/app/deck.ts:61-67](../../src/app/deck.ts), [src/app/deck.ts:93](../../src/app/deck.ts), [src/app/deck.ts:180-187](../../src/app/deck.ts)
- The fold: `s.normalize('NFKD').replace(/[\p{M}ـ]/gu, '').toLowerCase()` — "Case and accents folded, so `Lucke` finds `Lücke` and Arabic without its vowel marks finds the voweled word." — [src/app/deck.ts:56-59](../../src/app/deck.ts)
- Find in page uses the same fold a character at a time, keeping a map back to offsets so a match takes the marks after its last letter. — [src/reader/find.ts:1-55](../../src/reader/find.ts)
- **Measured, substring scan over every document's raw text (`text.includes(q)`, min of 5):**

| scan | sample (0.65 MB) | s1k (9.8 MB) | s10k (99.9 MB) | s50k (498.5 MB) | p50k (13.1 MB) |
|---|---|---|---|---|---|
| raw `includes`, term absent (full scan) | 0.03 ms | 0.49 ms | 4.95 ms | 32 ms | 0.69 ms |
| raw `includes`, common word "energy" | 0.23 ms | 4.1 ms | 39 ms | 210 ms | 5.7 ms |
| raw `includes`, "Boltzmann" | 0.04 ms | 0.57 ms | 5.9 ms | 40 ms | 0.68 ms |
| `/boltzmann/i` regex | 0.14 ms | 1.1 ms | 11.8 ms | 52 ms | 1.3 ms |
| fold every file on every search, then `includes` | 3.1 ms | 46 ms | 466 ms | 2,349 ms | 13.9 ms |
| fold all text once (kept in memory) | 3.0 ms | 46 ms | 483 ms | 2,526 ms | 13.4 ms |
| folded `includes` over kept folded text, absent / "boltzmann" | 0.04 / 0.15 ms | 0.57 / 2.3 ms | 6.0 / 23.6 ms | 30 / 120 ms | 0.8 / 0.9 ms |
| deck search: build rows for all cards (`deckRows`) | 4.2 ms | 62 ms | 621 ms | 3,353 ms | 155 ms |
| deck search: `filterRows` "energy" / "كرم" over built rows | 0.07 / 0.03 ms | 0.88 / 0.27 ms | 6.6 / 2.6 ms | 46 / 23 ms | 3.2 / 0.5 ms |
| palette fuzzy over its index ("boltz") | 0.4 ms | 3.8 ms | 44 ms | 230 ms | 24 ms |

  — `bench.ts`, `results/*.json`
- **Measured, Arabic:** in the sample, raw `includes('كرم')` (unvoweled) hits 0 files and raw `includes('كَرَم')` hits 2; with the app's fold both queries hit 5 files. — `bench.ts`
- **Measured, SQLite 3.53.1 FTS5 on the same text (`fts.py`, in-memory database, min of 5):** at `s10k` (99.9 MB) `MATCH` with `unicode61` took 0.01–0.05 ms per query, with `trigram` 0.01–0.66 ms; a plain-table `LIKE '%energy%'` took 53 ms and `LIKE '%zzqxjv%'` 33 ms. Index build 1.1 s (`unicode61`) / 6.6 s (`trigram`); index size 158 MB (`unicode61`) / 371 MB (`trigram`) for 99.9 MB of Markdown. At `s1k` (9.8 MB): build 95 ms / 540 ms, size 16.8 MB / 38.9 MB, `LIKE` 3–5 ms. At the sample: build 9 ms / 26 ms, size 1.1 MB / 3.2 MB, `LIKE` 0.2–0.35 ms. — `fts.py`
- **Measured, FTS5 tokenizers and Arabic:** `unicode61 remove_diacritics 2` tokenizes `كَرَم` as three one-letter tokens `ك`, `ر`, `م`; `MATCH 'كرم'` finds 0 rows, `MATCH 'lucke'` finds `Lücke`. With the text pre-folded by the app's rule, `unicode61` word match finds `كرم` in 2 of the sample's files where the app's substring search finds 5; the `trigram` tokenizer over folded text finds the same 5. — `fts.py`

### Inferences
- The linear-scan baseline an index would be compared with: at the sample's size every search is well under a millisecond; at ~10 MB (990 files, 11,370 cards) 0.5–5 ms; at ~100 MB 5–40 ms raw, or 6–24 ms over pre-folded text. FTS5 is two to three orders of magnitude faster per query at 100 MB, in agreement with the thread's claim about ratio, but the scan it replaces is tens of milliseconds at that size on this machine.
- The JavaScript scans above need every document's text in renderer memory (the app has it today in `Vault.cache`). A folded copy for search would double that text memory; the deck browser's `hay` strings are such a copy for cards only.
- Any index must reproduce the fold (NFKD, drop `\p{M}` and U+0640, lower-case) **before** tokenizing, and must keep substring semantics for Arabic: FTS5's `unicode61` treats harakat as separators and matches whole tokens, so prefixed/suffixed Arabic words (clitics) that the current search finds would be missed; `trigram` keeps substring behaviour for queries of three characters or more at 2.4× the index size.
- Vault-wide prose search would be a new feature either way; the current code offers nothing to compare user-visible behaviour against except the deck search and find.

### Gaps
- No timing under JavaScriptCore/WKWebView, and none with text read lazily from disk (a search that does not keep all text in memory would pay file reads: ~0.05–0.11 ms per file through Node, plus IPC in the app).
- FTS5 was timed through Python with an in-memory database; on-disk and on-device (iOS) query and build times were not measured.

---

## 6. The review log: where is it, how big per review, is it read at open, and how does it behave at 100k+ reviews?

### Takeaway
The log is append-only JSON Lines under `.ilmi/reviews/<yyyy-mm>.jsonl`, about 190 bytes per review in the sample; **all of it is read and parsed at open**, kept as one in-memory array, scanned in full on every queue build, and re-read in full (debounced 500 ms) whenever any log file changes — including after the app's own append. At 100,000 reviews that is ~17 MB on disk, ~110 ms to load, ~26 MB of heap and ~18 ms added to every queue build; at 1,000,000 it is 172 MB, 1.1 s, ~255 MB and ~230 ms.

### Cited Findings
- Format, keys, append-only and merge-by-union design: "lines are only appended, never rewritten, so two devices add theirs to the same month; every `.jsonl` in the directory is read (a sync tool's conflict copy too); a line seen twice … counts once; a line that does not read as one … is skipped." — [FORMAT.md:82-108](../../FORMAT.md), [src/format/reviews.ts:1-8](../../src/format/reviews.ts)
- Write: `appendReviews` appends one line per review to its month's file (`writeTextFile(…, { append: true, create: true })`). — [src/vault/vault.ts:1329-1347](../../src/vault/vault.ts), [src/vault/tauri-fs.ts:28](../../src/vault/tauri-fs.ts)
- Read: `loadReviews` reads every `.jsonl` in the directory, `parseReviews` (`JSON.parse` + validation per line), `mergeReviews` (dedupe by `at card key g` in a `Set`, then sort by `at`). Called in `openVault` before documents are read. — [src/vault/vault.ts:1349-1363](../../src/vault/vault.ts), [src/format/reviews.ts:89-115](../../src/format/reviews.ts), [src/app/vault.ts:356](../../src/app/vault.ts)
- On a grade: `reviews = [...reviews, r]` (whole-array copy), `publishQueue`, then the append. — [src/app/vault.ts:164-170](../../src/app/vault.ts)
- Reload: any watcher event under `.ilmi/reviews/` schedules `reloadReviews` (500 ms debounce), which calls `loadReviews()` again over every file and republishes the queue if the length changed; "Our own appends come back the same." — [src/app/vault.ts:172-184](../../src/app/vault.ts), [src/app/vault.ts:311-312](../../src/app/vault.ts)
- Every queue build calls `spentToday(reviews, …)`, which iterates the entire log computing `dayOf(whenToDate(r.at))` for each line to find today's. — [src/app/vault.ts:102](../../src/app/vault.ts), [src/schedule/options.ts:193-208](../../src/schedule/options.ts)
- Uses: the day's allowances (`spentToday`) and the numbers lens (`reviewsUnder`, `numbersOf`). — [src/app/NumbersLens.tsx:87-95](../../src/app/NumbersLens.tsx)
- Sync: a log file changed on both sides is unioned line by line (`unionLines`). — [src/sync/merge.ts:302-310](../../src/sync/merge.ts), [src/sync/merge.ts:332](../../src/sync/merge.ts)
- **Measured:**

| log | lines | bytes on disk | bytes/line | `loadReviews` | heap after load (before → after) | full reload | `spentToday` scan (per queue build) | grade's array copy | `numbersOf` over the whole log |
|---|---|---|---|---|---|---|---|---|---|
| sample | 5,144 | 973,631 | 189.3 | 4.5–7 ms | 8.6 → 10.2 MB | 4.4 ms | 0.65 ms | 0.01 ms | 3.7 ms |
| r100k | 100,000 | 17.2 MB | 172.3 | 110 ms | 8.4 → 34.5 MB | 82 ms | 17.7 ms | 0.16 ms | 89 ms |
| r500k | 500,000 | 86.2 MB | 172.4 | 463 ms | 8.4 → 135.7 MB | 440 ms | 88.8 ms | 0.77 ms | 432 ms |
| r1m | 1,000,000 | 172.4 MB | 172.4 | 1,133 ms | 8.4 → 263.3 MB | 1,045 ms | 229 ms | 1.9 ms | 1,024 ms |

  — `revbench.ts` (Node fs; 60 month files for the synthetic logs)

### Inferences
- For scale: 100 reviews a day for ten years is ~365,000 lines (~65 MB, ~0.35 s to load, ~100 MB heap under V8, ~65 ms added to each queue build, i.e. ~130 ms per grade from this scan alone). The sample's own log is 5,144 lines over 14 months.
- The log's growth cost is in how the code uses it (load all, scan all per queue build, reload all per change), not in the file format: only today's lines are needed for `spentToday`, and month files already partition by time, but the code does not use that.
- As git content, each month file is rewritten as a new blob on every commit that includes new reviews (a blob per commit of up to that month's size, before packing); the union merge needs both full texts in the renderer.

### Gaps
- Memory under WKWebView for the parsed log, and the IPC cost of reading 60+ month files at open, were not measured.
- Pack size growth of the repository from frequently-committed log files was not measured.

---

## 7. Sync by git: what the merge rules are, what needs a common ancestor, how binaries are treated, and what large PDFs / ink would break

### Takeaway
Sync is libgit2 (`git2` 0.20, vendored, HTTPS + token only) driven by the renderer: commit-all after writes, fetch, a per-path three-way comparison in Rust, and a format-aware text merge in TypeScript for files changed on both sides (later-instant wins for schedule lines, both versions kept for prose, union for the log). Binary files are never merged (ours is kept) and are carried as ordinary git blobs: every PDF is added, cloned with full history, read whole into memory on a pull, and read whole (twice) into the webview to display. There is no LFS, no shallow or partial clone, and the documented host (GitHub) refuses files over 100 MB — which the plan itself records as the reason the host decision was reopened.

### Cited Findings
Design and policy:
- "The vault is a git repository. That is the sync, on every platform: ilmi commits what it writes, pulls on open, on focus, on a timer, and on a nudge, and pushes after a session." "Merges are the format's." "PDFs are never written, so never in conflict." "Not live: a few seconds with the nudge, a couple of minutes without; the queue is derived from the files each device has, so the same card can show due on both until the next pull". — [PLAN.md:5721-5736](../../PLAN.md)
- Cadence constants: commit after 5 s quiet and at most one a minute; pull every 2 min, on open, and on focus after 15 s; push 1 min after a commit and 5 s after a session ends; on close commit + push. All git calls go through one serial chain. — [src/app/sync.ts:52-58](../../src/app/sync.ts), [src/app/sync.ts:131-136](../../src/app/sync.ts), [src/app/sync.ts:175-203](../../src/app/sync.ts), [src/app/sync.ts:304-314](../../src/app/sync.ts), [src/app/sync.ts:357-398](../../src/app/sync.ts)
- Every vault event outside `.git/` marks the vault touched, which also schedules a `sync_status` call 300 ms later. — [src/app/sync.ts:159-162](../../src/app/sync.ts), [src/app/sync.ts:175-177](../../src/app/sync.ts), [src/app/sync.ts:350-354](../../src/app/sync.ts)
- The nudge: after a push the app POSTs "changed" to an ntfy topic hashed from the remote; open copies subscribe by SSE and pull. — [PLAN.md:5919-5976](../../PLAN.md), [src/app/sync.ts:261-263](../../src/app/sync.ts)

Rust plumbing (`src-tauri/src/sync.rs`):
- `git2 = { version = "0.20", default-features = false, features = ["https", "vendored-libgit2"] }`; "HTTPS with a token, no SSH, no git binary". — [src-tauri/Cargo.toml:33-34](../../src-tauri/Cargo.toml), [src-tauri/src/sync.rs:1-9](../../src-tauri/src/sync.rs)
- `.gitignore` written by `init`: `.ilmi/state.json`, `*.ilmi-tmp`, `.DS_Store`; everything else is tracked (review log, order, `same.json`, PDFs, images). — [src-tauri/src/sync.rs:22](../../src-tauri/src/sync.rs), [docs/guide.md:327-331](../../docs/guide.md)
- Text vs binary is decided by file extension: `md json jsonl txt js css html csv tex yaml yml gitignore` are text; everything else (pdf, png, a future `.pkdrawing`) is binary. — [src-tauri/src/sync.rs:25](../../src-tauri/src/sync.rs), [src-tauri/src/sync.rs:80-83](../../src-tauri/src/sync.rs)
- `status`: `repo.statuses` with untracked files, recursing untracked directories. `changes`: the same status walk, plus HEAD's text and the working file's text for each changed text path. — [src-tauri/src/sync.rs:182-201](../../src-tauri/src/sync.rs), [src-tauri/src/sync.rs:260-285](../../src-tauri/src/sync.rs)
- `commit_all`: `index.add_all(["*"])`, `index.update_all(["*"])`, write tree, commit (skipped when the tree equals HEAD's). — [src-tauri/src/sync.rs:287-316](../../src-tauri/src/sync.rs)
- `clone`: `RepoBuilder::clone(url, dest)` with fetch options carrying only the credential callback; destination must be empty. `fetch`: refspec `+refs/heads/*:refs/remotes/origin/*`. No depth, no filter. — [src-tauri/src/sync.rs:244-256](../../src-tauri/src/sync.rs), [src-tauri/src/sync.rs:324-331](../../src-tauri/src/sync.rs)
- `merge`: finds `merge_base(ours, theirs)`; diffs base→theirs and base→ours by path; a path changed only on their side is written to the working tree from the blob (`take_from`: `repo.find_blob(oid)` then `write_file(root, path, blob.content())`, temp file + rename); a path changed on both sides is returned as `Conflict { base, ours, theirs, binary }` with texts for text paths and `None` for binary; nothing past the base → fast-forward (`reset --mixed`); no conflicts → merge commit with two parents; unrelated histories → empty base. — [src-tauri/src/sync.rs:348-437](../../src-tauri/src/sync.rs)
- `resolve` writes the renderer's merged texts and commits with both parents. `push`: `refs/heads/<branch>` both sides; a refused update is returned as the error. — [src-tauri/src/sync.rs:446-483](../../src-tauri/src/sync.rs)
- Nine cargo tests over local bare repositories; one asserts a PDF changed on both sides is handed back `binary` with no texts. — [src-tauri/src/sync.rs:539-760](../../src-tauri/src/sync.rs), [src-tauri/src/sync.rs:659](../../src-tauri/src/sync.rs)

The format-aware merge (`src/sync/merge.ts`):
- Unit of merge is a block: the front matter as one block, then each run of non-blank lines with its trailing blank lines; `diff3` over block keys by LCS (common head and tail trimmed, then a full table over the middle). — [src/sync/merge.ts:43-127](../../src/sync/merge.ts)
- A hunk changed on one side only takes that side. Changed on both: if the two sides have the same number of blocks and differ only in schedule lines of the same kind (`sr`, `sr cN`, `sr r`, a section's `read`, front-matter `read:`/`write:`), each pair takes the later by `last`, then `due`, ours on a tie (`later`). — [src/sync/merge.ts:137-217](../../src/sync/merge.ts), [src/sync/merge.ts:258-265](../../src/sync/merge.ts)
- Front matter changed on both: line by line; a schedule line takes the later, any other both-changed line takes the pulled side. — [src/sync/merge.ts:266-300](../../src/sync/merge.ts)
- A real prose conflict keeps ours then theirs as two blocks and records `{ path, heading }` for the notice; no conflict markers are written. — [src/sync/merge.ts:271-273](../../src/sync/merge.ts)
- `mergeFile`: binary → keep ours; deleted on one side and edited on the other → the edit stays; review-log `.jsonl` → union of lines; `.ilmi/same.json` → union of pairs; `.md` → `mergeMarkdown`; `.ilmi/order.json` and any other text → the pulled side wins. — [src/sync/merge.ts:324-340](../../src/sync/merge.ts)
- **Common ancestor:** the three-way rules use the base when there is one; "no base (histories that never met): what the two share stands in for it" (the LCS of the two sides' blocks). The "one side left it as the base" shortcut inside `byBlocks` needs a base with the same block count; otherwise only the schedule-pair rule applies. The later-instant rule itself compares the two lines' own `last`/`due` and needs no ancestor. — [src/sync/merge.ts:251-252](../../src/sync/merge.ts), [src/sync/merge.ts:185-202](../../src/sync/merge.ts), [src/sync/merge.ts:163-176](../../src/sync/merge.ts)
- Decided limits: no rename detection ("A rename against an edit is a modify/delete pair and keeps the edit under the old name"); "A card graded on one side and reworded on the other is two blocks under the notice"; "The HTTPS-with-token path is written but no check exercises it: every test and the smoke use a local bare repository." — [PLAN.md:5863-5873](../../PLAN.md)
- "Not in this milestone: SSH, LFS, a git host's own sign-in, merging binary files". The guide: "SSH remotes and large files are not supported." — [PLAN.md:5910-5911](../../PLAN.md), [docs/guide.md:331](../../docs/guide.md)

Large files, PDFs, ink:
- "To watch: GitHub refuses a file over 100 MB and there is no LFS (53), so a very large PDF would have to stay out of the vault." Then: "Reopened the same day … 'This doesnt seem like the righ tsolution then. i'd love to have something that i can replace goodnotes with for example'. So the host and the order above do not stand as written … the big bytes (PDFs, ink) out of git's own storage, most likely Git LFS on the same host spoken by the app, fetched when a book is opened; ink on the book's pages themselves, which 58 leaves out … Nothing here is decided until they say." — [PLAN.md:5771-5773](../../PLAN.md), [PLAN.md:5782-5790](../../PLAN.md)
- Ink as planned: a PencilKit canvas (Swift plugin) returning "a PNG at 2× and the strokes (`PKDrawing` data)", stored as `name/ink-NN.png` and `name/ink-NN.pkdrawing` beside the note; "53 carries both files"; "Not in this milestone: … ink on the PDF page itself". — [PLAN.md:6178-6195](../../PLAN.md)
- The format excludes writing into PDFs: "Anything written into a PDF: highlights are the extracts' stored text, found again on the page; annotations stay in the Markdown." — [FORMAT.md:919-920](../../FORMAT.md)
- Displaying a PDF: `vault.fs.readBytes(abs)` (plugin-fs `readFile`: the whole file over IPC into a `Uint8Array`), then `pdfjs.getDocument({ data: bytes.slice() })` — "The bytes are copied first: pdf.js hands them to its worker and they are gone." A PDF no one holds stays loaded 20 s. — [src/app/bookPdf.ts:20-33](../../src/app/bookPdf.ts), [src/app/pdfjs.ts:32-35](../../src/app/pdfjs.ts), [src/vault/tauri-fs.ts:29](../../src/vault/tauri-fs.ts)
- Images are read whole and shown through a Blob URL. — [src/app/images.ts:53-60](../../src/app/images.ts)
- A book's chapters share one PDF ("The file is never cut or copied; every chapter reads the one PDF"). — [FORMAT.md:235-246](../../FORMAT.md)
- On iOS the vault is a clone inside the app's Documents folder. — [PLAN.md:6128-6132](../../PLAN.md)
- Unchecked by the project: a real device, HTTPS with a token (any platform), a pull landing on the iPad, the Files app. — [PLAN.md:6057-6068](../../PLAN.md), [PLAN.md:6080-6083](../../PLAN.md)

### Inferences
- What large PDFs and ink would hit in the code as written:
  1. **Host limit and no LFS**: any file over 100 MB cannot be pushed to GitHub (the plan's own statement); nothing in `sync.rs` speaks LFS.
  2. **`add_all` / `status` on every commit and every status refresh** walk the whole working tree; binaries are hashed and stored as blobs like any file. A PNG re-exported after each ink edit is a new full blob in history each time (binary, not delta-friendly), so the repository grows by the file's size per edit, on every device.
  3. **Clone and fetch bring everything**: no `depth` or filter is set, so an iPad or phone clone downloads every PDF and every historical version of every ink PNG before the vault opens.
  4. **Memory on pull**: `take_from` reads the whole blob (`blob.content()`) and writes it out, so a pulled PDF is held fully in the Rust process's memory at least once (libgit2 also inflates the object). On a phone that is a hard ceiling for single files in the hundreds of megabytes.
  5. **Memory on display**: the PDF is read whole over IPC into the webview and then copied (`bytes.slice()`), so the renderer briefly holds two copies plus pdf.js's own; this is independent of sync and applies to a GoodNotes-sized scanned book on an iPad whatever the transport.
  6. **Conflicts on binaries keep ours silently**: an ink file edited on two devices would keep the local one and drop the other with no notice (`mergeFile` returns `keep` with no `kept` entry); for PDFs that is safe only because the app never writes them, which stops being true if ink goes onto pages.
  7. **Text-path list**: `.pkdrawing` is not in `TEXT_EXT`, so stroke data would be treated as binary (keep ours), even if a mergeable representation existed.
- What the text side gets from git as built: per-line schedule merges, history, and backup, with two devices not needing to be online together; what it does not give is field-level merge of the same card reworded on one side and graded on the other (kept as two blocks under a notice).
- The merge needs both full texts of a conflicted file in the renderer and runs an O(n·m) LCS table over the middle blocks of the file; for the sample's largest file (32 KB, a few hundred blocks) that is trivial.

### Gaps
- No measurement of clone/fetch/commit time or repository size with large binaries; no test in the repo exercises a large file.
- libgit2's exact memory behaviour for large blobs (streaming on add; whole-object reads on checkout) is from general knowledge of the library, not verified in this codebase.
- Whether iOS background limits allow a long clone/fetch of a multi-gigabyte repository to finish is not addressed anywhere in the repo.
- CRDT-style alternatives (cr-sqlite etc.) are not present in or evaluated by the codebase; nothing here measures them.

---

## 8. Measurement: load, parse and queue times and memory at the sample's size and at ~1,000 / 10,000 / 50,000 Markdown files

### Takeaway
Through Node's fs with a warm cache on an M5 Mac, the app's own load path (walk, read and parse every file, build the queue) takes ~35 ms for the sample (66 files, 758 cards), ~0.3 s for 990 files / 11,370 cards, ~3.5 s for 10,032 files / 115,216 cards (100 MB of Markdown), and ~32 s for 50,028 files / 574,564 cards (500 MB). If cards were one file each, 10,000 files load in ~0.76 s and 50,000 in ~9.1 s — of which 6.5 s is one quadratic lookup in `pagesOf`, not parsing (parsing 50,000 one-card files takes 0.2 s). Reading and parsing split roughly evenly for sample-shaped files (~0.11 ms each per 10 KB file); parse throughput is ~80–90 MB/s. Heap held after load is ~3.7× the Markdown bytes.

### Cited Findings
- **Measured, sample-shaped vaults** (times in ms; Node fs, warm cache, one run per size; "app-style open" = `Vault.open` + `loadReviews` + the `publishDocs` loop + first `publishQueue`, as `openVault` does):

| | sample | s1k | s10k | s50k |
|---|---|---|---|---|
| Markdown files | 66 | 990 | 10,032 | 50,028 |
| Markdown bytes | 0.65 MB | 9.85 MB | 99.9 MB | 498.5 MB |
| directories on disk | 26 | 364 | 3,652 | 18,196 |
| blocks | 2,812 | 42,180 | 427,424 | 2,131,496 |
| cards | 758 | 11,370 | 115,216 | 574,564 |
| card schedule lines | 774 | 11,610 | 117,648 | 586,692 |
| queue items (due at the test instant) | 1,088 (439) | 16,320 (6,585) | 165,376 (66,728) | 824,704 (332,762) |
| walk (`Vault.open`) | 2.4–4.7 | 10.7 | 103 | 509 |
| file reading alone: `stat` + `readFile` awaited one at a time | 8.3–9.0 | 117 | 1,104 | 5,399 |
| file reading alone: `readFileSync` loop | 0.9 | 15.2 | 156 | 4,322 |
| parsing alone, first pass | 16.5–17.5 | 124 | 1,117 | 5,523 |
| parsing alone, repeated (JIT warm, min of 3) | 7.7 | 104 | 1,081 | 5,661 |
| `publishDocs` loop (read + parse + `docItems` + `pagesOf`) | 17–19 | 201 | 2,313 | 25,724 |
| … of which `pagesOf` | 0.4–0.6 | 6.7 | 413 | 10,049 |
| first `publishQueue` | 8.4–9.1 | 89 | 1,065 | 6,251 |
| **app-style open, total** | **33–38** | **307** | **3,487** | **32,496** |
| `serialize` of every document (min of 3) | 0.9 | 12.4 | 113 | 591 |
| heap before load → after load (`heapUsed` after forced GC) | 9.9 → 14.5 MB | 10.1 → 48.6 MB | 12.4 → 381 MB | 21.7 → 1,861 MB |
| RSS after load | 125 MB | 217 MB | 935 MB | 1,990 MB |

  — `bench.ts`, `results/sample.json`, `s1k.json`, `s10k.json`, `s50k.json`
- **Measured, one card per file** (the commenter's assumption; ~260 bytes per file):

| | p10k | p50k |
|---|---|---|
| Markdown files = cards | 10,000 | 50,000 |
| Markdown bytes | 2.59 MB | 13.07 MB |
| walk | 8.2 | 36.8 |
| `stat` + `readFile` awaited one at a time | 505 | 2,373 |
| `readFileSync` loop | 110 | 651 |
| parsing alone | 44 | 201 |
| `publishDocs` loop | 700 | 8,792 |
| … of which `pagesOf` | 277 | 6,511 |
| first `publishQueue` | 47 | 235 |
| **app-style open, total** | **756** | **9,064** |
| heap before → after load | 11.2 → 32.1 MB | 18.6 → 121.3 MB |
| RSS after load | 185 MB | 421 MB |

  — `bench.ts`, `results/p10k.json`, `p50k.json`
- **Measured, per-file and per-byte costs:** sample-shaped files (mean 9.96 KB): async `stat`+read 0.110–0.118 ms/file, parse 0.111–0.125 ms/file, i.e. parse throughput 79 MB/s (`s1k`), 89 MB/s (`s10k`), 90 MB/s (`s50k`); the sample's first-pass parse is 2× slower per byte (16.5 ms for 0.65 MB, ~39 MB/s) because the JIT is cold, 85 MB/s when repeated. One-card files: async `stat`+read 0.047–0.050 ms/file, parse 0.004 ms/file. — derived from the tables above
- **Measured, memory:** heap growth from load ≈ 4.6 MB (sample), 38.5 MB (`s1k`), 369 MB (`s10k`), 1,840 MB (`s50k`) — 3.7–3.9× the Markdown bytes at the three synthetic sizes; one-card files ≈ 2.1 KB of heap per file/card (`p10k` +21 MB, `p50k` +103 MB). Peak process RSS over the whole benchmark (including the search copies of the text): 1.9 GB (`s10k`), 4.75 GB (`s50k`), 0.89 GB (`p50k`). — `bench.ts` (`process.memoryUsage()` after `gc()`), `/usr/bin/time -l`
- **Measured, what a validating cache would still pay and could save** (`extra.ts`): a `stat` of every file, awaited one at a time: 0.9 ms (sample), 9.1 ms (`s1k`), 84 ms (`s10k`), 82 ms (`p10k`), 368 ms (`p50k`); synchronous: 0.1 / 1.4 / 20.5 / 15.8 / 69 ms. Reading with 32 reads in flight instead of one: 33.5 ms (`s1k`), 466 ms (`s10k`), 205 ms (`p10k`), 1,014 ms (`p50k`). `JSON.parse` of the parsed documents (as one JSON string per document) against `parse` of their Markdown: 1.3 vs 17.9 ms (sample), 20.5 vs 141 ms (`s1k`), 340 vs 1,271 ms (`s10k`), 10 vs 56 ms (`p10k`), 68 vs 241 ms (`p50k`); that JSON is larger than the Markdown (0.79 vs 0.65 MB sample; 121 vs 100 MB `s10k`). — `extra.ts`
- The project's own figure for the sample when it had 74 files: "collection open … 24 → 27 ms; queue build 2.2 → 2.3 ms", vitest + jsdom, Node fs. — [PLAN.md:4255-4260](../../PLAN.md)

### Inferences
- Judged against "parsing 10,000 markdown files to extract due dates is not going to have a happy ending": on this machine, in V8, without IPC, 10,000 one-card files parse in 44 ms and load end-to-end in ~0.76 s (0.48 s without the quadratic `pagesOf` lookup); 10,000 sample-shaped files — which hold 115,000 cards and 100 MB of text, not 10,000 cards — take ~3.5 s. The sample itself is 35 ms. A vault with the sample's shape and 10,000 **cards** is about 870 files / 8.7 MB, between the sample and `s1k`: roughly 0.25–0.3 s to open.
- Where time goes at open: file access and parsing are comparable (each ~0.11 ms per 10 KB file); the queue build adds ~30%; `pagesOf` adds a term that grows with the square of the file count and dominates past ~10,000 files. None of the last two is Markdown parsing.
- The real app adds IPC per file (§2), which Node cannot reproduce: this is the main unknown between these numbers and the app, and it scales with file count, so it weighs most on the one-card-per-file shape and least on ilmi's actual many-cards-per-file shape.
- Memory is the tighter limit for a phone or iPad webview than time: the renderer holds raw text and parsed blocks for every document. ~15 MB of heap for the sample and ~50 MB at 11,000 cards are small; ~380 MB at 115,000 cards / 100 MB of Markdown is at a scale where a mobile WKWebView content process is at risk of being killed (no figure for that limit was measured or found in the repo).
- 500 MB of Markdown (the `s50k` case) is far outside the sample's shape (760 copies of it); it is included as an upper bound, not a likely vault.

### Gaps
- Cold file cache (first launch after boot) not measured; warm-cache reads understate disk time, more so on a phone's storage.
- Tauri IPC per call, and JavaScriptCore parse speed and heap size, not measured; no run on an iPad/iPhone or the simulator (excluded by instruction).
- WKWebView's actual memory ceiling on current iPadOS/iOS devices is not known from this research.
- Single run per size for the open path; the 5–10% run-to-run spread seen on the sample (33 vs 38 ms) should be assumed at larger sizes too.

---

## 9. If load time (or per-change cost, or memory) became a problem: what would a derived index have to cover, and where would it plug in? (Description only; nothing implemented.)

### Takeaway
A derived index would be a rebuildable cache beside the vault (or in the app's own data directory), keyed per file by path + mtime + size — the same stamp `Vault` already keeps — holding what the app derives today in memory: per-document info, queue rows, card rows, the id map, and optionally a search index. It would plug in at three places the code already isolates: `Vault.read`/`publishDocs` (skip read+parse for unchanged files), `buildQueue`/`publishQueue` (update one document's rows instead of rebuilding), and `loadReviews`/`spentToday` (only today's lines). The Markdown stays the store of record; the index is disposable, so it needs no sync and no merge.

### Cited Findings
- The stamp exists already: `Stamp { mtimeMs, size }`, `sameStamp`, taken by `fs.stat` before each read and compared before each write. — [src/vault/fs.ts:11-15](../../src/vault/fs.ts), [src/vault/fs.ts:65-68](../../src/vault/fs.ts), [src/vault/vault.ts:331-342](../../src/vault/vault.ts)
- What is derived per document today, and by which function (the candidate contents of an index):
  - `DocInfo` per path: type, title, frozen, card count, due count, due sections, `read`, `write`, `pri`, `pdf`, `tabs`, `pages` — `infoOf`. — [src/app/store.ts:106-125](../../src/app/store.ts), [src/app/vault.ts:41-62](../../src/app/vault.ts)
  - Queue items per path: kind, block index, id, form, text, heading trail, schedule, group/direction, `due`, `pri`, `link` — `docItems`. — [src/schedule/queue.ts:33-134](../../src/schedule/queue.ts), [src/schedule/queue.ts:251-298](../../src/schedule/queue.ts)
  - Front-matter meta per path for option and exam inheritance — `metaOf`, `resolveOptions`, `examsAt`. — [src/app/vault.ts:67-84](../../src/app/vault.ts)
  - Card id → (path, block) — `cardsById`. — [src/schedule/links.ts:65-80](../../src/schedule/links.ts)
  - Deck rows per card: state, due, pri, suspended, folded search text `hay` — `docRows`. — [src/app/deck.ts:75-108](../../src/app/deck.ts)
  - Numbers lines per card — `linesOf`. — [src/app/numbers.ts:29](../../src/app/numbers.ts)
  - Palette entries (titles, card names) — `buildIndex`. — [src/app/chrome.ts:190-216](../../src/app/chrome.ts)
  - Diagnostics per path (`Loaded.diagnostics`). — [src/vault/vault.ts:344-346](../../src/vault/vault.ts)
- Things that are **not** per-file and are computed at queue time from `now`: `isDue`, sibling and linked-card burying, the day's seeded order, exam pull-forward, allowances metered against today's reviews. — [src/schedule/queue.ts:187-209](../../src/schedule/queue.ts), [src/schedule/queue.ts:307-326](../../src/schedule/queue.ts), [src/app/vault.ts:98-102](../../src/app/vault.ts), [src/schedule/options.ts:138-183](../../src/schedule/options.ts)
- Invalidation points that already exist as events: `doc` (one file re-read), `gone`, `moved` (re-key by path), `tree` (structural), `hidden` (`.ilmi` files), `order`. The vault's own writes go through `commit`, which re-parses and emits `doc`. Files changed by a git pull arrive through the same watcher ("the watcher reloads it"). — [src/vault/vault.ts:23-32](../../src/vault/vault.ts), [src/vault/vault.ts:376-387](../../src/vault/vault.ts), [src/vault/vault.ts:436-483](../../src/vault/vault.ts), [src/app/sync.ts:206](../../src/app/sync.ts)
- The whole of a document's parsed form is needed to **open** it (reader, deck editing) and to **write** it (`update` clones `cur.doc`, mutates, serializes), so a file being edited or graded must still be read and parsed in full. — [src/vault/vault.ts:355-366](../../src/vault/vault.ts)
- The fs abstraction has two adapters (`node-fs.ts`, `tauri-fs.ts`) behind one `Fs` interface, and the Rust side already hosts native code for git; `.gitignore` already excludes per-device files (`.ilmi/state.json`). — [src/vault/fs.ts:21-48](../../src/vault/fs.ts), [src-tauri/src/sync.rs:22](../../src-tauri/src/sync.rs)
- **Measured inputs for sizing it** (§8, §5): validating by `stat` costs 84 ms per 10,000 files (Node, async, sequential); `JSON.parse` of cached parsed documents is 3.5–14× faster than `parse` but the JSON is ~1.2× the Markdown's size; slim queue rows alone (kind, path, due, pri as JSON) are 96 KB for the sample, 1.6 MB for `s1k`, 16 MB for `s10k`; an FTS5 index is 1.5× (`unicode61`) to 3.7× (`trigram`) the Markdown's size and builds at ~90 MB/s (`unicode61`) or ~15 MB/s (`trigram`). — `extra.ts`, `fts.py`

### Inferences
- **Where it would plug in, in order of what the measurements say costs most:**
  1. *Per-change queue rebuild* (`publishQueue`, [src/app/vault.ts:125-129](../../src/app/vault.ts)): keep `docItems` output per path in a `Map` and replace one entry on a `doc` event, then re-run only the cross-document steps (`examQueue`, `buryLinked`, `meterQueue`). This is an in-memory change with no file or database; it removes the `docItems`-for-all pass (30% of the rebuild) but not the sort. A stored index with a `due` column would also make "what is due today" a range query, at the price of re-deriving day-dependent state (burying, order, allowances) on top.
  2. *`pagesOf`'s tree search* ([src/vault/vault.ts:291-318](../../src/vault/vault.ts)): a path → node `Map` built once per walk; no index needed.
  3. *Open* (`publishDocs`, [src/app/vault.ts:186-204](../../src/app/vault.ts) and `Vault.read`, [src/vault/vault.ts:331-342](../../src/vault/vault.ts)): for each path, `stat`; if the stamp matches the cached row, load `DocInfo` + queue rows (+ meta, ids) from the cache and skip `readText` + `parse`; parse lazily when the document is opened or written. This removes the read and parse (about two thirds of open) and, more importantly on mobile, removes the need to hold every document's text and blocks in memory. It still pays one `stat` per file — or one batched native call returning every stamp, which would also remove the per-file IPC.
  4. *Review log* (`loadReviews`, `spentToday`, `reloadReviews`): read only the current month's file for today's allowance; load older months when the numbers lens asks; or keep per-day aggregates in the cache keyed by each month file's stamp.
  5. *Search*: a card-face index is already implicit in `deckRows`' `hay`; a vault-wide prose index (FTS5 or other) would be new, must apply the app's fold before tokenizing and keep substring behaviour for Arabic (§5), and would be keyed by the same stamps.
- **What it would have to get right:** (a) invalidation by stamp on open and by watcher event while running, including files changed by `git pull` and by other editors (the format's promise: "open any file in a text editor, change it, and the app picks it up"); (b) renames and moves (paths are the keys; `moved` events re-key); (c) a format/derivation version so a new app version rebuilds; (d) being safe to delete — nothing in it may be the only copy; (e) staying out of sync (`.gitignore`, as `state.json` is) or outside the vault, since two devices' caches would conflict as binary files; (f) mtime granularity and clock issues after a clone, when every file's mtime is the checkout time (a content hash or the git blob id would be a stricter key than mtime+size).
- **Whether it is SQLite or JSON is separable from the above:** the measurements show a JSON blob of derived rows is small at the sample's scale (tens to hundreds of KB) and parses in about a millisecond; SQLite would add indexed range queries and FTS5 and avoid loading the whole cache into the webview's heap, at the cost of a native dependency reached over IPC (the renderer has no SQLite today: `package.json` has no SQL dependency and the Rust side exposes none). — [package.json](../../package.json), [src-tauri/src/lib.rs:399](../../src-tauri/src/lib.rs)
- **On "caching should be a last resort because invalidation is hard":** in this codebase the invalidation signal already exists and is already trusted for correctness — the in-memory `Vault.cache` is invalidated by exactly this stamp comparison and these watcher events today. A persistent cache would extend the same rule across launches; the new risks are the ones listed in (c), (e) and (f).

### Gaps
- No prototype was built (by instruction), so the gains above are projections from component timings, not measured end-to-end.
- A batched native read/stat command, and its IPC cost for large payloads, was not measured.
- How much of the renderer's memory could be released by lazy parsing depends on which features need full documents in memory (the same-fact finder, the deck browser at the root, the numbers lens all read `bodies` today); that refactor's extent was not scoped here.
