# SQLite-as-the-store with CRDT or database-level sync (state as of 2026-11-05)

Conventions used below. "GitHub API, 2026-11-05" means I queried api.github.com for the repo on that date and cite the human-readable page. "Search snippet" means the fact came from a search-result summary and I did not open the page. "Measured in this session" means I ran it myself on this Mac (Apple M5, SQLite 3.53.1 via Python) and there is no published source.

## 1. cr-sqlite (vlcn-io/cr-sqlite): maintenance, merge semantics, limits, platforms, users

### Takeaway
Upstream cr-sqlite has had no release since v0.16.3 (2024-01-17) and its author has worked full time on Rocicorp's Zero since 2024; the code that is actively developed is Fly.io's fork, built for server clusters. Its merge is a per-cell "biggest version counter wins" register: it stops two devices' edits to different columns of a row from clobbering each other, and it does nothing semantic when both edit the same cell.

### Cited Findings
- Latest upstream release is v0.16.3, published 2024-01-17; the four before it are v0.16.2 (2024-01-06), v0.16.1 and v0.16.0 (2023-12-16), v0.16.0-next.2 (2023-12-01). GitHub API, 2026-11-05 — [cr-sqlite releases](https://github.com/vlcn-io/cr-sqlite/releases)
- Commits to `main` by year: 1,239 in 2023, 13 in 2024, none in 2025, 5 in 2026. The five 2026 commits (2–10 Aug 2026) are build fixes by an outside contributor: iOS simulator build, all Android ABIs, Android 16 KB page alignment, Windows arm64 loadable, macOS headerpad. Before them the last commit was 2024-06-29. GitHub API, 2026-11-05 — [cr-sqlite commits](https://github.com/vlcn-io/cr-sqlite/commits/main)
- Repo is not archived; 3,824 stars, 128 forks, 56 open issues and pull requests (48 issues, 8 PRs), MIT licence. GitHub API, 2026-11-05 — [cr-sqlite repo](https://github.com/vlcn-io/cr-sqlite)
- Maintainer statement, Matt Wonlaw (tantaman), 2024-12-30, in the issue titled "Is this project dead?": "I'm full time on https://zero.rocicorp.dev/ these days. When that project becomes more mature I'll have more bandwidth again but I don't see that happening for at least 1-2 years." — [cr-sqlite issue #444](https://github.com/vlcn-io/cr-sqlite/issues/444)
- A June 2024 localfirst.fm episode description says "Most recently Matt also joined Rocicorp to work on their new product" (search snippet) — [localfirst.fm #10 transcript](https://localfirst-fm.vercel.app/10/transcript)
- Production user: Fly.io. Jerome Gravel-Niquet (jeromegn), 2025-08-16: "We do still use this, yes. Our fork currently has a significant change: repurposed `db_version` to be monotonically, and serially, incrementing by 1, per `site_id`... We share 7.5 million rows globally. The cluster handles over 300K operations per second, in aggregate, with a p99 'time to replication' of ~1 second... to the other ~1000 nodes. It's tested with Antithesis." — [cr-sqlite issue #444](https://github.com/vlcn-io/cr-sqlite/issues/444)
- Fly's fork is the live line of development: superfly/cr-sqlite was pushed 2026-10-30, latest tag `v0.18.0-v2-migration-alpha24` (prerelease, 2026-10-14); Corrosion, the gossip service built on it, reached v1.0.0 on 2026-05-14. GitHub API, 2026-11-05 — [superfly/cr-sqlite](https://github.com/superfly/cr-sqlite), [superfly/corrosion](https://github.com/superfly/corrosion)
- The fork's `db_version` change is, per its maintainer, "optimised for our use case" (any-node-to-any-node gossip) and "makes tracking a little more complex" — [cr-sqlite issue #444](https://github.com/vlcn-io/cr-sqlite/issues/444)
- Open issues that show the unmaintained edges: #433 "`DROP TABLE` leads to corruption?" (May 2024; author replied "I'll update `begin_alter` to account for drop table", still open), #442 "Support tables with more than 63 columns", #443 "Fails in node22", three automigration bugs filed Oct 2025 with no maintainer fix, #466 "Issue with float and Int comparison" (Aug 2026). GitHub API, 2026-11-05 — [cr-sqlite issues](https://github.com/vlcn-io/cr-sqlite/issues), [#433](https://github.com/vlcn-io/cr-sqlite/issues/433)
- CRDT types, per README: "LWW, Fractional Index, Observe-Remove sets are available now." and "Counter and rich-text CRDTs are still being implemented."; "multi-value registers, RGA and others to come in future iterations." The causal-event-log approach is "To be implemented in v2 of cr-sqlite." There is no shipped text or sequence CRDT. — [cr-sqlite README](https://github.com/vlcn-io/cr-sqlite)
- The docs site is less careful than the README: it lists Counter, RGA and a non-interleaved fractional index among supported types, while labelling its own `COUNTER` and `PERITEXT` example "notional". — [vlcn docs: CRDTs](https://vlcn.io/docs/cr-sqlite/crdts/about); contradicted by [cr-sqlite README](https://github.com/vlcn-io/cr-sqlite)
- Data model: a table is a set (Delete-Wins, Causal-Length or Grow-Only; causal length lets a deleted row be re-inserted), "A row can be thought of as a map", each column a register. — [vlcn docs: CRDTs](https://vlcn.io/docs/cr-sqlite/crdts/about)
- The merge rule for a cell, per Fly's Corrosion docs (stated for cr-sqlite 0.15): "Biggest `col_version` wins"; "In case of a tie, the 'biggest' value is used"; comparison order is `col_version`, then the value, then `site_id`. `col_version` is a per-column counter incremented each time the column is changed. — [Corrosion: CRDTs](https://superfly.github.io/corrosion/crdts.html)
- Constraints on a replicated table (search snippet of the official constraints page): "Checked foreign key constraints are not allowed"; "The only enforceably unique column in a table should be the primary key. Other columns may be indices but they may not be unique."; check constraints spanning other columns are not allowed; a globally stable id such as UUIDv7 is recommended as primary key. — [vlcn docs: constraints](https://vlcn.io/docs/cr-sqlite/constraints)
- Other operational rules: every `NOT NULL` column needs a default before `crsql_as_crr`; any write made by a connection without the extension loaded leaves the replicated tables inconsistent. — [Corrosion: CRDTs](https://superfly.github.io/corrosion/crdts.html)
- Schema changes must be wrapped in `crsql_begin_alter` / `crsql_commit_alter`; the extension "needs to be loaded on every connection you create". — [cr-sqlite README](https://github.com/vlcn-io/cr-sqlite)
- Overhead: "Currently inserts into CRRs are 2.5x slower than inserts into regular SQLite tables." "Reads are the same speed." — [cr-sqlite README](https://github.com/vlcn-io/cr-sqlite)
- Platforms documented in the README: loadable extension for Linux, macOS, Windows; browser WASM through the separate `js` repo. iOS is not mentioned in the README. The npm WASM package `@vlcn.io/crsqlite-wasm` is at 0.16.0, published 2023-12-16. — [cr-sqlite README](https://github.com/vlcn-io/cr-sqlite), [npm: @vlcn.io/crsqlite-wasm](https://www.npmjs.com/package/@vlcn.io/crsqlite-wasm)
- rusqlite's bundled SQLite build is compiled with `-DSQLITE_ENABLE_LOAD_EXTENSION=1` and `-DSQLITE_ENABLE_FTS5`; master bundles SQLite 3.54.1; rusqlite is at 0.41.1 (2026-10-28). — [libsqlite3-sys build.rs](https://github.com/rusqlite/rusqlite/blob/master/libsqlite3-sys/build.rs), [crates.io: rusqlite](https://crates.io/crates/rusqlite)
- A commercial-backed alternative extension was advertised in the same thread by its author (2025-08-18): sqliteai/sqlite-sync, release 1.2.0 on 2026-09-28. — [cr-sqlite issue #444](https://github.com/vlcn-io/cr-sqlite/issues/444), [sqliteai/sqlite-sync](https://github.com/sqliteai/sqlite-sync)

### Inferences
- What column-level LWW resolves: device A edits column X of a row while device B edits column Y; both survive. Whole-row LWW (Anki's rule, section 4) would lose one. What it does not resolve: both devices change the same cell. One value is kept and the other is discarded with no record and no prompt. So the commenter's own standard ("last-write-wins is not really handling conflicts") applies to cr-sqlite at cell granularity.
- "Last" is not wall-clock. The winner is the cell with the higher edit count, so a device that changed a cell twice yesterday beats a device that changed it once today. For a card's schedule this means "more reviews wins", then "larger value wins" on a tie; neither is the same as "most recent review wins", and neither replays both reviews through the scheduler.
- For a card with separate `due`, `stability`, `difficulty` columns, per-column merge can combine A's `due` with B's `stability` when edit counts differ per column, yielding a schedule state that neither device computed. Avoiding that requires storing the schedule as one cell (then it is whole-value LWW) or deriving it from a replicated review log.
- Without foreign-key or unique enforcement, a merge can produce a card whose note was deleted on another device, or two rows that the app considers duplicates; the app must tolerate or repair these.
- Adopting upstream cr-sqlite in November 2026 means adopting a library whose last release is 22 months old, with an open corruption report on `DROP TABLE` and no maintainer capacity by the author's own account. Adopting Fly's fork means tracking alpha tags tuned for a 1,000-node server mesh.
- In a Tauri app the extension would be loaded by the Rust side through rusqlite; iOS apps cannot load unsigned dynamic libraries at run time, so it would have to be linked statically or shipped as a signed framework. The August 2026 iOS-simulator build fix shows someone is building it for iOS, but there is no official iOS release artifact or documentation.

### Gaps
- Binary size of the extension and its behaviour with large blobs: not found.
- No published benchmark of merge cost on a phone; the 2.5x insert figure is the README's own and undated.
- I did not open the vlcn constraints page directly; the constraint wording is from a search snippet.
- I found no named consumer notes or flashcard app shipping cr-sqlite in production. Pentive (section 8) is the closest and is unreleased.

## 2. Alternatives in the same family, status in November 2026

### Takeaway
The actively developed options split into document CRDT libraries (Automerge, Yjs/Yrs, Loro), which sync without a server but give no SQL, and server-authoritative sync engines (Electric, PowerSync, Zero, Turso), which give SQL but need a hosted database and mostly resolve conflicts by last-write or by server rules. None gives peer-to-peer, multi-writer, relational sync with better-than-LWW merging as a finished product for iOS + Tauri.

### Cited Findings
- Automerge: JS package 3.5.0 and Rust crate 0.12.0, both 2026-09-16; repo pushed 2026-11-03. automerge-repo's newest tag is `v3.0.0-experimental.2` (prerelease, 2026-10-09). GitHub API and registries, 2026-11-05 — [automerge](https://github.com/automerge/automerge), [crates.io: automerge](https://crates.io/crates/automerge), [automerge-repo](https://github.com/automerge/automerge-repo)
- Loro: Rust crate and `loro-crdt` npm package both at 1.17.1 (2026-10-22); repo pushed 2026-11-03. — [crates.io: loro](https://crates.io/crates/loro), [loro-dev/loro](https://github.com/loro-dev/loro)
- Yjs / Yrs: Yjs newest tag is `v14.0.0-rc.29` (prerelease, 2026-10-15); the Rust port `yrs` is at 0.28.1 (2026-11-04). — [yjs/yjs](https://github.com/yjs/yjs), [crates.io: yrs](https://crates.io/crates/yrs)
- Evolu: `@evolu/common` 8.27.2 (2026-11-04), repo pushed 2026-11-05. Per its docs (search snippet): stores data in SQLite, "syncs data using encrypted CRDT messages with last-write-wins conflict resolution"; relays are "a generic, stateless sync (and optionally backup) server". — [evoluhq/evolu](https://github.com/evoluhq/evolu), [Evolu docs overview](https://evolu.vercel.app/docs/overview)
- Triplit: Supabase announced on 2025-10-08 that co-founder Matt Linkous joined; "Our focus isn't to directly integrate Triplit into our platform." The repo's last push was 2026-01-19 and last release 2025-07-31. — [Supabase: Triplit joins Supabase](https://supabase.com/blog/triplit-joins-supabase), [aspen-cloud/triplit](https://github.com/aspen-cloud/triplit)
- Electric SQL: 1.0 reached GA on 2025-03-17 ("The core Electric sync service APIs are now stable"). It is a Postgres read-path sync engine; writes go through the app's own API. Repo last pushed 2026-10-06. — [ElectricSQL 1.0 released](https://electric-sql.com/blog/2025/03/17/electricsql-1.0-released), [electric-sql/electric](https://github.com/electric-sql/electric)
- PowerSync: syncs a subset of a server database (Postgres, MongoDB, MySQL) into client SQLite; local writes are uploaded by a connector the developer writes. `@powersync/web` 2.6.0 (2026-11-02); core extension v0.5.4 (2026-10-16). The Tauri v2 plugin is alpha: crate `tauri-plugin-powersync` 0.0.3, built on a Rust SDK that is also alpha; "connectors must be written in Rust" and calling `connect()` from JavaScript throws. — [PowerSync Tauri SDK docs](https://docs.powersync.com/client-sdks/reference/tauri), [powersync-sqlite-core](https://github.com/powersync-ja/powersync-sqlite-core)
- Zero (Rocicorp): `@rocicorp/zero` 1.11.4 (2026-11-04). Its docs say Zero "does not support offline writes" and "is not designed for long periods offline"; writes are rejected once disconnected (after a default one-minute connect window). The same page: for offline conflicts "no sync engine or CRDT algorithm can automatically solve it for you." — [Zero docs: offline](https://zero.rocicorp.dev/docs/offline)
- Turso / libSQL: sync is explicit `push()` / `pull()` against Turso Cloud. Offline writes began as a private beta in which conflicts were detected but "resolution is not yet implemented"; a later Turso guide says the version pushed last wins per row. The two Turso sources disagree on the rule. `libsql` crate 0.10.0 (2026-10-13); the Rust rewrite `turso` is 0.8.3 stable with 0.9.0-pre.2 out (2026-10-28), so pre-1.0. — [Turso sync docs](https://docs.turso.tech/sync), [Turso offline sync public beta](https://turso.tech/blog/turso-offline-sync-public-beta), [Introducing offline writes](https://turso.tech/blog/introducing-offline-writes-for-turso), [crates.io: turso](https://crates.io/crates/turso)
- Litestream v0.5.18 (2026-11-03); LiteFS last release v0.5.14 (2025-04-22). GitHub API, 2026-11-05 — [litestream](https://github.com/benbjohnson/litestream), [litefs](https://github.com/superfly/litefs)
- The official SQLite WASM build is compiled with `-DSQLITE_ENABLE_SESSION` (the session/changeset extension), alongside FTS5 and R-Tree. — [sqlite/ext/wasm/GNUmakefile](https://github.com/sqlite/sqlite/blob/master/ext/wasm/GNUmakefile)

### Inferences
- Zero's own documentation is the strongest counter-quote to "SQLite + CRDT handles conflicts": the cr-sqlite author's current employer ships a sync engine that refuses offline writes because automatic merging of long-offline edits is unsolved in general.
- For a single-user app across three Apple devices with no server, the server-authoritative engines (Electric, PowerSync, Zero, Turso) each add a hosted Postgres or cloud dependency the app does not have today. Only the CRDT libraries, Evolu (needs a relay) and cr-sqlite work peer-to-peer or with a dumb relay.
- Automerge, Loro and Yrs all have Rust cores, so all three run natively in a Tauri backend on iOS; they merge text at character level, which cr-sqlite does not.

### Gaps
- Not verified this session (recalled from project docs, treat as unconfirmed): Automerge/Loro/Yjs feature details (rich text, movable tree, history size); that Litestream is single-writer disaster-recovery replication of the WAL to object storage and LiteFS is single-primary with read replicas (which is why neither is a multi-device sync answer); that the SQLite session extension requires primary keys and leaves conflict policy to a callback the application supplies; that Zero requires Postgres plus a `zero-cache` service; sqlite-sync's licence.
- automerge-repo's latest stable (non-experimental) version: not determined.
- Triplit's maintenance commitment after the Supabase hire: none found.

## 3. SQLite on the web: official WASM + OPFS, and absurd-sql

### Takeaway
SQLite in the browser is real and officially supported, with several OPFS back ends that each carry concurrency or header constraints. It is beside the point for a Tauri app, whose Rust side links native SQLite and never touches OPFS.

### Cited Findings
- Three supported OPFS VFSes. `opfs`: needs a Worker, `SharedArrayBuffer` and therefore COOP/COEP headers; "Safari versions less than version 17 are incompatible with the current OPFS VFS implementation". `opfs-sahpool` (SQLite 3.43+): "Does not require COOP/COEP HTTP headers", highest performance, but no multiple simultaneous connections. `opfs-wl` (3.53.0+): uses Web Locks, requires `Atomics.waitAsync()`. — [sqlite.org WASM persistence](https://sqlite.org/wasm/doc/trunk/persistence.md)
- Minimum browsers for OPFS per the same page: Chromium from mid-2022, Firefox 111 (March 2023), Safari 16.4 (March 2023). — [sqlite.org WASM persistence](https://sqlite.org/wasm/doc/trunk/persistence.md)
- Concurrency: reads lock OPFS files too; testing in 2026-03 handled "8-10 concurrent workers for long periods" if clients handle `SQLITE_BUSY`; the `opfs-unlock-asap` escape hatch can cost up to a "400% run time increase". — [sqlite.org WASM persistence](https://sqlite.org/wasm/doc/trunk/persistence.md)
- Persistence caveats: storage can vanish through browser cleanup, private modes or third-party cleaners; `opfs-sahpool` wipes its storage if initialisation fails (optional since 3.54 but still the default); versions before 3.54 had a latent locking bug that could corrupt data within one thread. — [sqlite.org WASM persistence](https://sqlite.org/wasm/doc/trunk/persistence.md)
- The npm package `@sqlite.org/sqlite-wasm` is at 3.54.1-build1 (2026-10-19). — [npm: @sqlite.org/sqlite-wasm](https://www.npmjs.com/package/@sqlite.org/sqlite-wasm)
- absurd-sql (James Long): stores SQLite pages inside IndexedDB; last push to the repo 2023-08-06, no releases, 41 open issues, not archived. The SQLite project describes it as a demonstration: "James Long's aptly-named `absurd-sql` demonstrates persistent storage option for sqlite3". GitHub API, 2026-11-05 — [jlongster/absurd-sql](https://github.com/jlongster/absurd-sql), [sqlite.org WASM check-in](https://sqlite.org/wasm/info/53782e47e9dfd3b4bc071b460b0f355c316118d5697cf3fa97a4a13f9f02f85b)
- wa-sqlite (Roy Hashimoto), which cr-sqlite's WASM build is based on, is maintained: v1.2.0 on 2026-11-03. — [rhashimoto/wa-sqlite](https://github.com/rhashimoto/wa-sqlite)

### Inferences
- absurd-sql was a 2021 workaround for the lack of a synchronous file API in browsers; OPFS removed the need, and the project has been dormant for three years. Citing it in 2026 dates the argument.
- "SQLite runs on the web via WASM" matters to an app whose client is a browser tab (Pentive is one). In Tauri v2 the WKWebView renderer talks to Rust over IPC and Rust opens a real file with native SQLite, on macOS and iOS alike.

### Gaps
- No current first-party statement on OPFS reliability inside iOS WKWebView specifically (as opposed to Safari).

## 4. How apps that use a database have done sync, and how plain-Markdown apps fare at 10,000+ notes

### Takeaway
Anki, the reference SQLite flashcard app, syncs by whole-object newest-modification-wins plus a merged review log, and falls back to a one-way overwrite whenever the schema changes. Logseq spent 2024–2026 moving from Markdown to SQLite, ended up splitting into two products, and has not yet shipped two-way Markdown interop. Obsidian's hard performance reports are at 50,000–100,000 files on phones, not at 10,000.

### Cited Findings
Anki
- Manual: "Under normal circumstances, reviews and note edits can be merged." If the same card was reviewed in two places, "both reviews will be marked in the revision history", and "the card will be kept in the state it was when it was most recently answered." — [Anki manual: syncing](https://docs.ankiweb.net/syncing.html)
- Source: a normal sync is only possible when schema timestamps match; `else if remote.schema != local.schema` yields `SyncActionRequired::FullSyncRequired` (upload or download of the entire collection, user picks a side). — [anki rslib/src/sync/collection/meta.rs](https://github.com/ankitects/anki/blob/main/rslib/src/sync/collection/meta.rs)
- The schema timestamp is bumped by changes such as adding or removing a note type or field (secondary, AnkiDroid wiki via search snippet). — [AnkiDroid database structure wiki](https://github.com/ankidroid/Anki-Android/wiki/Database-Structure)
- A forum post of 2026-10-06 describes current behaviour: on a per-card or per-note conflict Anki silently keeps the object with the newer modification time; review history is merged, but card state, fields, tags and deck are not, citing `rslib/src/sync/collection/chunks.rs`. No developer had replied. — [Anki forum: show and resolve per-card conflicts](https://forums.ankiweb.net/t/show-and-resolve-per-card-per-note-conflicts-during-normal-sync-instead-of-silently-keeping-the-newest/71321)
- Media is synced separately from the collection; "media changes are always merged"; edits to an existing file are not detected. — [Anki manual: syncing](https://docs.ankiweb.net/syncing.html)
- Self-hosted sync server: bundled with desktop Anki "as of version 2.1.57+", also via pip and (2.1.66+) cargo; listens on unencrypted HTTP; "use of this is entirely at your own risk"; client and server versions must be kept in step. — [Anki manual: sync server](https://docs.ankiweb.net/sync-server.html)
- Anki is at 26.09.4 (2026-11-04). — [ankitects/anki releases](https://github.com/ankitects/anki/releases)

Logseq
- Tienson Qin, 2024-04-29, on why: "Building real-time collaboration on top of Markdown files is extremely challenging"; creating a block rewrites the whole file; renaming a page rewrites every referencing file; Markdown lacks persistent ids and timestamps; the file app suffered data loss with multi-client sync and slow performance on large graphs. Promise at the time: keep both graph types, with two-way DB/Markdown sync as the long-term goal. Pre-alpha was then "in 2 ～ 3 months". — [Logseq forum: Why the database version](https://discuss.logseq.com/t/why-the-database-version-and-how-its-going/26744)
- 2026: the team announced "Big update: Logseq is splitting into two versions". The file app became "Logseq OG" in its own repo (`logseq/og`), with "security fixes, patches, and Electron and dependency upgrades" and a "focus... on maintenance and reliability rather than new feature development". — [Logseq forum thread quoting the announcement](https://discuss.logseq.com/t/is-anyone-planning-to-use-og-version-indefinitely/35091)
- Secondary sources date the announcement 2026-04-24 and list DB version 2.0.2 (2026-10-07) as still Beta and OG at 1.0.0 (2026-04-15) (search snippets, not official). — [issoh.co.jp guide](https://www.issoh.co.jp/md/tech/4954), [kompozy.io](https://kompozy.io/news/logseq-2-0-db-version-beta)
- As of 2026-05-16: "Logseq's DB graphs live in SQLite"; a one-way, opt-in "Markdown Mirror" writes a plain-Markdown copy to disk; the two-way version "is in active development on a feature branch and not yet shipped"; sync testing was open to sponsors only. — [What's New with Logseq DB, May 16th 2026](https://discuss.logseq.com/t/whats-new-with-logseq-db-may-16th-2026/35020)
- Users staying on OG (July 2026) cite plain files readable in other editors and sync via Syncthing or rsync; one notes SQLite's single-file storage makes sync "really bandwidth and time consuming"; one who prefers DB calls it "too unreliable" to depend on. — [Logseq forum: staying on OG](https://discuss.logseq.com/t/is-anyone-planning-to-use-og-version-indefinitely/35091)

Obsidian (files as truth, derived cache)
- The metadata cache is an IndexedDB database named `${app.appId}-cache` with `file` and `metadata` tables. — [Obsidian forum: large vault load time on mobile](https://forum.obsidian.md/t/unpractical-vault-load-time-for-large-vaults-on-mobile-indexeddb-transactions-are-not-flushed-to-disk/88470)
- Largest documented case: 86,685 files (later 98,029) on a OnePlus Android 12 phone, Obsidian 1.7.1/1.7.4: about 315 s to load the vault, then 27–40 minutes of indexing repeated on every launch. Cause given by staff: "the indexeddb transactions are not actually flushed to disk when they are complete"; i.e. the cache failed to persist, so the app re-parsed everything each time. Licat (2024-10-22): "I don't think it's worth attempting to address given the situation is more of an edge case." Reporter, 2025-02-25: "Starting from 1.8.8, the vault finally became usable on mobile." In the same thread, re-indexing stopped being triggered at 9,845 notes and started at 9,846. — [Obsidian forum: large vault load time on mobile](https://forum.obsidian.md/t/unpractical-vault-load-time-for-large-vaults-on-mobile-indexeddb-transactions-are-not-flushed-to-disk/88470)
- Other reports (search snippets): a roughly 23,000-note vault re-indexing at each launch, "two or three minutes" after the first; an early Android report of more than five minutes to start above 10,000 notes. — [Obsidian forum: reindexes entire vault](https://forum.obsidian.md/t/reindexes-entire-vault-every-time-on-obsidian-startup/95724), [Obsidian forum: Android startup](https://forum.obsidian.md/t/bug-for-android-the-startup-is-extremely-slow-and-it-takes-more-than-5-minutes/18591)
- Search: forum users state that tags and metadata are indexed but "the full text of notes are not" (user posts, years old; a 2024 thread asking staff how search works got no answer). — [Obsidian forum: full text index request](https://forum.obsidian.md/t/full-text-index-of-all-note-content-not-just-metadata/9591), [Obsidian forum: how does search work](https://forum.obsidian.md/t/how-exactly-does-obsidians-search-work/90905)
- Omnisearch is at 1.32.0 (2026-10-24), built on the MiniSearch library with an in-memory index; its listing warns that with "several thousands of files, Obsidian may freeze a few seconds at startup while the Omnisearch cache is loaded in memory". — [obsidian-omnisearch](https://github.com/scambier/obsidian-omnisearch), [Omnisearch plugin page](https://community.obsidian.md/plugins/omnisearch)

Others
- Notion offline: started from a best-effort SQLite cache, made it a persistent store, and "Pages marked as available offline are dynamically migrated to the new CRDT data model for conflict resolution." — [Notion: How we made Notion available offline](https://www.notion.com/blog/how-we-made-notion-available-offline)
- Anytype: its any-sync protocol is CRDT-based, conflicts resolved on device, backup nodes hold encrypted data, LAN sync possible (search snippet). — [anyproto/any-sync](https://github.com/anyproto/any-sync)
- Bear: a developer states sync is "custom-made by us and based on CloudKit while the local data is preserved with CoreData"; whole note text is what moves (search snippet). — [Bear community: how does synchronization work](https://community.bear.app/t/how-does-synchronization-work/12278)
- Apple Notes: local store is `NoteStore.sqlite`; note bodies are gzip-compressed protobuf in a CRDT format known only by reverse engineering ("inferred by observation, not from any Apple documentation") (search snippet). — [Notes-Of-Fruit](https://github.com/ericmigi/Notes-Of-Fruit), [Simon Willison: notes on Notes.app](https://www.simonwillison.net/2021/Dec/9/notes-on-notesapp)

### Inferences
- Anki's conflict rule is coarser than cr-sqlite's (whole card, not per column) yet tens of millions of reviews sync through it, because the review log is merged as a set and the same card is rarely reviewed twice between syncs. The log, not the card row, is the part that never loses data.
- Anki's full-sync fallback is the practical cost of schema change in a synced database: a structural edit on one device forces every other device to discard its unsynced work or overwrite the server.
- Logseq is the closest precedent for "move a Markdown notes app to SQLite": two and a half years after the announcement, the database version is still beta, the file version is frozen, and the promised two-way Markdown sync is not shipped. Its stated reasons were real-time collaboration and block-level identity, neither of which is a goal for a single-user deck-file app.
- The Obsidian failure at 87,000 files was a cache-persistence bug in the web platform's database (IndexedDB), not a limit of parsing Markdown; it argues for a cache that persists reliably (native SQLite would), not for moving the source of truth.

### Gaps
- No staff-confirmed description of Obsidian's core search internals.
- No first-party Logseq statement found for the period after May 2026 on two-way Markdown sync; the 2.0.2 beta date is secondhand.
- Bear, Anytype and Apple Notes facts are from search snippets, not opened pages.

## 5. The hybrid design: plain files as truth, derived index for queries and full-text search

### Takeaway
Keeping files canonical and deriving a rebuildable index is an established pattern (Obsidian, org-fc/org-roam style tools, Logseq OG), and FTS5 is available in exactly the SQLite builds a Tauri app would use. The known failure modes are cache persistence and invalidation, not query speed.

### Cited Findings
- Obsidian persists a derived metadata cache (IndexedDB) beside the vault and re-indexes changed files at startup; the 2024 mobile bug shows what happens when the cache silently fails to persist. — [Obsidian forum: large vault load time on mobile](https://forum.obsidian.md/t/unpractical-vault-load-time-for-large-vaults-on-mobile-indexeddb-transactions-are-not-flushed-to-disk/88470)
- Logseq OG parses Markdown into an in-app database and must reconcile it when files are edited outside the app; forum users describe this as a source of conflicts (user accounts via search snippet). — [Logseq forum: database version, too drastic?](https://discuss.logseq.com/t/database-version-too-drastic-choice/20346)
- A design note for a derived SQLite index over a Markdown vault treats mtime and size only as hints and re-hashes content on watcher events and on open (small project, search snippet; a pattern, not a track record). — [BoostNote fork issue #16](https://github.com/adrianbrowning/BoostNote/issues/16)
- FTS5 external-content tables index text without storing a second copy, but "the user must keep the index consistent with the content table"; triggers do not back-fill existing rows, which need a `rebuild`. — [SQLite FTS5](https://sqlite.org/fts5.html)
- FTS5 is compiled into rusqlite's bundled SQLite (`-DSQLITE_ENABLE_FTS5`) and into the official WASM build. — [libsqlite3-sys build.rs](https://github.com/rusqlite/rusqlite/blob/master/libsqlite3-sys/build.rs), [sqlite/ext/wasm/GNUmakefile](https://github.com/sqlite/sqlite/blob/master/ext/wasm/GNUmakefile)
- Even the database-first Pentive keeps its FTS tables as derived, trigger-maintained indexes over normalised views, not as replicated data (section 8). — [Pentive shared/sql/note.sql](https://github.com/AlexErrant/Pentive/blob/main/shared/sql/note.sql)

### Inferences
Measured in this session (no external source; synthetic vault of 10,000 Markdown deck files, 10 cards each, 100,000 cards, 37.6 MB; Apple M5 Mac, warm file cache, single-threaded Python):
- Read every file and regex out every `due:` line: 0.25–0.29 s. `grep -r` over the same: 0.1 s. `stat` of all 10,000 files (the mtime+size check): 0.022 s.
- Full parse into 100,000 in-memory card records: 0.31 s. Filtering those records for due cards: 1.9 ms. Substring search across all card bodies in memory: 25 ms.
- Same data in SQLite: indexed due query 1.0 ms; `LIKE '%…%'` scan 37 ms; FTS5 phrase match 2.9 ms. Building the table took 0.25 s and the FTS5 index 0.32 s. Database with FTS index: 59.7 MB against 37.6 MB of Markdown.
- Reading: on a desktop, "parsing 10,000 markdown files for due dates" costs about a quarter of a second cold-parse and nothing afterwards if parsed cards are kept in memory or only changed files are re-read. A phone will be several times slower and a cold flash read slower again; that is the case a persisted index covers. The gain from an index at this size is in startup and in ranked text search, not in the due query.
- The index can be deleted and rebuilt from the files at any time, so it adds no sync or merge surface: each device builds its own.

### Gaps
- Not verified this session (recalled, unconfirmed): org-roam's SQLite cache of Org files; Dataview/Datacore's in-memory index; Zettlr, Foam, Dendron, nb, SilverBullet and Reor internals. I found no maintainers' numbers for any of them at 10,000+ notes.
- No measurement on an iPhone or iPad; the figures above are one desktop machine with synthetic data.

## 6. Spaced repetition: merging the same card reviewed on two devices

### Takeaway
The recognised design is a review log merged as a set plus card state taken from the most recent answer; Anki does exactly this. File-based tools mostly store only the current schedule inline and advise reviewing on one device at a time.

### Cited Findings
- Anki: "both reviews will be marked in the revision history" and "the card will be kept in the state it was when it was most recently answered." The `revlog` table is separate from `cards` and indexed by card id. — [Anki manual: syncing](https://docs.ankiweb.net/syncing.html), [anki schema11.sql](https://github.com/ankitects/anki/blob/main/rslib/src/storage/schema11.sql)
- org-fc (Emacs, plain Org files): current schedule lives in a `REVIEW_DATA` drawer in the file (`org-fc-review-data-drawer`), and every review is appended to a separate TSV log, `org-fc-reviews.tsv` (`org-fc-review-history-file`). Repo last pushed 2026-01-17. — [org-fc-review-data.el](https://github.com/l3kn/org-fc/blob/main/org-fc-review-data.el), [l3kn/org-fc](https://github.com/l3kn/org-fc)
- Obsidian Spaced Repetition plugin (1.15.4, 2026-06-14): schedule is "stored in an HTML comment for that card", e.g. `<!--SR:!2024-08-16,51,230-->`, on the line after the card; note-level scheduling goes in YAML front matter. No review log in the note. — [OSR docs: data storage](https://github.com/st3v3nmw/obsidian-spaced-repetition/blob/master/docs/docs/en/data-storage.md)
- Other Obsidian SRS plugins (search snippets): "Come Through" warns that rating on two devices while offline leaves the sync service to pick one version and advises one device at a time; "Decks" detects sync-provider conflict copies and "applies any unique entries" from them. — [Come Through plugin](https://community.obsidian.md/plugins/come-through), [Decks plugin](https://community.obsidian.md/plugins/decks)
- Pentive's schema has a `review` table (id, cardId, created, rating, kind, details) separate from the card table. — [Pentive shared/sql/init.sql](https://github.com/AlexErrant/Pentive/blob/main/shared/sql/init.sql)
- RemNote users report cross-device queue inconsistencies ("queue positions not being updated across all platforms"); no documented merge policy found. — [RemNote forum: sync-related issues](https://forum.remnote.io/t/documenting-the-zombie-rems-and-sync-related-issues/)

### Inferences
- An append-only review log with unique ids is a grow-only set: union is commutative, associative and idempotent, so it merges without conflict under git (as lines), under a CRDT library or under any file sync that keeps both sides. Anki, org-fc and Pentive all keep such a log; I found no SRS tool that documents it in CRDT terms.
- With FSRS-style schedulers the card's memory state can be recomputed by replaying the merged log in timestamp order, which resolves the "reviewed on both devices" case exactly instead of picking a winner. Anki does not do this on sync (it keeps the latest state); the design is available to any tool that keeps the log.
- A schedule stored as lines under each card, merged by git with format-aware rules, is in the same position as the Obsidian plugin: it needs a rule for the both-sides-changed case. A review log next to it turns that rule into "union the log, recompute".

### Gaps
- Mochi: no documentation or forum statement found on conflict handling.
- RemNote: no official description of its sync merge.
- I did not confirm whether any Anki developer has commented on replaying the log at sync time.

## 7. What moving the source of truth from Markdown to SQLite loses and gains

### Takeaway
SQLite's own guidance supports it as an application file format; the costs are loss of text-level interoperability and diffing, and a file that cannot be handed to a file-sync service or to git as a merge unit.

### Cited Findings
- sqlite.org: "SQLite is often used as the on-disk file format for desktop applications."; "Updates happen automatically as application content is revised so the File/Save menu option becomes superfluous." It also recommends loading data into an in-memory SQLite database for sifting and sorting ("often easier and quicker"). — [SQLite: Appropriate Uses](https://sqlite.org/whentouse.html)
- Corruption modes relevant to file sync: copying a database mid-transaction ("The backup copy then might contain some old and some new content, and thus be corrupt."); "Copying a database file without also copying its journal."; moving or deleting a hot journal. The page names network filesystems, not Dropbox or iCloud. — [SQLite: How To Corrupt](https://sqlite.org/howtocorrupt.html)
- Logseq's database version had to add a "Markdown Mirror" export to give users on-disk text back, and its two-way form was unshipped as of May 2026. — [What's New with Logseq DB, May 16th 2026](https://discuss.logseq.com/t/whats-new-with-logseq-db-may-16th-2026/35020)
- Logseq's stated costs of Markdown as truth: whole-file rewrite per block edit, mass rewrites on rename, no persistent ids or timestamps. — [Logseq forum: Why the database version](https://discuss.logseq.com/t/why-the-database-version-and-how-its-going/26744)
- A CRDT-replicated database must be written only through the extension: a write without it loaded leaves replicated tables inconsistent. — [Corrosion: CRDTs](https://superfly.github.io/corrosion/crdts.html)
- Anki's collection is one SQLite file; AnkiWeb caps it (250 MB uncompressed per a forum thread, search snippet) and a schema change forces a one-way full transfer. — [Anki forum: collection size limit](https://forums.ankiweb.net/t/anki-collection-nearing-the-100mb-size-limit/41353), [anki meta.rs](https://github.com/ankitects/anki/blob/main/rslib/src/sync/collection/meta.rs)

### Inferences
- Gained with SQLite as truth: atomic multi-row writes, indexed queries without a startup parse, one schema for every platform.
- Lost: opening and editing decks in any text editor; line diffs and history in git; three-way text merge; resilience to partial damage (a bad Markdown file loses one deck, a corrupt page can cost a database). Sync must then be a database-level protocol (CRDT extension, changesets or a server), since two diverged `.sqlite` files cannot be merged by git or by a file-sync service, which will keep one or produce a conflict copy.
- The gains are available without moving the truth, by deriving a local SQLite index from the files (section 5). The losses are not recoverable once the database is canonical, as Logseq's Markdown Mirror work shows.

### Gaps
- No first-party SQLite statement specifically about iCloud Drive or Dropbox; the corruption mechanism is inferred from the copy-during-transaction and separated-journal rules.

## 8. Case study: Pentive (the commenter's Anki clone)

### Takeaway
Pentive does use cr-sqlite, on a 2023 version, in a browser-only app that has never had a release and has had no commits since March 2025. It is a prototype of the approach, not evidence that the approach holds up in production.

### Cited Findings
- Repo created 2022-08-30; last commit 2025-03-15; zero releases; 43 stars; one contributor with 2,437 commits (442 in 2022, 1,060 in 2023, 688 in 2024, 221 in 2025, none in 2026). Seven issues ever filed, one of them "How to login?". GitHub API, 2026-11-05 — [AlexErrant/Pentive](https://github.com/AlexErrant/Pentive)
- Storage and sync dependencies of the client app: `@vlcn.io/crsqlite-wasm` 0.12.0, `@vlcn.io/sync-p2p` 0.10.0, `@vlcn.io/wa-sqlite`, `@vlcn.io/xplat-api` 0.11.0, plus `dexie` (IndexedDB), `sql.js` and `kysely`. Upstream crsqlite-wasm went on to 0.16.0 (2023-12-16), so Pentive is pinned four minor versions behind an already-frozen library. — [Pentive app/package.json](https://github.com/AlexErrant/Pentive/blob/main/app/package.json), [npm: @vlcn.io/crsqlite-wasm](https://www.npmjs.com/package/@vlcn.io/crsqlite-wasm)
- Sync is browser-to-browser over PeerJS/WebRTC with a signalling server ("PeerServer that establishes p2p connections between Pentive apps for syncing client-side databases"). Server-side sync of per-user SQLite files was written off: "Abandoning in favor of p2p syncing. May resurrect later." — [Pentive design-decisions/README.md](https://github.com/AlexErrant/Pentive/blob/main/design-decisions/README.md), [design-decisions/backend.md](https://github.com/AlexErrant/Pentive/blob/main/design-decisions/backend.md)
- Tables registered as CRDT-replicated: `template`, `remoteTemplate`, `remoteNote`, `media`, `remoteMedia`, `plugin`, `noteBase`, `noteTag`, `noteFieldValue`, `cardBase`. The `review` table is created but is not passed to `crsql_as_crr`. — [Pentive shared/sql/init.sql](https://github.com/AlexErrant/Pentive/blob/main/shared/sql/init.sql), [shared/sql/note.sql](https://github.com/AlexErrant/Pentive/blob/main/shared/sql/note.sql), [shared/sql/card.sql](https://github.com/AlexErrant/Pentive/blob/main/shared/sql/card.sql)
- Full-text search: FTS5 virtual tables with `tokenize='trigram'`, kept current by triggers, over views that pass text through an app-defined `ftsNormalize(...)` function; regex search is a JavaScript function registered into SQLite. — [Pentive shared/sql/init.sql](https://github.com/AlexErrant/Pentive/blob/main/shared/sql/init.sql), [app/src/sqlite/crsqlite.ts](https://github.com/AlexErrant/Pentive/blob/main/app/src/sqlite/crsqlite.ts)
- It is a web app; the native shell is undecided: "Capacitor vs Electron vs Tauri... There will be perf/interop advantages when using SQLite that's on a real file system (compared to IndexedDB for wa-sqlite/crsqlite)." The author's own framing: "The primary author of Pentive, Alex, is _not_ a good architect, designer, or web dev." — [Pentive design-decisions/frontend.md](https://github.com/AlexErrant/Pentive/blob/main/design-decisions/frontend.md), [design-decisions/README.md](https://github.com/AlexErrant/Pentive/blob/main/design-decisions/README.md)
- The README states no maturity level; it describes "A free, open source, local-first, spaced repetition system that works offline" with "p2p syncing". — [Pentive README](https://github.com/AlexErrant/Pentive/blob/main/README.md)

### Inferences
- In Pentive, card rows merge by cr-sqlite's per-column counter rule, so a card reviewed on two peers keeps one peer's schedule values per column. As far as the schema shows, the review log is not replicated through cr-sqlite at all, which is weaker than Anki's merged revlog.
- The requirement that drove its choices ("works in web browser") is the one a Tauri app does not have. Its design note concedes native SQLite on a real file system would perform better than its own stack.
- Pentive needed a custom normalisation function and the trigram tokenizer to make FTS5 usable for card text, which matches the Arabic findings in section 10.

### Gaps
- I found no blog post or retrospective by the author on how cr-sqlite sync or FTS worked out.
- I did not trace whether reviews are synced by a path other than `crsql_as_crr`, nor run the app to judge usability.

## 9. The "client-side state needs relational joins" claim, for nested documents

### Takeaway
Joins matter when entities live in separate normalised tables, as in Anki's note type → note → card → revlog. When cards are nested in a deck file and held as parsed objects, the parent-child relation is the document structure and the queries are in-memory filters measured in milliseconds.

### Cited Findings
- Anki's schema is four normalised tables (`notes`, `cards`, `revlog`, plus `col`), related by `cards.nid` and `revlog.cid`, with indexes `ix_cards_nid`, `ix_cards_sched (did, queue, due)` and `ix_revlog_cid`. — [anki schema11.sql](https://github.com/ankitects/anki/blob/main/rslib/src/storage/schema11.sql)
- sqlite.org itself recommends the derived route for analysis: it is "often easier and quicker to load the data into an in-memory SQLite database" to sift and sort. — [SQLite: Appropriate Uses](https://sqlite.org/whentouse.html)
- File-based tools answer such queries from a derived structure: Obsidian from its IndexedDB metadata cache, Logseq OG from an in-app database parsed from Markdown, org-fc from an in-Emacs cache (`org-fc-cache.el`) over Org files. — [Obsidian forum: large vault load time on mobile](https://forum.obsidian.md/t/unpractical-vault-load-time-for-large-vaults-on-mobile-indexeddb-transactions-are-not-flushed-to-disk/88470), [l3kn/org-fc](https://github.com/l3kn/org-fc)

### Inferences
- Measured in this session: filtering 100,000 in-memory card records for due cards took 1.9 ms against 1.0 ms for the indexed SQL query; both are below perception. The join the commenter has in mind (card → its note → its note type) is a pointer walk when the card object sits inside its parsed deck.
- Joins start to pay when queries cross documents on non-hierarchical keys at scale (every card whose review history shows three lapses in the last month, across all decks) or when an ad hoc query language is exposed to the user. A derived SQLite or DuckDB index answers those without becoming the source of truth.
- The elimination argument (PouchDB, Couchbase Mobile, Realm, LevelDB, LiteDB out; SQLite left) is sound for choosing an embedded database. It assumes the client state must be a database, which is the point in dispute.

### Gaps
- No published comparison of in-memory object queries against SQLite for an SRS workload was found; the numbers are mine.

## 10. Anki search and FTS5 facts for a notes app with Arabic text

### Takeaway
The commenter is right that Anki does not use FTS: unqualified search is `LIKE '%term%'` over the notes table. Out of the box, FTS5 does not do what an Arabic vocabulary vault needs: every built-in tokenizer fails to match unvocalised queries against vocalised text.

### Cited Findings
- Anki builds unqualified text search as `let text = format!("%{text}%");` and `"({sfld_expr} like ?{arg_idx} escape '\\' or {flds_expr} like ?{arg_idx} escape '\\')"`. Regex search uses SQLite's `regexp` with `(?i)`; word-boundary search wraps the term in `\b…\b` and reuses the regex path; `nc:` (ignore combining characters) runs `process_text(n.flds, …)` then `like`. No `MATCH` or FTS anywhere in the file. — [anki rslib/src/search/sqlwriter.rs](https://github.com/ankitects/anki/blob/main/rslib/src/search/sqlwriter.rs)
- Anki's schema defines no FTS virtual tables; indexes exist only on usn, note id, scheduling, revlog card id and checksum. — [anki schema11.sql](https://github.com/ankitects/anki/blob/main/rslib/src/storage/schema11.sql)
- Damien Elmes (dae), 2021-04-06, on fuzzy search: "It's not practical to search through large collections without an index for fast access." and "FTS is one possibility, but it will require some research to see if it's a good fit." No later decision found. — [Anki forum: handling typos using fuzzy search](https://forums.ankiweb.net/t/handling-typos-using-fuzzy-search/9017)
- Reported speed: a user with over 100,000 cards saw the browser take 5–6 s to open after an update; a reply said a 1-million-card test collection opens in under 3 s (search snippet; this is browser open time, not a pure text query). — [Anki forum: default browser search](https://forums.ankiweb.net/t/default-browser-search-to-current-card-note-only/17863)
- FTS5 tokenizers: `unicode61` (default), `ascii`, `porter`, `trigram`. `unicode61` defines tokens by Unicode category with no word segmentation for any script; `remove_diacritics` is 0, 1 (default) or 2. `trigram` supports substring matching and can index `LIKE`/`GLOB`, but "Substrings consisting of fewer than 3 unicode characters do not match any rows", and "The index cannot be used to optimize LIKE patterns if the LIKE operator has an ESCAPE clause." — [SQLite FTS5](https://sqlite.org/fts5.html)
- Index size, SQLite's own test on 1,636 MiB of email: "the FTS index was 743 MiB on disk with detail=full, 340 MiB with detail=column and 134 MiB with detail=none." — [SQLite FTS5](https://sqlite.org/fts5.html)
- Availability: enabled in rusqlite's bundled build and in the official WASM build. — [libsqlite3-sys build.rs](https://github.com/rusqlite/rusqlite/blob/master/libsqlite3-sys/build.rs), [sqlite/ext/wasm/GNUmakefile](https://github.com/sqlite/sqlite/blob/master/ext/wasm/GNUmakefile)

### Inferences
Measured in this session (SQLite 3.53.1, FTS5, in-memory):
- `unicode61` treats Arabic vowel marks as separators. The vocalised word كِتَابٌ is indexed as the fragments ك, ت, اب; a search for unvocalised كتاب does not find it, and مدرسة does not find مَدْرَسَةٌ. `remove_diacritics 2` does not change this (it covers Latin-range marks), and adding category `Mn` to the token classes keeps the marks inside the token, so the vocalised and bare forms still differ.
- `trigram` fails the same way: the bare query's trigrams do not occur in the vocalised text. `trigram remove_diacritics 1` fixed café/cafe but not Arabic.
- CJK: `unicode61` indexes an unspaced run as one token (日本語 inside 日本語のテキスト is not found); `trigram` finds three-character substrings but not two-character words such as 学校.
- Consequence: full-text search over Arabic with tashkeel needs the text normalised (marks stripped) before indexing and before querying, in either design: a second normalised column or view feeding FTS5 (what Pentive does with `ftsNormalize`), a custom tokenizer, or an ICU build. This is application work that SQLite does not do for you, and the same normalisation makes a plain in-memory substring search work.
- Anki's `LIKE` choice is consistent with its features: substring, wildcard, regex and combining-mark-insensitive search over HTML fields are not expressible as token matches. In my test a `LIKE '%…%'` scan over 100,000 short card bodies took 37 ms, so the scan is not slow at flashcard sizes on current hardware; Anki's reported slowness correlates with very large fields and the browser table, per the forum threads.
- Size overhead in my test: Markdown 37.6 MB, SQLite table plus FTS5 index 59.7 MB.

### Gaps
- No maintainer statement found that gives the reason FTS was not adopted; regex, HTML fields, Unicode handling and legacy are my reading of the code, not a quoted rationale.
- No documented per-query timing for Anki text search at 100,000+ notes.
- ICU tokenizer availability in rusqlite's bundled build was not checked (the bundled flags I saw do not include ICU).

## 11. Other projects named in the thread: gulpereel, incremental-everything, so3

### Takeaway
incremental-everything is an active RemNote plugin that stores its schedule inside RemNote's own database; gulpereel and the "so3" effort could not be found or opened.

### Cited Findings
- incremental-everything (bjsi): a RemNote plugin "Heavily inspired by SuperMemo's Incremental Reading" that interleaves flashcards with notes, PDFs, websites and video. It "stores repetition data as powerup properties on the Rem", i.e. in RemNote's knowledge base through the plugin SDK; its items "aren't 'normal' RemNote flashcards". README cites v0.2.182; repo pushed 2026-11-04; 74 stars. It is bound by SDK limits (no programmatic PDF scroll control). — [bjsi/incremental-everything](https://github.com/bjsi/incremental-everything)
- gulpereel: `https://codeberg.org/990575519/gulpereel` returned "Not found" to an unauthenticated request on 2026-11-05, and the Codeberg API reported no such user. — [codeberg.org/990575519/gulpereel](https://codeberg.org/990575519/gulpereel)

### Inferences
- incremental-everything has no storage or sync design of its own; it inherits RemNote's proprietary database and cloud sync, so it is not evidence for or against SQLite/CRDT.
- The gulpereel repository is private, renamed or removed, or the address in the thread is wrong.

### Gaps
- gulpereel's "script file based" storage: unverifiable, repository not reachable.
- "so3" (open-source SuperMemo-alternative community effort): two searches returned nothing identifying it; no site, repo or forum found. Its storage approach and status are unknown.
