# App-level and service sync without git: how note, reference and spaced-repetition apps do it

All pages were read on 2026-11-05 unless a different date is given. "Source code" findings are from the `main`/`master` branch on that date, read through a summarising fetch tool, so function names and constants are as reported by that tool. Forum material is marked "(forum report)". Anything I know only from background knowledge and could not confirm on a fetched page is in a Gaps list, not in Cited Findings.

## 1. SiYuan: the "data repo" (dejavu) and sync to S3 / WebDAV / official cloud

### Takeaway
SiYuan syncs by taking a git-like snapshot of the whole workspace (content-defined chunks, zstd, AES-GCM), then exchanging whole-snapshot indexes with a dumb object store under a time-based lock file; conflicts are resolved per file (one version wins, the loser is copied to local history and optionally a conflict document), with no content merge. Third-party S3/WebDAV sync is a paid one-time feature (US$64) and the official cloud is capped at 8 GB.

### Cited Findings
**Object model**
- dejavu is "the component of data snapshot and sync for SiYuan"; features listed are git-like version control, file deduplication in chunks, data compression, AES encryption, and cloud sync and backup. It does not support folders (empty directories), permission attributes or symbolic links. Design is based on ArtiVC. Licence AGPL-3.0. — [dejavu README](https://github.com/siyuan-note/dejavu)
- Entities: every entity has a 40-hex-character ID (README says SHA-1). `Index` = a file list with fields `memo`, `created`, `files`, `count`, `size`; each index operation creates a new index. `File` = `path`, `size`, `updated`, `chunks`, created when path or content changes. `Chunk` = raw data. `Ref`: `latest` points to the newest index; `tag` refs point to a chosen index. — [dejavu README](https://github.com/siyuan-note/dejavu)
- Repo layout (the same layout is used locally and in the bucket): `indexes/<id>`, `objects/<first 2 hex chars>/<remaining chars>`, `refs/latest`, `refs/tags/...`, plus `check/indexes/` and `indexes-v2.json`. — [dejavu README](https://github.com/siyuan-note/dejavu); [store.go](https://raw.githubusercontent.com/siyuan-note/dejavu/main/store.go); [sync.go](https://raw.githubusercontent.com/siyuan-note/dejavu/main/sync.go)
- Index IDs are random (`util.RandHash()`), not content-derived; chunk IDs are `util.Hash(chunk data)`. — [repo.go](https://raw.githubusercontent.com/siyuan-note/dejavu/main/repo.go)

**Snapshotting and chunking**
- Indexing walks the data folder, skipping dot-files, `*.tmp`, hidden and non-regular files and a gitignore-style ignore list; each file is recorded with size and mtime in milliseconds (`entity.NewFile(p, info.Size(), info.ModTime().UnixMilli())`). After chunking a file it re-stats it; if the stamp changed the index attempt fails with `ErrIndexFileChanged` and is retried up to 7 times. Changed files are chunked on a pool of 4 workers. — [repo.go](https://raw.githubusercontent.com/siyuan-note/dejavu/main/repo.go)
- Chunking uses `github.com/restic/chunker` with a fixed polynomial (`chunker.Pol(0x3DA3358B4DC173)`). Files smaller than `chunker.MinSize` are stored as one chunk; larger files are split with `chunker.NewWithBoundaries(reader, pol, chunker.MinSize, chunker.MaxSize)`. — [repo.go](https://raw.githubusercontent.com/siyuan-note/dejavu/main/repo.go)
- restic's chunker: "Chunker splits content with Rabin Fingerprints"; `MinSize = 512 * kiB`, `MaxSize = 8 * miB`, split mask `(1 << 20) - 1` ("aim to create chunks of 20 bits or about 1MiB on average"), sliding window 64 bytes. — [restic/chunker chunker.go](https://raw.githubusercontent.com/restic/chunker/master/chunker.go)

**Compression and encryption**
- Chunks and File objects go through `encodeData`: zstd compress (`SpeedDefault`, window 512 KiB, CRC off), then `encryption.AesEncrypt(data, store.AesKey)`. Indexes are compressed only: source comment "Index 仅压缩，不加密" (index is compressed, not encrypted). — [store.go](https://raw.githubusercontent.com/siyuan-note/dejavu/main/store.go)
- `AesEncrypt` is AES-GCM (`cipher.NewGCM`) with a random 12-byte nonce prepended to the ciphertext; the AES variant is whatever the supplied key length implies (the function does not fix it). — [siyuan-note/encryption aes.go](https://raw.githubusercontent.com/siyuan-note/encryption/main/aes.go)

**Sync, step by step (`Repo.Sync`)**
- 1) Fetch cloud `refs/latest` (reject IDs that are not 40 chars) and the index it names. For S3 and the official cloud it also reads sequence-numbered refs `refs/latest-<seq>-<id>` and, if they disagree with `refs/latest`, takes the one with the newer `Created` time. A missing ref is tolerated (uninitialised cloud). — [sync.go](https://raw.githubusercontent.com/siyuan-note/dejavu/main/sync.go)
- 2) If cloud latest ID equals local latest ID, return without locking (comment: reduces remote requests on no-change syncs). — [sync.go](https://raw.githubusercontent.com/siyuan-note/dejavu/main/sync.go)
- 3) Take the cloud lock (below). 4) Download File objects the local store lacks (pooled, concurrency from `cloud.GetConcurrentReqs()`); fail with `ErrCloudStorageSizeExceeded` if the quota is too small. — [sync.go](https://raw.githubusercontent.com/siyuan-note/dejavu/main/sync.go)
- 5) Compute two diffs against the last-synced snapshot (`refs/latest-sync`): local upserts/removes = diff(local latest, latest-sync); cloud upserts/removes = diff(cloud latest, local latest). — [sync.go](https://raw.githubusercontent.com/siyuan-note/dejavu/main/sync.go)
- 6) Per path, `classifySyncFileVersions` groups Base/Local/Cloud versions and `decideSyncFile` picks a `Winner` and a `HistoryFile`; the conflict type named in the code is `ConflictTypeLocalUpsertCloudUpsert`. Special case: if the only local change to a `.sy` document is fold state (`fold`, `heading-fold`), the cloud version wins silently. — [sync.go](https://raw.githubusercontent.com/siyuan-note/dejavu/main/sync.go)
- 7) Losing versions are checked out to `TempPath/repo/sync/conflicts/<now>` and copied to `HistoryPath/<now>-sync/<relPath>`; failure raises `ErrCloudGenerateConflictHistory`. Conflict details are returned to the app in `mergeResult.Conflicts`. — [sync.go](https://raw.githubusercontent.com/siyuan-note/dejavu/main/sync.go)
- 8) Apply cloud upserts/removes to the working tree. 9) If both sides changed, create a merge index (memo "[Sync] Cloud sync merge"); if only the cloud changed, adopt the cloud index. — [sync.go](https://raw.githubusercontent.com/siyuan-note/dejavu/main/sync.go)
- 10) Upload chunks the cloud lacks, then File objects, to `objects/<2>/<rest>`; then upload `indexes/<id>`, then `refs/latest` (the order matters, per a comment citing issue 10111); for S3/official cloud also write `refs/latest-<seq>-<id>` and delete old sequence refs; update `indexes-v2.json`. — [sync.go](https://raw.githubusercontent.com/siyuan-note/dejavu/main/sync.go)
- 11) Integrity: a "check index" (`check/indexes/<id>`) and a server-side missing-object report (`check/indexes-report`, re-upload of missing objects, `EvtCloudCorrupted` event if still missing) exist only for the official cloud; the code says S3 and WebDAV skip this. — [sync.go](https://raw.githubusercontent.com/siyuan-note/dejavu/main/sync.go)

**Cloud lock**
- Lock object key `lock-sync`, JSON `{deviceID, time}` (Unix ms). Acquire = download it; if missing, or older than 65 seconds, or owned by this device, write own lock; otherwise `ErrCloudLocked`. A goroutine rewrites the lock every 30 seconds. `tryLockCloud` makes up to 3 attempts with 5-second waits. Unlock = delete the object (up to 3 tries). The lock write is a plain `UploadObject("lock-sync", true)`; no ETag/If-Match precondition appears in this file. — [sync_lock.go](https://raw.githubusercontent.com/siyuan-note/dejavu/main/sync_lock.go)

**Pricing and limits (official pricing page, 2026-11-05)**
- Free: local use, "Basic functions". "PRO Features": US$64 one-time ("Pay once, use for life"; $96 struck through) unlocks third-party S3 and WebDAV sync and backup; no storage included; Nutstore WebDAV not supported. Subscription: US$148 ($296 struck through) includes 8 GB official cloud storage, all PRO features, cloud asset hosting, cloud inbox, official sync and backup. Official storage is capped at 8 GB because of traffic cost; larger needs are directed to third-party S3. "Refunds are not available after subscribing." The table labels the subscription "Lifetime" while the FAQ calls it an annual subscription; the page does not resolve this. — [SiYuan pricing](https://b3log.org/siyuan/en/pricing.html)
- "Data synchronization through third-party synchronization disks is not supported, otherwise data may be corrupted"; connecting third-party cloud storage is a member privilege. Notebooks store documents as `.sy` JSON files; assets live in `assets/`. — [SiYuan README](https://raw.githubusercontent.com/siyuan-note/siyuan/master/README.md)

**Reliability reports**
- (forum report, c. Oct 2025) A user editing the same document on two devices at once saw one edit vanish "without a trace" in one test; in a second test a conflict was reported and "a separate page was created". Sequential syncs a few seconds apart were reliable. — [liuyun.io: Resolving sync conflicts](https://liuyun.io/article/1760119215104)
- (forum report, Nov 2023) WebDAV sync against Koofr failed with HTTP 423; the SiYuan developer attributed it to too many requests in a short time and recommended S3 over WebDAV for performance and stability. — [liuyun.io: WebDav Koofr](https://liuyun.io/article/1699218950147)
- (forum report, 2023) The developers said they would not shorten the automatic sync interval; a "Sync perception" option under Settings > Cloud improves automatic sync when several devices are online, and F9 triggers a sync. — [liuyun.io: Faster syncing?](https://liuyun.io/article/1689223905758)
- Release notes record sync bugs fixed over time: v2.9.2 "repeated generation of conflict files" and a warning that mixed app versions make cloud indexes overwrite each other; v2.10.14 "Notebook data may be corrupted during data synchronization"; v2.12.4 data loss during sync on Android 14. — [v2.9.2](https://newreleases.io/project/github/siyuan-note/siyuan/release/v2.9.2); [v2.10.14](https://newreleases.io/project/github/siyuan-note/siyuan/release/v2.10.14); [v2.12.4](https://newreleases.io/project/github/siyuan-note/siyuan/release/v2.12.4)
- (third-party plugin issue) A plugin author advises enabling the option "Generate conflict documentation when syncing conflicts" and closing the editor tab on one device before editing on another because the app sometimes fails to refresh after sync. — [siyuan-jsdraw-plugin issue 9](https://git.boxo.cc/massivebox/siyuan-jsdraw-plugin/issues/9)

### Inferences
- The design is "git without git": one linear chain of whole-workspace snapshots, a three-way file-level comparison against the last-synced snapshot, and a merge snapshot. It needs only GET/PUT/DELETE/LIST on the remote, which is why it runs on S3 and WebDAV.
- The lock is advisory and time-based (read, then unconditional write). Two devices that both see "no lock" within the same moment can both proceed; the design relies on that window being small and on the sequence-numbered `latest` refs as a second check. This is the main correctness weakness of a bucket-only design that does not use conditional writes.
- Conflict resolution is whole-file: a `.sy` document (one file per note) edited on two devices is not merged; one side wins and the other goes to history or a conflict document. ilmi's existing format-aware line merge is stronger than this.
- Large files: a 300 MB PDF becomes roughly 300 chunks of about 1 MiB (512 KiB to 8 MiB each), uploaded once and deduplicated by content hash; a changed PDF re-uploads only changed chunks. The cost is that the bucket holds opaque chunks, not readable files, and every device needs the full local repo plus the working copy unless assets are deferred.
- With E2EE, chunk and file objects are opaque to the provider, but the index (snapshot ID list, counts, sizes, memo, timestamps) is only compressed.

### Gaps
- Which side wins in `decideSyncFile` (newer `updated` time, or cloud) was not visible in the fetched excerpt; I could not find the official documentation of the "generate conflict document" setting or its default.
- I could not confirm whether `UploadObject(..., true)` is conditional on any backend; the `cloud` package was not read.
- The automatic sync interval, and whether "sync perception" uses a WebSocket to the official cloud only, were not confirmed from primary sources.
- The key size actually passed to AES (and the key derivation from the user's passphrase) was not confirmed.
- I found no 2025–2026 GitHub issue specifically documenting S3-target corruption; the reliability evidence above is older or anecdotal.

## 2. Joplin: sync-target abstraction

### Takeaway
Joplin treats every backend as a flat file store (create/update/delete/list) and layers its own locks, per-item timestamps and polling on top; conflicts are never merged — the remote version replaces the local one and the local copy is moved to a "Conflicts" notebook. It is the clearest example of the "protocol over dumb storage" pattern and of its costs: list-everything delta on WebDAV, slow first syncs, and a 10 MB attachment ceiling on mobile.

### Cited Findings
- Sync targets listed: Joplin Cloud, Nextcloud, S3, WebDAV, Dropbox, OneDrive, local filesystem; the design "avoids hard dependencies on any one service". — [Joplin sync overview](https://joplinapp.org/help/apps/sync/)
- Vocabulary: clients; a sync target ("the location where the data is going to be saved"); items (notes, notebooks, tags, resources). Clients upload local changes "within a few seconds" of being made, which "helps limit conflicts"; "every few minutes" each client polls the target and applies changes; a deleted item is removed from the target and "eventually deleted from each device too". `Synchronizer.ts` does download, upload and deletions and encrypts/decrypts when E2EE is on. A local `sync_items` table stores per-item `sync_time` per sync target; `sync_disabled` marks items that can never sync (blocked by Dropbox, over a Joplin Cloud limit). File API drivers (`file-api-driver-*.ts`) provide create, update, delete, list. — [Joplin sync spec](https://joplinapp.org/help/dev/spec/sync); [source copy](https://raw.githubusercontent.com/laurent22/joplin/dev/readme/dev/spec/sync.md)
- `info.json` on the target holds `version`, `e2ee`, `activeMasterKeyId`, `masterKeys`, `ppk`, `appMinVersion`; properties carry `updatedTime` and conflicts between clients on the same property are resolved by "heuristics" (`syncInfoUtils.ts`). — [Joplin sync spec](https://joplinapp.org/help/dev/spec/sync)
- Locks: two types, SYNC (many allowed) and EXCLUSIVE (one, for target upgrades). Lock files are named `<lockType>_<clientType>_<clientId>.json`; the algorithm relies on the filename and the file's timestamp, the content is informational. A holder refreshes every X seconds, a lock expires after Y seconds (X < Y; values not given on the page). To avoid races a client acquires the lock and then restarts the check procedure; with multiple exclusive locks the oldest wins, ties broken by lowest client ID. An expired lock invalidates the operation in progress; the client must cancel. — [Joplin sync lock spec](https://joplinapp.org/help/dev/spec/sync_lock)
- Joplin Server delta: clients call `/api/files/delta` with a `cursor` that "essentially represents a point in time"; events are create/update/delete, compressed (two updates become one, create+delete becomes nothing). Update events older than 180 days are compressed to the latest; a client with an expired cursor gets `resyncRequired` and must do a full sync. The fallback is `basicDelta()`, "the approach used for file system and WebDAV sync, which compares server and client contents directly", which "can't reliably enumerate server content if items change during the process". The page describes a planned migration to a `changes_3` table around November 2026 that would force clients with old cursors to fully resync. — [Joplin Server delta sync spec](https://joplinapp.org/help/dev/spec/server_delta_sync)
- Conflicts: a conflict arises when "one note or one attachment is modified in two different places, and then synchronised". Joplin creates a "Conflict" notebook, copies the local note into it, and the remote note replaces the local one. The user compares and copies changes by hand; note history ("Previous versions of this note") can restore the pre-sync version. Advice: sync before and after editing. — [Joplin conflict help](https://joplinapp.org/help/apps/conflict)
- E2EE format: header "JED" + 2-hex version; metadata of 6-hex length, 2-hex encryption method, 32-hex master key ID; data is split into "one or more chunks for performance reasons", each with a 6-hex length, ASCII-encoded because React Native crypto functions "can only deal with strings". Master keys are encrypted with the user's password and synced with the data. Items are encrypted at serialisation for sync and decrypted in the background by a DecryptionWorker. — [Joplin E2EE spec](https://joplinapp.org/help/dev/spec/e2ee)
- Attachments: "Attachment download behaviour" is Always (default), Manual (download when clicked) or Auto (download when the note is opened). "Resources larger than 10 MB are not currently supported on mobile" — they can crash the app during sync. Orphaned resources are deleted per the note-history settings. — [Joplin attachments help](https://joplinapp.org/help/apps/attachments)
- S3 target is labelled "S3 (Beta)"; tested providers include AWS, Backblaze, Cloudflare R2, DigitalOcean, Linode, Scaleway, UpCloud, Tebi; recommended settings include disabling bucket versioning. — [Joplin S3 help](https://joplinapp.org/help/apps/sync/s3)
- Joplin Cloud (2026-11-05): Basic 2.99 €/month (2.40 € billed yearly), 2 GB, 10 MB per note or attachment; Pro 5.99 €/month (4.79 € yearly), 30 GB, 200 MB per note or attachment; Teams 7.99 €/user/month, 50 GB, 200 MB. — [Joplin plans](https://joplinapp.org/plans/)
- (forum reports) A user with 150k items reported that WebDAV sync lists every file in the sync directory, so large item counts are slow; on mobile all attachments are fetched by default; a developer said resource data dominates initial sync time. A GitHub PR thread measured about 200 MB taking from roughly 17 minutes to over an hour over WebDAV depending on server. — [Discourse 48036](https://discourse.joplinapp.org/t/so-which-synchronization-method-should-i-choose/48036); [Discourse 37895](https://discourse.joplinapp.org/t/android-sync-not-working-webdav-target-and-150k-items/37895); [Discourse 498](https://discourse.joplinapp.org/t/performance-with-large-collection/498); [PR 4668](https://github.com/laurent22/joplin/pull/4668)

### Inferences
- Joplin shows the minimum a dumb-storage protocol needs: a driver interface of four operations, a local table of per-item sync times, a lock directory, and a settings file. That is cheap to build but it gets delta sync only where the backend offers one (Joplin Server cursor; Dropbox/OneDrive APIs); elsewhere it lists the whole target on every poll.
- Item-per-file with last-writer detection and a Conflicts notebook is weaker than ilmi's current line-level merge; adopting Joplin's model would be a regression in conflict quality.
- Joplin's locks are, like SiYuan's, timestamp-based files rather than atomic compare-and-swap; the "acquire, then re-check" step narrows but does not close races.
- Whole-file upload of each attachment, a 10 MB mobile limit and a 200 MB cloud limit make this model unsuited to a multi-GB PDF library without chunking.

### Gaps
- The exact on-target layout (I believe each item is `<id>.md` at the root, attachment bytes under `.resource/`, with `locks/`, `.sync/` and `temp/` directories) and the lock TTL/refresh values were not stated on the pages fetched; treat as unconfirmed.
- Which ciphers the current E2EE methods use was not stated on the spec page (it defers to `EncryptionService.ts`).
- What Joplin does when a note is deleted on one device and edited on another was not on the conflict page.
- The poll interval options in the app settings were not confirmed (spec says "every few minutes").

## 3. Obsidian Sync and the third-party routes Obsidian users take

### Takeaway
Obsidian Sync is a vendor-run, per-file, end-to-end-encrypted service over WebSocket that three-way-merges Markdown (diff-match-patch) and uses last-modified-wins for everything else; its limits (200 MB per file, 10 GB extendable to 100 GB) are below what a textbook library needs. The do-it-yourself routes each fail in a characteristic way on iOS: iCloud works only Apple-to-Apple and evicts files, Syncthing cannot run continuously, plugins sync only while the app is open.

### Cited Findings
**Obsidian Sync**
- Plans (2026-11-05): Sync Standard US$4/user/month billed annually or $5 monthly — 1 synced vault, 1 GB total, 5 MB max file size, 1 month version history. Sync Plus $8/month annually or $10 monthly — 10 vaults, 10 GB total, 200 MB max file size, 12 months version history, "upgradable to 100 GB". — [obsidian.md/sync](https://obsidian.md/sync); [Sync plans help](https://obsidian.md/help/sync/plans)
- The 100 GB upgrade price is not on the live pages; the launch post (20 March 2024) says "Storage on the Sync Plus plan can be increased to 100 GB for $16 per month, billed annually." Confirmed only for March 2024. — [Obsidian blog: Standard plan](https://obsidian.md/blog/standard-plan/)
- Encryption: AES-256-GCM with scrypt + salt key derivation. End-to-end is the default ("the data is encrypted from the moment it leaves your device"); a "standard" option has Obsidian hold the key. Servers are on DigitalOcean in Singapore, Frankfurt, San Francisco and Sydney, chosen by IP at setup. The debug line reads "Host server: wss://sync-xx.obsidian.md". Metadata not hidden from the server includes which device uploaded or deleted a file and when. A lost encryption password cannot be recovered. — [Sync security help](https://obsidian.md/help/sync/security)
- Conflicts: "Markdown files: Obsidian Sync merges the changes using Google's diff-match-patch algorithm." "For all other files, including canvases, Obsidian uses a 'last modified wins' approach." Settings JSON files are merged by applying "keys from the local JSON on top of the remote JSON". Since Obsidian 1.9.7 a per-device option "Create conflict file" writes a separate conflict file instead of merging (the original keeps the remote version); default is "Automatically merge". — [Sync troubleshooting help](https://obsidian.md/help/sync/troubleshoot)
- Edge case documented by the vendor: if a note is created locally and Sync downloads a remote version of the same note within a couple of minutes, "Sync will keep the remote version without merging the two"; recovery is via the File recovery plugin. — [Sync troubleshooting help](https://obsidian.md/help/sync/troubleshoot)
- Selective sync: per-device toggles for images, audio, videos, PDFs, and "Sync all other types"; excluded folders; hidden files are never synced except `.obsidian`. Sync settings "do not sync across devices", so a phone can exclude PDFs while a Mac includes them. Excluding a folder does not delete what is already in the remote vault. — [Sync settings help](https://obsidian.md/help/sync/settings)
- (forum reports) Threads exist titled "Obsidian Sync incorrectly duplicates sections of files" and "Obsidian Sync: rename duplicates; portions of text duplicated", i.e. the automatic Markdown merge can duplicate text. — [forum 94732](https://forum.obsidian.md/t/obsidian-sync-incorrectly-duplicates-sections-of-files/94732/95); [forum 91606](https://forum.obsidian.md/t/obsidian-sync-rename-duplicates-portions-of-text-duplicated/91606)

**Vendor's own guidance on other methods**
- iCloud Drive: supported for macOS/iOS/iPadOS only; "iCloud Drive on Windows may lead to file duplication or corruption"; on mobile the vault must be inside the Obsidian app folder in iCloud Drive; on macOS 15+ set the folder to "Keep Downloaded", on macOS 14 and earlier disable "Optimize Mac Storage". "Avoid syncing the same vault across multiple services". — [Obsidian help: Sync your notes across devices](https://obsidian.md/help/sync-notes)
- OneDrive and Google Drive are "not officially supported for syncing Obsidian vaults on iOS"; on desktop, vault folders must be kept always-available (no Files On-Demand / offloading). Dropbox appears only in the iOS list of unsupported services. — [Obsidian help: Sync your notes across devices](https://obsidian.md/help/sync-notes)
- Syncthing is listed for Windows/macOS/Linux (not iOS); "keep at least one device on at all times". Git: "syncing isn't automatic. You must manually push and pull changes." Working Copy is the iOS git route. Remotely Save and LiveSync are named for iOS with "these methods aren't officially supported, and results may vary." — [Obsidian help: Sync your notes across devices](https://obsidian.md/help/sync-notes)

**iCloud problems (forum reports, undated unless noted)**
- Duplicated files with numeric suffixes, files stuck "sync pending indefinitely", and placeholder stubs (`.YourNote.md.icloud`) that Obsidian cannot read until downloaded. Most duplicate reports involve iCloud for Windows or running two sync systems at once. — [forum 27138](https://forum.obsidian.md/t/icloud-duplicates/27138); [forum 28320](https://forum.obsidian.md/t/icloud-sync-issues/28320); [forum 48358](https://forum.obsidian.md/t/icloud-on-windows-creates-duplicate-files/48358); [forum 35041](https://forum.obsidian.md/t/icloud-unsyncing-files-and-getting-stuck/35041)

**Syncthing / Möbius Sync on iOS**
- Möbius Sync FAQ: "No iOS app can run continuously in the background"; the app connects only while open, briefly afterwards, or when iOS wakes it; "It may take 24 hours to start to sync" and, once stable, about 1–2 hours of sync activity per day. Free use is capped at 20 MB; a one-time in-app purchase removes the cap. "Pick External Folder" (since v1.23.1) can sync a folder in another app's sandbox under On My iPhone/iPad but "This feature is DANGEROUS. Please use at your own risk." "iCloud is not currently supported." — [Möbius Sync FAQ](https://mobiussync.com/faq/)
- (forum reports) Users script a Shortcut that opens Möbius Sync, waits about 15 seconds, then opens Obsidian, because background running "worked for maybe a day" before iOS froze the app. — [Obsidian forum 72022](https://forum.obsidian.md/t/sync-mac-pc-and-ios-using-syncthing-mobius-sync/72022)

**Remotely Save (plugin)**
- Backends: S3 and compatibles (R2, B2, MinIO), Dropbox, OneDrive App Folder, WebDAV, Webdis (experimental); PRO adds full OneDrive, Google Drive, Box, pCloud, Yandex Disk, Koofr, Azure Blob. Free version detects conflicts and keeps the newer or the larger file (user's choice); PRO "Smart Conflict" merges small Markdown files and duplicates large or non-Markdown files. Optional encryption in openssl or rclone-crypt format. Scheduled sync every N minutes and sync-on-save, only while Obsidian is open; both "fail silently on errors". On mobile, files of 50 MB or more hit Obsidian API performance problems ("Skip Large Files" option). — [remotely-save README](https://github.com/remotely-save/remotely-save)

**Self-hosted LiveSync (plugin)**
- Syncs through CouchDB, or object storage (MinIO, S3, R2), or WebRTC peer-to-peer with a signalling relay; data travels as "chunks and metadata"; supports E2EE; can "automatically merge simple conflicts". Must not be run alongside any other sync (iCloud, Obsidian Sync). Requires running or renting a CouchDB server (guides for Docker, Fly.io, IBM Cloudant). — [obsidian-livesync README](https://github.com/vrtmrz/obsidian-livesync)

### Inferences
- Obsidian Sync is the reference for what a vendor service buys: push over a persistent socket, server-held version history, a merge base for three-way Markdown merges, and per-device file-type filters. None of this is possible on a bare bucket without extra design.
- Its numbers rule it out as a model for ilmi's PDFs unless large files take a separate path: 200 MB per file and 10 GB (100 GB at about $16/month as of 2024) versus textbooks of several hundred MB and a library of several GB.
- "Last modified wins" for non-Markdown files is the industry default for binaries; no surveyed app merges PDFs or handwriting.
- The plugin routes show that an app-level protocol over S3/WebDAV works on iOS only in the foreground; this is an iOS constraint on any app, including a Tauri one, not a plugin defect.

### Gaps
- Obsidian does not publish its wire protocol; "per-file sync over WebSocket" is supported only by the `wss://` host line and the help pages.
- Current (2026) price of the 100 GB add-on is not on public pages.
- Obsidian Git plugin's current iOS reputation was not researched in this pass beyond the vendor's statement that git sync is manual.
- The help page `sync/limitations` no longer exists; limits are taken from the plans and settings pages.

## 4. Anki

### Takeaway
Anki splits sync into a small structured collection (incremental, mergeable, with a forced one-way "full sync" fallback when changes cannot be merged or a sanity check fails) and a separate per-file media channel that is always merged; AnkiWeb caps the collection at 100 MB compressed / 250 MB uncompressed and each media file at 100 MB, and a small self-hosted server ships inside the desktop app.

### Cited Findings
- First sync is one-way (upload or download); afterwards "Anki will be able to merge changes from multiple locations". Automatic sync happens each time the collection is opened or closed (can be disabled). — [Anki manual: Syncing](https://docs.ankiweb.net/syncing.html)
- Merging: reviews and note edits from different devices are combined; if the same card is reviewed in two places both reviews are kept in the revision history and "the card keeps the state from its most recent answer". — [Anki manual: Syncing](https://docs.ankiweb.net/syncing.html)
- Forced one-way sync: "If certain problems are detected while syncing, Anki forces a one-way sync." Changes to the note format (adding a field, removing a card template) "can't be merged"; Anki warns, and at the next sync the user must choose the local or the AnkiWeb copy. The user can also force one direction in preferences. — [Anki manual: Syncing](https://docs.ankiweb.net/syncing.html)
- Protocol as implemented (`normal_sync_inner`): read meta and check size; status check returns `NoChanges`, `FullSyncRequired {upload_ok, download_ok}` or `NormalSyncRequired`; then in one transaction: `start_and_process_deletions` (graves), `process_unchunked_changes`, `process_chunks_from_server`, `send_chunks_to_server`, `sanity_check`, `finalize`. State carries `server_usn` ("latest server usn; local -1 entries will be rewritten to this") and `pending_usn` ("-1 in client case; used to locate pending entries"). On `SanityCheckFailed` the transaction is rolled back, the server is told to abort, and `set_schema_modified()` is called. — [anki rslib/src/sync/collection/normal.rs](https://raw.githubusercontent.com/ankitects/anki/main/rslib/src/sync/collection/normal.rs)
- Media: synced separately. Anki notices files added, removed or replaced in the media folder but not in-place edits. "One-way syncs don't affect media. Media changes are always merged." Deletions sync only once media is fully in sync. — [Anki manual: Syncing](https://docs.ankiweb.net/syncing.html)
- AnkiWeb limits: "Collections on AnkiWeb are limited to a compressed size of 100MB, and an uncompressed size of 250MB"; "the size of individual media files is limited to 100MB"; "there are no limits on the size of your media" in total at the moment. — [Anki FAQ: limits on AnkiWeb](https://docs.ankiweb.net/faqs/are-there-limits-on-file-sizes-on-ankiweb)
- AnkiWeb may delete synced data after 6 months of inactivity, with an email warning and 30 days to respond. — [Anki manual: Syncing](https://docs.ankiweb.net/syncing.html)
- Self-hosted server: bundled with desktop Anki 2.1.57+, also a pip package and a standalone Rust binary (`anki-sync-server`). Configuration is environment variables: `SYNC_USER1=user:pass` (required), `SYNC_BASE` (default `~/.syncserver`), `SYNC_HOST`, `SYNC_PORT`, `MAX_SYNC_PAYLOAD_MEGS` (must be above 100 to raise the upload limit), `PASSWORDS_HASHED`. It serves plain HTTP; users are told to use a LAN, a VPN (Tailscale is named) or an HTTPS reverse proxy. Separate endpoints exist for collection (`/sync/`) and media (`/msync/`). The project favours simplicity for "individual or family use" and says PRs adding a REST API or external databases are unlikely to be accepted. Newer clients may need a newer server. — [Anki manual: Sync server](https://docs.ankiweb.net/sync-server.html)

### Inferences
- Anki's split is directly relevant to ilmi: small, structured, frequently changing data (cards, schedule) goes through a mergeable incremental protocol; large, rarely changing blobs (media) go through a simpler add/remove file channel with no merging and no forced-full-sync semantics.
- Anki's protocol depends on a server that assigns a monotonically increasing update sequence number (USN); this is the "change feed" that a bare bucket lacks.
- The full-sync fallback is the price of a database-shaped collection: when merge is unsafe the user picks a side and loses the other. ilmi's plain-text files with line merge avoid this class of failure.
- Media handling ignores in-place edits by design; an app that annotates PDFs in place could not copy this rule.

### Gaps
- The rule for conflicting edits to the same note (I believe the object with the later modification time wins) is not stated in the pages fetched; the manual only states the review case.
- The media protocol's internals (media USN, zip batches, batch size limits) were not read from source.

## 5. Zotero

### Takeaway
Zotero separates free, unlimited metadata sync through its API (with WebSocket push) from optional attachment-file sync to either paid Zotero Storage or a user's WebDAV server; files can be fetched only when opened. It is the closest precedent for "small data via a service, big PDFs via dumb storage".

### Cited Findings
- "Data syncing is free and unlimited" and covers items, notes, links, tags; it does not include attachment files and can run without file syncing. File syncing is optional and uses Zotero Storage or WebDAV. — [Zotero sync docs](https://www.zotero.org/support/sync)
- Zotero Storage is recommended (group libraries, web access, easier setup); WebDAV "cannot" be used for group libraries and "Zotero developers cannot provide support for third-party WebDAV servers". Zotero appends `/zotero` to the WebDAV URL. — [Zotero sync docs](https://www.zotero.org/support/sync); [Zotero WebDAV services](https://www.zotero.org/support/kb/webdav_services)
- With automatic sync on (default), changes sync "within a few seconds of being made". Conflicts: when the same item or file is changed in conflicting ways before a sync, "you'll receive a conflict resolution dialog asking which version you'd like to keep." — [Zotero sync docs](https://www.zotero.org/support/sync)
- Storage prices (2026-11-05): 300 MB free; 2 GB US$20/year; 6 GB $60/year; unlimited $120/year. — [Zotero storage](https://www.zotero.org/storage)
- Desktop file download modes: "At sync time" (download everything not present at each sync) or "As needed" (download when the user opens the file). — [Zotero sync preferences (raw)](https://www.zotero.org/support/_export/raw/preferences/sync)
- Push: "The Zotero streaming API provides push-based notifications via WebSockets for Zotero library changes" at `wss://stream.zotero.org`; a `topicUpdated` event carries the library and a version number, not data; clients "should use their standard sync process to retrieve data". — [Zotero streaming API](https://www.zotero.org/support/dev/web_api/v3/streaming_api)
- (forum, staff statement, undated) "The iOS app downloads files as needed"; an option to download all files at sync time was planned. (forum reports, later) users running WebDAV on iOS report upload/download failures, including a PDF added on iPhone never reaching the WebDAV server. — [Zotero forum 382216](https://forums.zotero.org/discussion/comment/382216); [Zotero forum 502464](https://forums.zotero.org/discussion/comment/502464); [Zotero forum 418132](https://forums.zotero.org/discussion/comment/418132)
- User-reported free WebDAV providers and their caps: Koofr 10 GB; 4shared 15 GB (max file 2 GB, max 5,000 files per folder, "about 2,500 Zotero attachments"); CloudMe 3 GB (max file 150 MB). — [Zotero WebDAV services](https://www.zotero.org/support/kb/webdav_services)

### Inferences
- The 4shared note (5,000 files per folder ≈ 2,500 attachments) implies Zotero stores two objects per attachment in one flat WebDAV folder; this is consistent with a "one blob plus one small metadata/properties file per attachment" layout.
- Library data has a server-assigned version number (seen in the streaming API); the client syncs "since version N". File bytes are addressed by item and need no merge: a conflict is "pick one".
- Unlimited storage at $120/year is the only flat-price vendor option surveyed that would hold a 50 GB PDF library.

### Gaps
- The exact WebDAV layout (I believe `<itemKey>.zip` plus `<itemKey>.prop`) was not confirmed on a fetched page.
- Whether the current App Store iOS build officially supports WebDAV, and its default download mode, were not confirmed on an official page; the iOS support page says nothing about file sync.

## 6. Other designs worth a paragraph

### Takeaway
The remaining apps add four distinct ideas: block-level peer-to-peer transfer with conflict copies (Syncthing), metadata-first "shallow" sync with on-demand content (DEVONthink), encrypted item sync with manual conflict choice (Notesnook, Standard Notes), and stateful two-way folder reconciliation run from cron (rclone bisync).

### Cited Findings
**Syncthing**
- Files are split into equal blocks whose size "is dependent on the file size and varies from 128 KiB up to 16 MiB"; each block has a SHA-256 hash; a device fetches only differing blocks, from local files with a matching hash or from peers. Changes are found by a filesystem watcher (batched 10 s; deletions delayed 1 minute) plus a full scan hourly by default; a changed file is fully re-read and re-hashed. Writes go to `.syncthing.<name>.tmp` then are moved into place. — [Syncthing: Understanding synchronization](https://docs.syncthing.net/users/syncing.html)
- Conflicts: the file with the older modification time is renamed `<filename>.sync-conflict-<date>-<time>-<modifiedBy>.<ext>`; on equal times the device with the larger device-ID value loses. In modification-versus-deletion, if the deletion wins the modified file is kept as a conflict copy. Conflict copies sync to all devices. — [Syncthing: Understanding synchronization](https://docs.syncthing.net/users/syncing.html)

**rclone bisync**
- Keeps listings of both paths from the prior run and computes New/Newer/Older/Deleted deltas on each side, then propagates. Conflict = changed on both sides and not identical; `--conflict-resolve` default `none` keeps both (renamed with a `conflict` suffix and number); other choices `newer`, `older`, `larger`, `smaller`, `path1`, `path2`; `--conflict-loser delete` is "inherently the most destructive option". Safety: `--max-delete` default 50% aborts the run; `--check-access` requires marker files; `--resync` re-baselines; lock files block concurrent runs. "Rclone does not yet have a built-in capability to monitor the local file system for changes"; bisync "must be blindly run periodically". Described as "an advanced command, so use with care"; added in v1.58. — [rclone bisync](https://rclone.org/bisync/)

**DEVONthink / DEVONthink To Go**
- "A shallow sync allows you to import just the metadata for the files, including the searchable text"; contents are downloaded on demand. "Download Files" can be Always or On Demand per sync location, per database, or per group; shallow sync needs the Pro Pack purchase; shallowly synced files are not reachable from Apple's Files app. — [DEVONtechnologies blog: How to Use Shallow Sync](https://devontechnologies.com/blog/20220531-shallow-sync-devonthink-to-go)
- (forum reports) Sync runs through "sync stores" on Dropbox, CloudKit, WebDAV, or Bonjour; CloudKit reliability reports are mixed, with some users moving to WebDAV on a NAS; duplicates arise from the Conflicts setting or from syncing through more than one path; one thread reports mobile edits overwriting desktop edits without warning. — [Discourse 84558](https://discourse.devontechnologies.com/t/is-cloudkit-reliable-in-2025/84558); [Discourse 80487](https://discourse.devontechnologies.com/t/where-are-all-of-these-duplicates-coming-from/80487); [Discourse 85720](https://discourse.devontechnologies.com/t/loss-whole-days-work-bug/85720)

**Notesnook**
- "A merge conflict happens when two devices edit the same note and then try to sync those changes"; "The changes on both devices must be at least a minute apart for a merge conflict to occur." Conflicted notes appear in a Conflicted group; a side-by-side view shows Current and Incoming with red/green highlights; choices are Keep, Discard, or Save a Copy. No auto-merge: "Notesnook cannot safely figure out which version of the note you want to keep." — [Notesnook help: merge conflicts](https://notesnook.com/help/faqs/what-are-merge-conflicts)

**Standard Notes**
- Plans (2026-11-05): Standard $0; Productivity US$90/year (1 year note history, "Ideal if you're not using files"); Professional $120/year with "100 GB" encrypted file storage and unlimited note history. — [Standard Notes plans](https://standardnotes.com/plans)

**Logseq**
- (forum changelog posts, Jan–Apr 2026, read as search summaries) The DB-version sync engine was rewritten around a worker using Cloudflare D1 for metadata and R2 for snapshots, with end-to-end encryption, sync checksums, "offline conflict resolution with rebase semantics", and custom sync server URLs for self-hosting; graph merge offers last-write-wins, keep-target, and report-conflicts. — [Logseq DB changelog 2026-01-13 to 03-23](https://discuss.logseq.com/t/logseq-db-changelog/30013/35); [changelog 2026-03-23 to 04-26](https://discuss.logseq.com/t/logseq-db-changelog/30013/36)

**Bear, Apple Notes, GoodNotes, Notability**
- (third-party reviews, 2026) Bear syncs only through iCloud and only on its paid tier (about US$2.99/month or $30/year); Apple Notes syncs free through iCloud. — [fabric.so comparison](https://fabric.so/comparison/bear-vs-apple-notes); [rywalker.com Bear research](https://rywalker.com/research/bear-app)

### Inferences
- Syncthing's model (variable fixed-size blocks, SHA-256, temp-file-then-rename, older-mtime-loses with a conflict copy) is the best-documented design for large-file transfer, and its conflict rule is what users of "folder sync" products have come to expect.
- DEVONthink's shallow sync is the pattern ilmi needs for iPhone: sync names, metadata and extracted text for every PDF, and fetch bytes on open, with a per-folder "always keep" override.
- Notesnook's one-minute rule shows a common shortcut: treat near-simultaneous edits as non-conflicting and let the later write win; ilmi's simultaneous-use case is exactly where that loses data.

### Gaps
- No official source was read for Standard Notes' conflict behaviour (I believe it creates a "conflicted copy" note), Bear's CloudKit conflict handling, Nextcloud client conflict naming (the docs URL returned 404), or DEVONthink's sync-store encryption (the manual returned 403).
- Logseq Sync storage limits and prices were not confirmed; findings rest on forum changelog summaries.
- GoodNotes and Notability cloud sync are assigned to another researcher; nothing reliable was gathered here.

## 7. The file-provider route on Apple platforms, and whether it works from Tauri

### Takeaway
A third-party iOS app can be given durable read/write access to a user-chosen folder via the document picker and a security-scoped bookmark, but the provider behind the folder decides whether folder picking is offered, when files are downloaded or evicted, and when syncing runs; the app gets no merge base and no control. Tauri v2's stock dialog plugin does not support folder picking on iOS, so this route needs a custom Swift plugin.

### Cited Findings
- Since iOS 13 "users can select a directory from any of the available file providers using a UIDocumentPickerViewController. The document picker returns a security-scoped URL for the directory." The URL "lets your app recursively access the directory and all of its contents, which includes accessing any new items you add to the directory in the future"; the app can enumerate, add, remove and modify files. — [Apple: Providing access to directories](https://developer.apple.com/documentation/uikit/providing-access-to-directories)
- Required steps: call `startAccessingSecurityScopedResource()`; "Use a file coordinator to perform read or write operations on the URL's contents"; call `stopAccessingSecurityScopedResource()`. URLs obtained by enumerating are also security-scoped. To keep access across launches, save the URL as a `minimalBookmark` and resolve it later, handling the stale flag. — [Apple: Providing access to directories](https://developer.apple.com/documentation/uikit/providing-access-to-directories)
- Users can revoke access at any time in Settings > Privacy > Files and Folders; "your app must be ready to handle failures when accessing a directory's content", especially with saved bookmarks. — [Apple: Providing access to directories](https://developer.apple.com/documentation/uikit/providing-access-to-directories)
- (Apple developer forum, 2019–2023) Developers reported that with the folder type only Apple's providers (On My iPad, iCloud Drive, USB, SMB) were selectable; Box, Dropbox, Google Drive were greyed out. Reports recur in 2020, 2021 and July 2023. In December 2023 the developer of a git client replied that folder picking from third-party locations is possible when the provider supports it, and that since iOS 16 providers built on `NSFileProviderReplicatedExtension` get it with less work. No statement in the thread names which mainstream providers now allow it. — [Apple forum thread 120257](https://developer.apple.com/forums/thread/120257)
- Obsidian's own conclusion for iOS: iCloud Drive is the only OS-level provider it supports; OneDrive and Google Drive are "not officially supported for syncing Obsidian vaults on iOS", and on desktop any on-demand/offloading feature must be turned off for the vault. — [Obsidian help: Sync your notes across devices](https://obsidian.md/help/sync-notes)
- (forum/plugin reports) iCloud can replace files with placeholder stubs (`.Name.md.icloud`) that an app reading plain paths cannot open until downloaded; files can sit "sync pending indefinitely"; duplicates with numeric suffixes appear. — [Obsidian forum 28320](https://forum.obsidian.md/t/icloud-sync-issues/28320); [Obsidian forum 27138](https://forum.obsidian.md/t/icloud-duplicates/27138)
- (Apple developer forum) Developers report that `startDownloadingUbiquitousItem` gives no error callback and that `NSMetadataQuery` is unreliable for monitoring download progress or detecting a file missing from iCloud. — [Apple forum 826061](https://developer.apple.com/forums/thread/826061); [Apple forum 708515](https://developer.apple.com/forums/thread/708515)
- Tauri v2 dialog plugin: the platform table lists iOS and Android as "Does not support folder picker"; "On iOS, a `file://<path>` URIs are returned" for picked files. — [Tauri dialog plugin](https://v2.tauri.app/plugin/dialog/)
- A community crate, `tauri-plugin-fs-ios` (v0.4.0, Feb 2025), only exposes the app's own Documents directory; no Tauri plugin for security-scoped bookmarks or iCloud containers was found. — [lib.rs: tauri-plugin-fs-ios](https://lib.rs/crates/tauri-plugin-fs-ios)
- Möbius Sync (a Syncthing client) can sync a folder in another app's sandbox only under On My iPhone/iPad, flags it "DANGEROUS", and states "iCloud is not currently supported". — [Möbius Sync FAQ](https://mobiussync.com/faq/)

### Inferences
- The route is feasible only for iCloud Drive in practice (Apple-specific, which the user ruled out) or for providers that implement folder picking; Dropbox/Google Drive/OneDrive support for folder bookmarks is unverified and historically absent.
- Even where it works, the app inherits the provider's conflict behaviour (duplicate files such as "name 2.md" or "conflicted copy") and cannot run its own format-aware merge, because the provider resolves or duplicates before the app sees both versions. ilmi's schedule-in-file data would be exposed to whole-file last-writer-wins.
- Multi-hundred-MB PDFs behind an evicting provider mean the app must detect placeholders and trigger downloads through coordinated reads; from Rust this means Swift FFI for `NSFileCoordinator`, bookmark resolution and download requests — a custom Tauri plugin, since plain `std::fs` paths will not materialise evicted files reliably.
- An app's own iCloud ubiquity container would be simpler than a picked folder but is Apple-only and has the same eviction and duplicate behaviour.

### Gaps
- No Apple documentation page on ubiquity containers, eviction policy or `NSFileVersion` conflict versions was successfully read in this pass; the statements above on iCloud behaviour rest on vendor help pages and forum reports.
- Whether Dropbox, Google Drive or OneDrive's iOS file providers allow folder selection in iOS 18/26 was not verified.
- Whether a provider syncs a bookmarked folder while the third-party app is in the background, and with what delay, is provider-specific and undocumented in the sources read.

## 8. A small sync server versus a bucket

### Takeaway
A server adds three things a bucket lacks — an atomic "commit if nobody else did", an ordered change feed, and push — and the surveyed bucket-based apps get by with time-based lock files and polling. Conditional writes now supply the first of these on AWS S3, Cloudflare R2 and MinIO, but not verifiably on Backblaze B2, and never on generic WebDAV as these apps use it.

### Cited Findings
- AWS S3: `If-None-Match: *` (create only if absent) and `If-Match: <ETag>` (overwrite only if unchanged) are supported on PutObject, CompleteMultipartUpload and CopyObject. Failure is `412 Precondition Failed`; "If multiple conditional writes or copies occur for the same object name, the first write operation to finish succeeds"; concurrent requests can also return `409 Conflict` (retry) and, for `If-Match` after a concurrent delete, `404`. `If-Match` requires `s3:PutObject` and `s3:GetObject`; requests must use Signature V4. Conditional writes ignore in-progress multipart uploads. — [AWS S3: conditional writes](https://docs.aws.amazon.com/AmazonS3/latest/userguide/conditional-writes.html)
- Cloudflare R2: PutObject supports `If-Match`, `If-None-Match`, `If-Modified-Since`, `If-Unmodified-Since`; "These conditions are evaluated atomically, as part of the same write that commits the object"; concurrent creates on an absent key let at most one succeed, the others get `412 PreconditionFailed`. Destination-side conditional CopyObject headers (`cf-copy-destination-if-*`) are beta. A `NoSuchKey` read "is not proof that a prior write failed if that write's outcome is unknown." — [Cloudflare R2: S3 API extensions](https://developers.cloudflare.com/r2/api/s3/extensions/)
- Backblaze B2: the S3-compatible API page lists unsupported features (ACLs, IAM roles, object tagging, website configuration, browser POST uploads) and says nothing about conditional writes. A Proxmox Backup Server patch (July 2025) skips the `If-None-Match` header for B2 because B2 rejects PUT requests carrying it. Secondhand; not confirmed by Backblaze documentation. — [Backblaze S3-compatible API docs](https://www.backblaze.com/docs/cloud-storage-s3-compatible-api); [Proxmox pbs-devel patch](https://lists.proxmox.com/pipermail/pbs-devel/2025-July/014234.html)
- MinIO: vendor blog says conditional writes use "optimistic concurrency control using the If-Match and If-None-Match HTTP headers with S3-compatible uploads". (secondhand, 2026) An issue report describes conditional PUTs being allowed through under read-quorum failure. — [MinIO blog](https://www.min.io/blog/leading-the-way-minios-conditional-write-feature-for-modern-data-workloads); [MinIO issue 21653 (task mirror)](https://hub.harborframework.com/tasks/abundant/minio__minio-21653)
- How bucket designs manage without CAS: SiYuan uses a `lock-sync` object with a 65-second staleness rule and 30-second refresh, plus sequence-numbered `refs/latest-<seq>-<id>` objects compared by creation time. — [dejavu sync_lock.go](https://raw.githubusercontent.com/siyuan-note/dejavu/main/sync_lock.go); [dejavu sync.go](https://raw.githubusercontent.com/siyuan-note/dejavu/main/sync.go)
- Joplin uses lock files identified by filename and file timestamp with acquire-then-recheck and oldest-wins tie-breaking. — [Joplin sync lock spec](https://joplinapp.org/help/dev/spec/sync_lock)
- What servers provide in the surveyed apps: Joplin Server — a delta endpoint with cursor and compressed create/update/delete events; Zotero — library version numbers and a WebSocket notifying `topicUpdated`; Anki — a server USN, a transaction with sanity check, and separate collection/media endpoints, in a single binary configured by environment variables; Obsidian — a `wss://` host, version history and server metadata to "determine the version history for a file". — [Joplin Server delta spec](https://joplinapp.org/help/dev/spec/server_delta_sync); [Zotero streaming API](https://www.zotero.org/support/dev/web_api/v3/streaming_api); [Anki sync server](https://docs.ankiweb.net/sync-server.html); [Obsidian Sync security](https://obsidian.md/help/sync/security)
- WebDAV in practice: a Koofr WebDAV server returned HTTP 423 to SiYuan under request bursts, and the developer recommended S3 instead; DEVONtechnologies says WebDAV implementations vary so compatibility cannot be guaranteed; Zotero does not support third-party WebDAV servers. — [liuyun.io Koofr thread](https://liuyun.io/article/1699218950147); [DEVONthink Discourse 82344](https://discourse.devontechnologies.com/t/new-to-devonthink-seeking-advice-on-sync-storage/82344); [Zotero sync docs](https://www.zotero.org/support/sync)

### Inferences
- With `If-Match` on a single small "head" object (the pointer to the latest snapshot or manifest), a bucket gives a true compare-and-swap: read head + ETag, upload new immutable content-addressed objects, then PUT head with `If-Match`; on 412, re-fetch, merge, retry. This removes the lock file and its timing races and is the one improvement over SiYuan's and Joplin's designs that 2024–2026 object stores make possible. It would work on S3, R2 and MinIO; B2 would need a fallback (lock file) or be unsupported.
- A bucket still gives no push and no change feed. A client must poll the head object (one Class B/GET request per poll; at one poll per 30 seconds per device that is about 86,000 requests per device per month, well inside R2's 10 million free Class B requests) or add a tiny notifier (for example a Cloudflare Worker/Durable Object WebSocket, or silent push) purely as a "something changed" signal, as Zotero's streaming API does.
- A minimal own server (Anki-style single binary) is small to write but must be hosted, secured (TLS, auth) and kept version-compatible with clients; a bucket moves all logic into the client, which suits a single-user app across 2–3 devices and keeps user-supplied storage possible.
- WebDAV has ETags and optional locking in the standard, but none of the surveyed apps rely on them, and vendors report inconsistent servers; treating WebDAV as a second-class backend (lock file plus polling) matches industry practice.

### Gaps
- Official Backblaze confirmation of conditional-write support (or lack of it) on either its S3-compatible or native API was not found.
- No primary source was read for WebDAV conditional requests (`If-Match` on PUT, `LOCK`) or for which popular servers (Nextcloud, Hetzner Storage Box) honour them.
- MinIO's own reference documentation for conditional writes was not read; the finding rests on a vendor blog.

## 9. Object-storage economics for a 5–50 GB personal library

### Takeaway
At 5–50 GB every usage-priced bucket costs well under US$1.50 per month and R2 and B2 are free up to 10 GB; egress is free on R2 and Wasabi and effectively free on B2 for this workload. The flat-rate options (Hetzner Storage Box at €3.20/month for 1 TB, Wasabi at a 1 TB minimum) are oversized but give WebDAV or simple pricing; vendor sync services cost more and cap file sizes.

### Cited Findings
- Cloudflare R2 Standard: US$0.015 per GB-month; Class A operations $4.50 per million; Class B $0.36 per million; egress free. Free tier per month: 10 GB-month storage, 1 million Class A, 10 million Class B. Infrequent Access: $0.01 per GB-month, retrieval $0.01 per GB, not in the free tier. — [Cloudflare R2 pricing](https://developers.cloudflare.com/r2/pricing/)
- Backblaze B2: storage "starts at $6.95/TB/month" (billed per byte-hour); first 10 GB free; egress free up to 3× average monthly storage, then $0.01/GB; Class A, B and C API calls free for pay-as-you-go; Class D calls $0.004 per 10,000 with the first 2,500 per day free. — [Backblaze B2 pricing](https://www.backblaze.com/cloud-storage/pricing)
- AWS S3: official page confirms GET requests from S3 Standard at $0.0004 per 1,000 (US East), the first 100 GB/month of data transfer out to the internet free across AWS, and that new customers since 15 July 2025 get up to $200 in free-tier credits (free plan lasts 6 months). — [AWS S3 pricing](https://aws.amazon.com/s3/pricing/)
- AWS S3 Standard storage at $0.023 per GB-month (first 50 TB, us-east-1), PUT/COPY/POST/LIST at $0.005 per 1,000, and egress at $0.09 per GB after the free 100 GB are reported consistently by third-party 2026 guides; the official table did not load in my fetch. — [Upstash: AWS S3 pricing explained (2026)](https://upstash.com/blog/aws-s3-pricing-explained-2026); [CloudForecast S3 pricing guide](https://www.cloudforecast.io/blog/aws-s3-pricing-and-optimization-guide)
- Wasabi: pay-as-you-go from $7.99 per TB/month; minimum charge tied to 1 TB active storage per account; 90-day minimum storage duration; "No charge for egress or API requests". — [Wasabi pricing](https://wasabi.com/pricing)
- Hetzner Storage Box (excl. VAT): BX11 1 TB €3.20/month; BX21 5 TB €10.90; BX31 10 TB €20.80; BX41 20 TB €40.60. Protocols on all plans: FTP/FTPS, SFTP, SCP, Samba/CIFS, BorgBackup, Restic, Rclone, rsync over SSH, HTTPS, WebDAV. Unlimited traffic; 10 concurrent connections; 10 snapshots on BX11; locations Germany or Finland. — [Hetzner Storage Box](https://www.hetzner.com/storage/storage-box/)
- Vendor services for comparison: Obsidian Sync Plus $8/month (annual) for 10 GB, 200 MB per file; Joplin Cloud Pro 5.99 €/month for 30 GB, 200 MB per attachment; Zotero unlimited $120/year, 6 GB $60/year; SiYuan official cloud capped at 8 GB; Standard Notes Professional $120/year with 100 GB files. — [obsidian.md/sync](https://obsidian.md/sync); [Joplin plans](https://joplinapp.org/plans/); [Zotero storage](https://www.zotero.org/storage); [SiYuan pricing](https://b3log.org/siyuan/en/pricing.html); [Standard Notes plans](https://standardnotes.com/plans)

### Inferences
- Monthly storage cost by my arithmetic from the rates above: 5 GB — R2 $0, B2 $0, S3 about $0.12; 20 GB — R2 $0.15 (10 GB billable), B2 about $0.07, S3 about $0.46; 50 GB — R2 $0.60, B2 about $0.28, S3 about $1.15. Wasabi is about $7.99 regardless (1 TB minimum); Hetzner BX11 €3.20 regardless.
- Request costs are negligible at this scale if objects are chunked at about 1 MiB or larger: uploading 50 GB as 1 MiB chunks is about 51,000 Class A requests, inside R2's 1 million free and free on B2.
- Egress matters only on AWS: restoring a 50 GB library to a new device is inside the 100 GB free monthly allowance; doing so on three devices in one month would bill roughly 50 GB at $0.09 = $4.50. On B2 the 3× rule gives 150 GB free at 50 GB stored.
- R2 is the strongest fit for an app-level protocol: free egress, documented atomic conditional writes, generous free operations. B2 is cheapest for storage but lacks confirmed conditional writes. Hetzner is the cheap WebDAV/SFTP option but offers no object-store semantics and 10 concurrent connections.
- Typical self-hosting (a NAS or small VPS running MinIO, WebDAV or CouchDB) costs hardware and upkeep rather than fees, and reaching it from outside the home needs a VPN or public endpoint, as the Anki server docs note.

### Gaps
- AWS S3's storage, PUT and egress rates are from third-party pages, not the official table.
- Wasabi's fair-use egress policy was not stated on the page read.
- Self-hosting costs (VPS prices, NAS options) were not priced from primary sources.

## 10. Conflict handling across these apps (same item edited on two devices; deletes)

### Takeaway
Only Obsidian Sync (Markdown) and Anki (card/note records) merge automatically; nearly everyone else keeps both versions or lets the newest win, and no app merges binary files. Delete-versus-edit is rarely documented; where it is, the edit is preserved as a copy.

### Cited Findings
- Obsidian Sync: Markdown merged with diff-match-patch; all other files "last modified wins"; settings JSON key-merged with local over remote; optional per-device "Create conflict file"; a newly created note that collides with a remote note within a couple of minutes is replaced by the remote version without merging. — [Obsidian Sync troubleshooting](https://obsidian.md/help/sync/troubleshoot)
- SiYuan: per-file winner chosen; the loser is copied to local history under `<timestamp>-sync`; conflict details are reported to the app (users report a separate conflict document being created); fold-only local changes yield to the cloud. — [dejavu sync.go](https://raw.githubusercontent.com/siyuan-note/dejavu/main/sync.go); [liuyun.io: Resolving sync conflicts](https://liuyun.io/article/1760119215104)
- Joplin: remote version replaces local; local copy moved to the Conflict notebook; manual reconciliation. Deletes propagate: removed from the target, then "eventually deleted from each device too". — [Joplin conflict help](https://joplinapp.org/help/apps/conflict); [Joplin sync spec](https://joplinapp.org/help/dev/spec/sync)
- Anki: reviews and note edits from different devices are merged; a card reviewed twice keeps both log entries and the state of the most recent answer; note-type (schema) changes cannot be merged and force the user to choose one side wholesale; media changes are always merged, and media deletions sync only once media is fully in sync. Deletions travel first in the protocol as "graves". — [Anki manual: Syncing](https://docs.ankiweb.net/syncing.html); [anki normal.rs](https://raw.githubusercontent.com/ankitects/anki/main/rslib/src/sync/collection/normal.rs)
- Zotero: a dialog asks which version of the item or file to keep. — [Zotero sync docs](https://www.zotero.org/support/sync)
- Notesnook: no auto-merge; side-by-side Keep / Discard / Save a Copy; edits less than a minute apart do not raise a conflict. — [Notesnook help](https://notesnook.com/help/faqs/what-are-merge-conflicts)
- Syncthing: older-mtime file renamed to `.sync-conflict-...`; in modify-versus-delete, a winning delete still leaves the modified file as a conflict copy. — [Syncthing docs](https://docs.syncthing.net/users/syncing.html)
- rclone bisync: default keeps both, renamed with a conflict suffix; optional newer/older/larger/smaller/path1/path2; aborts if more than 50% of files would be deleted. — [rclone bisync](https://rclone.org/bisync/)
- Remotely Save: free tier keeps newer or larger; paid tier merges small Markdown files and duplicates large or non-Markdown files. — [remotely-save README](https://github.com/remotely-save/remotely-save)
- Self-hosted LiveSync: "Automatically merge simple conflicts". — [obsidian-livesync README](https://github.com/vrtmrz/obsidian-livesync)
- iCloud Drive / OS providers as experienced by Obsidian users: duplicate files with numeric suffixes rather than merges. — [Obsidian forum 27138](https://forum.obsidian.md/t/icloud-duplicates/27138)
- Joplin Server delta: a client may receive a delete for a file it does not have and must treat it as a no-op; create and delete events are kept indefinitely so new clients build state correctly. — [Joplin Server delta spec](https://joplinapp.org/help/dev/spec/server_delta_sync)

### Inferences
- Summary table (from the findings above):
  - Merge: Obsidian Sync (Markdown, text-level three-way), Anki (record-level), LiveSync (simple cases), Remotely Save PRO (small Markdown).
  - Keep both: Joplin (Conflicts notebook), SiYuan (history / conflict doc), Syncthing (conflict copy), rclone bisync default, Notesnook (user choice), iCloud/Dropbox-style providers (duplicate files).
  - Newest wins: Obsidian Sync for non-Markdown, Remotely Save free ("newer" option), Notesnook within one minute, Anki card state.
  - Ask the user: Zotero, Notesnook, Anki on schema change (whole collection).
- ilmi's current git-based, format-aware merge (cards as lines, schedule data in files) is already at or beyond the best of these for text. The thing to copy from them is not conflict logic but transport: chunked blob storage, on-demand download, and change notification. Any replacement transport should keep a per-file merge base (the last-synced version), as SiYuan's `latest-sync` and git do, so the existing merge can still run.
- Deletes need tombstones or a base snapshot: Anki uses graves, Joplin Server keeps delete events forever, SiYuan and rclone diff against the last-synced snapshot. A design with neither cannot distinguish "deleted there" from "created here".
- For PDFs and handwriting pages, the realistic policy across the industry is last-modified-wins plus keeping the loser as a version or copy; if ilmi stores annotations and ink as separate small text-like files instead of rewriting the PDF, those can use the mergeable path.

### Gaps
- Delete-versus-edit behaviour is undocumented for Obsidian Sync, Joplin, Zotero and SiYuan in the sources read.
- The exact SiYuan winner rule and Anki's same-note edit rule are not confirmed (see sections 1 and 4).

## 11. Change notification: how apps learn another device changed something

### Takeaway
Vendor services push over a persistent WebSocket (Obsidian, Zotero); everything running on dumb storage polls on a timer or on app events, and on iOS nothing runs reliably in the background.

### Cited Findings
- Obsidian Sync: clients connect to a `wss://sync-xx.obsidian.md` host. — [Obsidian Sync security](https://obsidian.md/help/sync/security)
- Zotero: WebSocket at `wss://stream.zotero.org` sends `topicUpdated` with a version; clients then run a normal sync; local changes sync "within a few seconds". — [Zotero streaming API](https://www.zotero.org/support/dev/web_api/v3/streaming_api); [Zotero sync docs](https://www.zotero.org/support/sync)
- Joplin: uploads within a few seconds of a local change; polls the target "every few minutes"; with Joplin Server the poll is a cheap delta call with a cursor, on file/WebDAV targets it compares full listings. — [Joplin sync spec](https://joplinapp.org/help/dev/spec/sync); [Joplin Server delta spec](https://joplinapp.org/help/dev/spec/server_delta_sync)
- Anki: syncs automatically when the collection is opened or closed, otherwise on the sync button. — [Anki manual: Syncing](https://docs.ankiweb.net/syncing.html)
- SiYuan: a no-change sync costs one read of `refs/latest` (plus the sequence refs) and returns before locking; (forum, 2023) the developers declined to shorten the automatic interval and point to a "Sync perception" setting and manual F9. — [dejavu sync.go](https://raw.githubusercontent.com/siyuan-note/dejavu/main/sync.go); [liuyun.io: Faster syncing?](https://liuyun.io/article/1689223905758)
- Syncthing: filesystem watcher with 10-second batching (deletes delayed 1 minute), hourly full scan, direct device-to-device connections. — [Syncthing docs](https://docs.syncthing.net/users/syncing.html)
- Remotely Save: every N minutes and on save, only while Obsidian is open. — [remotely-save README](https://github.com/remotely-save/remotely-save)
- rclone bisync: no watcher; run from cron. — [rclone bisync](https://rclone.org/bisync/)
- iOS background: "No iOS app can run continuously in the background"; Möbius Sync gets about 1–2 hours of sync activity per day at times iOS chooses. — [Möbius Sync FAQ](https://mobiussync.com/faq/)

### Inferences
- For 2–3 devices used at the same time, the practical recipe on a bucket is: sync on app foreground, shortly after each local save (debounced a few seconds, as Joplin does), and poll a single head object every 15–60 seconds while in the foreground. A no-change poll is one conditional GET, as in SiYuan's early exit.
- True push needs some always-on endpoint. The cheapest addition is a notify-only channel that carries no user data (so E2EE is unaffected), mirroring Zotero's split between "notification" and "sync".
- On iPad/iPhone, sync effectively happens when the app is opened; designs must tolerate a device being hours or days stale, which again argues for keeping a merge base per file rather than newest-wins.

### Gaps
- Exact default poll intervals for Joplin and SiYuan were not found in primary documentation.
- Whether Obsidian Sync uses silent push on iOS to wake the app was not documented in the sources read.
- Dropbox/OneDrive/Google Drive change-notification APIs (long-poll, webhooks, delta tokens) were not researched in this pass.
