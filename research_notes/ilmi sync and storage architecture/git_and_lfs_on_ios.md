# Git (+LFS and alternatives) as the sync transport for a binary-heavy personal vault on Mac, iPad and iPhone

State as of 2026-11-05. Every web page cited was fetched on 2026-11-05 unless a different date is given; where a source is older or the claim could only be confirmed for an earlier date, that is flagged inline. "Local inspection" means I read the crate sources that ilmi actually builds against (`git2 0.20.4`, `libgit2-sys 0.18.8+1.9.7`, per `/Users/mehtan/foundry/projects/ilmi/src-tauri/Cargo.lock`) in the local cargo registry; the docs.rs link given is the same published crate version, not a page I fetched.

Reading guide: "Cited Findings" are sourced. "Inferences" are my reasoning from those findings (and, where marked "background knowledge", things I believe but did not verify in this session). "Gaps" are things I could not confirm.

---

## 1. Host limits (GitHub, GitLab.com, Codeberg, Bitbucket, self-hosted Forgejo/Gitea)

### Takeaway
On every commercial host, plain git cannot hold the PDFs (GitHub hard-blocks objects over 100 MiB and pushes over 2 GB; Bitbucket Free caps the whole workspace at 1 GB), so "several GB of textbooks" means LFS or an external object store. GitHub Free/Pro include 10 GiB LFS storage and 10 GiB/month download bandwidth with a 2 GB per-file LFS cap, metered beyond that (last confirmed price: $0.07/GiB-month storage, $0.0875/GiB download, June 2024); GitLab.com Free gives 10 GiB per project including LFS and goes read-only beyond it; Codeberg is unsuitable (100 MB private content); self-hosted Forgejo/Gitea has no built-in limits and can put LFS on S3/MinIO.

### Cited Findings

**GitHub — plain git**
- "If you attempt to add or update a file that is larger than 50 MiB, you will receive a warning from Git." / "GitHub blocks files larger than 100 MiB." / browser uploads: "the file can be no larger than 25 MiB." / "To track files beyond this limit, you must use Git Large File Storage (Git LFS)." — [About large files on GitHub](https://docs.github.com/en/repositories/working-with-files/managing-large-files/about-large-files-on-github)
- Repository size: "We recommend repositories remain small, ideally less than 1 GB, and less than 5 GB is strongly recommended." The page says hard limits exist for file and repository sizes but gives no numeric repository hard limit. — [About large files on GitHub](https://docs.github.com/en/repositories/working-with-files/managing-large-files/about-large-files-on-github)
- A separate "Repository limits" page gives: on-disk size (`.git` folder) "10 GB" as a recommended maximum; push size "This limit is enforced at 2GB."; single object size "The recommended maximum limit is 1MB." and "This is enforced at 100 MB."; directory width 3,000 entries and 5,000 branches as recommendations. — [Repository limits](https://docs.github.com/en/repositories/creating-and-managing-repositories/repository-limits)

**GitHub — Git LFS**
- Maximum LFS file size by plan: GitHub Free "2 GB", GitHub Pro "2 GB", GitHub Team "4 GB", GitHub Enterprise Cloud "5 GB". "If you exceed the per-file limit of 5 GB, the file will be rejected by Git LFS with an error message." — [About Git Large File Storage](https://docs.github.com/en/repositories/working-with-files/managing-large-files/about-git-large-file-storage)
- Included quota per month: Free 10 GiB bandwidth / 10 GiB storage; Pro 10 GiB / 10 GiB; Team 250 GiB / 250 GiB; Enterprise Cloud 250 GiB / 250 GiB. — [Git LFS billing](https://docs.github.com/en/billing/concepts/product-billing/git-lfs)
- Metering: "Bandwidth is billed for each GiB of data downloaded. Storage is billed by calculating an hourly usage rate." (GiB-hours divided by hours in the month; the page's example is 1,080 GiB-hours / 720 h = 1.5 GiB-months.) Uploads are not billed as bandwidth. — [Git LFS billing](https://docs.github.com/en/billing/concepts/product-billing/git-lfs)
- Price beyond quota: the current billing page lists no dollar figure and says "To estimate costs for paid Git LFS usage, use the GitHub pricing calculator." The last official statement of a price I could fetch is the 2024-06-03 changelog (written for new Enterprise accounts on metered billing): "storage for Git LFS files will cost $0.07 per GiB per month (USD)" and "download bandwidth will cost $0.0875 per GiB per month (USD)". **Confirmed only as of June 2024.** — [Git LFS billing](https://docs.github.com/en/billing/concepts/product-billing/git-lfs); [GitHub changelog 2024-06-03](https://github.blog/changelog/2024-06-03-new-enterprise-accounts-have-metered-billing-for-git-lfs/)
- Quota exhausted: storage with no payment method — you can still clone but "You will not be able to push new files back up."; bandwidth with no payment method — "Git LFS support is disabled on your account until the next month."; with a $0 budget — "You are not charged for overages, but Git LFS usage is blocked for the rest of the calendar month."; with the budget deleted — "There is no spending limit, and you are billed for all usage beyond the free quota." — [Git LFS billing](https://docs.github.com/en/billing/concepts/product-billing/git-lfs)
- Older GitHub pages still on the web cite 1 GiB free storage/bandwidth and $5 "data packs"; these predate the metered model and are outdated. — [search summary of help.github.com / older docs pages](https://help.github.com/en/articles/upgrading-git-large-file-storage)

**GitLab.com**
- "Repository size including LFS - Free": "10 GiB"; Premium and Ultimate: "500 GiB". Maximum push size "5 GiB" ("`git push` and GitLab project imports are limited to 5 GiB for each request through Cloudflare."). No separate LFS per-file maximum is listed. — [GitLab.com settings](https://docs.gitlab.com/user/gitlab_com/)
- "Each project in a Free tier namespace on GitLab.com has 10 GiB of free storage." "Only the project's repository and LFS are included in the storage limit." "If no purchased storage is available, the project is set to a read-only state." "You cannot push changes to a read-only project." The page gives no price (points to the pricing page). — [Storage usage quotas](https://docs.gitlab.com/user/storage_usage_quotas/)
- "Git LFS clients use HTTP Basic authentication, and communicate with your server over HTTPS." — [GitLab Git LFS](https://docs.gitlab.com/topics/git/lfs/)

**Codeberg**
- For private repositories: "we allow up to **100 MB of private content** for your convenience." ("Use it for your personal notes, your side project or any other you want to keep private."); "If you do not contribute to any free/libre software project at all, Codeberg is unfortunately not the right place for you."; resources must be requested first above "750 MiB for Git storage" and "1.5 GiB of packages, LFS and attachments"; Codeberg objects to use for "media backups". — [Codeberg FAQ](https://docs.codeberg.org/getting-started/faq/)

**Bitbucket Cloud**
- "workspaces on a Free plan have a size limit of 1GB of total repository storage within the workspace."; "We recommend repositories be kept under 2.0 GB"; "Bitbucket Cloud repositories have a 4.0 GB limit. When that limit is reached, you will only be able to push changes that undo the latest commits."; pushes of files of 100 MB or more are blocked by a default-on setting. — [Reduce repository size](https://support.atlassian.com/bitbucket-cloud/docs/reduce-repository-size/)
- LFS storage included: Free 1 GB, Standard 5 GB, Premium 10 GB; overage is added automatically in 100 GB blocks ("Your monthly bill goes up $10."). — [Storage policy for Git LFS with Bitbucket](https://support.atlassian.com/bitbucket-cloud/docs/storage-policy-for-git-lfs-with-bitbucket/)
- "there's no limit on the LFS file size you can push to Bitbucket Cloud."; "Bitbucket Cloud does not support Git LFS lock functionality."; a repository admin can delete LFS files from the repo. — [Current limitations for Git LFS with Bitbucket](https://support.atlassian.com/bitbucket-cloud/docs/current-limitations-for-git-lfs-with-bitbucket/)

**Self-hosted Forgejo / Gitea**
- Forgejo stores LFS under an `[lfs]` section; `STORAGE_TYPE` "can be `local` (the default) for file system directories or `minio` for S3 servers."; `MINIO_ENDPOINT` (default `localhost:9000`), `MINIO_BUCKET` (default `forgejo`), `MINIO_BASE_PATH`, `MINIO_ACCESS_KEY_ID`, `MINIO_SECRET_ACCESS_KEY`, `MINIO_LOCATION`, `MINIO_USE_SSL`; `SERVE_DIRECT` (default `false`) "Allows the storage driver to redirect to authenticated URLs to serve files directly." ("Only supported via signed URLs."). — [Forgejo storage settings](https://forgejo.org/docs/latest/admin/setup/storage/)
- Gitea `[server]` LFS settings as shown on the cheat sheet: `LFS_START_SERVER` (shown default `false`: "Enables Git LFS support."), `LFS_JWT_SECRET`, `LFS_HTTP_AUTH_EXPIRY` default `24h` ("LFS authentication validity period in time.Duration, pushes taking longer than this may fail."), `LFS_MAX_FILE_SIZE` default `0` (no limit), `LFS_MAX_BATCH_SIZE` default `0` (any), `LFS_ALLOW_PURE_SSH` default `false`. `[lfs] STORAGE_TYPE` may be `local`, `minio` or `azureblob`; `PATH` default `./data/lfs`. — [Gitea config cheat sheet](https://docs.gitea.com/administration/config-cheat-sheet)
- Gitea has an LFS garbage-collection cron, `[cron.gc_lfs]`, **disabled by default** (`ENABLED` default `false`), `SCHEDULE` `@every 24h`, `OLDER_THAN` `168h` ("Only attempt to garbage collect LFSMetaObjects older than this (default 7 days)"), `LAST_UPDATED_MORE_THAN_AGO` `72h`, `NUMBER_TO_CHECK_PER_REPO` `100`, `PROPORTION_TO_CHECK_PER_REPO` `0.6`. — [Gitea config cheat sheet](https://docs.gitea.com/administration/config-cheat-sheet)

### Inferences
- A single 500 MB textbook is fine for GitHub LFS (2 GB per-file cap on Free/Pro) but impossible in plain git on GitHub (100 MiB block) and awkward on any host with a push-size cap (GitHub 2 GB per push, GitLab.com 5 GiB per request).
- Rough GitHub cost at the June-2024 rates (unverified for Nov 2026): a 30 GiB library is 20 GiB over the free 10 GiB → about 20 × $0.07 = $1.40/month storage; each full download onto a new device consumes 30 GiB of bandwidth, 20 GiB over quota → about $1.75 once. A 100 GiB library ≈ $6.30/month. The bandwidth quota (10 GiB/month) is the binding constraint for multi-device use: three devices each pulling a few GB of new PDFs in a month can exhaust it, and with no payment method LFS is then disabled until the next month.
- GitLab.com Free's hard 10 GiB per project (git + LFS) with read-only on overflow means a "several GB" library fits only while small and has no cheap overflow path documented on the quota page.
- Codeberg is ruled out for this use by its own policy; Bitbucket Free's 1 GB LFS is too small; the realistic hosted choices are GitHub (metered) or a self-hosted Forgejo/Gitea with S3-compatible storage.
- Forgejo/Gitea `LFS_HTTP_AUTH_EXPIRY` (24 h default) bounds how long a batch-issued token is valid; a slow background upload on iOS that outlives it would fail and need a new batch call.

### Gaps
- GitHub's current (Nov 2026) per-GiB LFS price is not printed on the billing docs page; only the June 2024 changelog figures were confirmed. The pricing calculator was not fetched.
- GitLab.com's price for extra storage and any explicit LFS per-file maximum were not found on the pages fetched.
- Bitbucket: whether LFS storage on Free hard-blocks or auto-bills on a workspace without a payment method was not clarified.
- The Gitea cheat sheet's `LFS_START_SERVER` default (`false` as rendered) and Forgejo's defaults for the `[server]` LFS keys were not cross-checked against a Forgejo config reference; the Forgejo storage page does not list them.
- Whether Forgejo carries the same `cron.gc_lfs` task as Gitea was not verified.

---

## 2. Git LFS protocol and client implementation (Rust / libgit2)

### Takeaway
The LFS wire protocol is small: one JSON `POST …/info/lfs/objects/batch`, then a plain HTTP `GET` or `PUT` per object to the returned `href` with the returned headers, plus an optional `verify` POST; authentication is HTTP Basic with the same HTTPS credentials git uses. libgit2 1.9.7 has a C filter-registration API but the `git2` 0.20.4 crate does not bind it and libgit2 has no LFS support, so every libgit2-embedding app either bundles the `git-lfs` binary (desktop) or implements the protocol itself; three Rust client implementations exist, none of them an established general-purpose library.

### Cited Findings

**Batch API**
- Endpoint: `POST` to the LFS server URL plus `/objects/batch`, e.g. `https://git-server.com/foo/bar.git/info/lfs/objects/batch`. Headers: `Accept: application/vnd.git-lfs+json`, `Content-Type: application/vnd.git-lfs+json`, plus `Authorization` when needed. — [git-lfs docs/api/batch.md](https://github.com/git-lfs/git-lfs/blob/main/docs/api/batch.md)
- Request fields: `operation` (`download` or `upload`); `transfers` (optional array; server assumes `basic` if omitted); `ref` (optional `{ "name": "refs/heads/…" }`, added in v2.4); `objects` (array of `{ "oid": string, "size": integer }`); `hash_algo` (optional, default `sha256`). — [batch.md](https://github.com/git-lfs/git-lfs/blob/main/docs/api/batch.md)
- Response fields: `transfer`; `objects[]` each with `oid`, `size`, optional `authenticated` boolean, and `actions` containing `download`, or `upload` and optionally `verify`; each action has `href`, optional `header` map, `expires_in` (seconds, preferred) and/or `expires_at` (RFC 3339). If the server already has an object on upload, it omits `actions` for it. Per-object failures come back inside HTTP 200 as `error: { code, message }` (404 missing, 409 hash-algo mismatch, 410 removed, 422 validation). — [batch.md](https://github.com/git-lfs/git-lfs/blob/main/docs/api/batch.md)
- Status codes: 200; 401 (credentials needed; `LFS-Authenticate` header, Basic assumed if absent); 403 (no write access); 404; 422; optionally 406, 413, 429, 501, 507 (insufficient storage), 509 (bandwidth limit exceeded). Clients may retry on 500/502/503/504. — [batch.md](https://github.com/git-lfs/git-lfs/blob/main/docs/api/batch.md)
- (The fetch tool summarised rather than reproduced the JSON examples; shapes above are from that summary of the primary document.)

**Basic transfer adapter**
- Download: `GET` the action `href` with the action's headers; the body is the raw object. Upload: `PUT` the raw bytes to the `href` with `Content-Type: application/octet-stream` and `Content-Length`; 200 means success. Verify: after upload, `POST` `{ "oid", "size" }` to the verify `href` with the LFS JSON `Accept`/`Content-Type`; 200 means the server has the object. Clients fall back to `basic` when the batch response has no `transfer`. — [git-lfs docs/api/basic-transfers.md](https://github.com/git-lfs/git-lfs/blob/main/docs/api/basic-transfers.md)

**Server discovery and authentication**
- Default LFS URL: append `.git/info/lfs` to the git remote URL (a trailing `.git` is not doubled): `https://git-server.com/foo/bar` → `https://git-server.com/foo/bar.git/info/lfs`. Overrides: `lfs.url`, `remote.{name}.lfsurl`, and a committed `.lfsconfig` file at the repository root. — [git-lfs docs/api/server-discovery.md](https://github.com/git-lfs/git-lfs/blob/main/docs/api/server-discovery.md)
- "The Git LFS API uses HTTP Basic Authentication to authorize requests." Credentials come from git's credential helper; SSH remotes instead run `git-lfs-authenticate` to obtain headers. — [git-lfs docs/api/authentication.md](https://github.com/git-lfs/git-lfs/blob/main/docs/api/authentication.md)

**Pointer file and filters**
- Pointer: UTF-8 text, `key value` lines ending in `\n`; `version` first, remaining keys sorted alphabetically; required keys `version` (`https://git-lfs.github.com/spec/v1`), `oid` (`sha256:` + lowercase hex), `size` (bytes); the pointer must be under 1024 bytes; exactly one valid encoding per file; empty files pass through unchanged; parsers must preserve unknown keys. — [git-lfs docs/spec.md](https://github.com/git-lfs/git-lfs/blob/main/docs/spec.md)
- Example pointer (from GitHub's docs): `version https://git-lfs.github.com/spec/v1` / `oid sha256:4cac19622fc3ada9c0fdeadb33f88f367b541f38b89102a3f1261ac81fd5bcb5` / `size 84977953`. — [About Git Large File Storage](https://docs.github.com/en/repositories/working-with-files/managing-large-files/about-git-large-file-storage)
- Clean filter (on add) hashes the content, stores it in the local LFS object store and emits the pointer; it does not upload (upload happens on push). Smudge filter (on checkout) reads the first 100 bytes, and if it is a pointer, finds the object locally or downloads it. `.gitattributes` example: `*.mp3 filter=lfs -text`. Local store layout: `.git/lfs/objects/<oid[0:2]>/<oid[2:4]>/<oid>`. — [spec.md](https://github.com/git-lfs/git-lfs/blob/main/docs/spec.md)
- Client configuration defaults in the reference client: `lfs.concurrenttransfers` 8; `lfs.activitytimeout` 30 s; `lfs.transfer.maxretries` 8; `lfs.basictransfersonly` forces plain HTTP transfers; `lfs.tustransfers` enables resumable uploads via tus (marked as not finalised); `lfs.storage` relocates the object store. — [git-lfs-config man page](https://github.com/git-lfs/git-lfs/blob/main/docs/man/git-lfs-config.adoc)
- Locking is a separate optional API; Bitbucket Cloud does not implement it at all. — [Bitbucket LFS limitations](https://support.atlassian.com/bitbucket-cloud/docs/current-limitations-for-git-lfs-with-bitbucket/)

**libgit2 / git2 crate**
- libgit2 1.9.7 (vendored by `libgit2-sys 0.18.8+1.9.7`) declares `git_filter_register` in `include/git2/sys/filter.h`, but `libgit2-sys`'s `lib.rs` contains no `git_filter*` bindings and `git2 0.20.4` has no filter module or `Filter` type. Local inspection, 2026-11-05. — [libgit2-sys 0.18.8+1.9.7 source](https://docs.rs/crate/libgit2-sys/0.18.8+1.9.7/source/); [git2 0.20.4 source](https://docs.rs/crate/git2/0.20.4/source/)
- libgit2's filter registry: `git_filter_register(name, filter, priority)`; the registry "is not thread-safe" so registration must happen at application setup; filters run in priority order on smudge and reverse order on clean. — [libgit2 reference: git_filter_register](https://libgit2.org/docs/reference/main/sys/filter/git_filter_register.html)
- A third-party project states: "git2/libgit2 doesn't automatically run filters" for LFS and "there's no way to make repo.index().add_path() automatically handle LFS"; its install "Requires the forked git2-rs with filter API support." — [ejc3/git2-lfs README](https://github.com/ejc3/git2-lfs)
- APIs that `git2 0.20.4` does expose and that matter here (local inspection): `FetchOptions::depth` (shallow fetch), `Repository::merge_trees`, `merge_commits`, `merge_file_from_index`, `Index::conflicts`, `Odb::reader`/`Odb::writer` and `Repository::blob_writer` (streaming object I/O). — [git2 0.20.4 source](https://docs.rs/crate/git2/0.20.4/source/)

**Rust LFS client crates (status as seen 2026-11-05)**
- `maw-lfs` 0.61.0, released 2026-09-27, MIT, depends on `reqwest ^0.12`: pointer codec, local content-addressed store, attributes matching, HTTPS batch client, credential resolution, no subprocess calls; on-disk layout "bit-identical" to git-lfs. Non-goals: locking, custom transfer adapters (SSH, tus, multipart); it is a component of the `maw` tool ("maw-lfs replaces git-lfs's filter-driver role for the checkout and commit paths that maw owns") and not positioned as a general end-user replacement. Repository: github.com/bobisme/maw. — [docs.rs/maw-lfs](https://docs.rs/maw-lfs)
- `git-lfs-api` 0.7.0: HTTP client for the batch and locking APIs, one of a family of crates (transfer, credentials, server discovery). Seen on docs.rs via search only. — [docs.rs git-lfs-api 0.7.0](https://docs.rs/crate/git-lfs-api/0.7.0/source/src/lib.rs)
- `ejc3/git2-lfs`: "Pure Rust Git LFS implementation for use with git2", MIT; implemented: pointer format, batch upload/download, streaming `upload_file()`/`download_to_file()`, CLI-compatible object cache, clean/smudge, `.lfsconfig` discovery, bearer/basic auth. Not implemented: locking, verify callback, SSH auth, custom adapters, retry/resume, pre-push hook. 17 commits, 0 stars, no releases, installed as a git dependency, requires a forked git2-rs. — [ejc3/git2-lfs](https://github.com/ejc3/git2-lfs)

**How other apps do it**
- GitHub Desktop: "When you install GitHub Desktop, Git Large File Storage (Git LFS) is installed, too."; LFS must be configured from the command line, after which Desktop handles the files like any others. — [GitHub Desktop and Git LFS](https://docs.github.com/en/desktop/configuring-and-customizing-github-desktop/about-git-large-file-storage-and-github-desktop)
- Working Copy (iOS, libgit2-based) ships its own LFS support: release notes for 6.9.5 say "Git LFS works with servers that ask for HTTP Digest authentication. Fetching and pushing large files previously failed against servers that refuse Basic authentication.", mention "Improvements to LFS fallback logic", and that libgit2 was upgraded to 1.9.7. (From App Store release notes surfaced by search; the listing pages themselves were not fetched.) — [Working Copy on the App Store](https://apps.apple.com/SA/app/id896694807)
- gitoxide: `gix-lfs` is listed as a goal only — "Implement git large file support using the process protocol and make it flexible enough to handle a variety of cases." `gix-filter` lists clean/smudge and long-running filter-process support (so it can drive an external `git-lfs` binary). Push over `file://`/`ssh://`, tree-level merge/cherry-pick/revert and partial clone/promisor are listed as still needing plumbing. — [gitoxide crate-status.md](https://github.com/GitoxideLabs/gitoxide/blob/main/crate-status.md)

### Inferences
- A minimal client is on the order of a few hundred lines of Rust plus an HTTP client: (1) pointer encode/parse (three lines of text, < 1024 bytes); (2) streaming SHA-256 while copying a file into `…/lfs/objects/aa/bb/<oid>`; (3) one batch POST per sync with Basic auth (`username:token`); (4) per object a streamed `GET`/`PUT` to `href` with the supplied headers; (5) optional verify POST; (6) retry on 5xx, re-batch when `expires_in` has lapsed, and handle 507/509 (quota) distinctly so the UI can say "host storage/bandwidth exhausted". Locking is unnecessary for one user.
- Because ilmi writes and commits files itself through git2 rather than through `git add`/`git checkout` with filters, the lack of filter bindings in git2 does not block LFS, but it changes the shape: libgit2 will not smudge or clean, so whatever is committed at a path must be what libgit2 sees in the working tree at that path. The clean way to satisfy that is to keep the *pointer* as the working-tree file (the state stock git-lfs calls "smudge skipped") and keep the bytes in an app-managed store (e.g. the standard `.git/lfs/objects` layout). Then libgit2 status/checkout/merge all operate on tiny text pointers and never touch the large bytes, and a desktop user with stock git + git-lfs can still run `git lfs pull` on the same repository. If instead the real PDF sat at the tracked path, libgit2 would see every LFS file as modified and a checkout would overwrite it with pointer text. (Reasoning from the spec and the libgit2 facts above; not tested.)
- The basic adapter has no resume and no chunking: a 500 MB upload is one PUT. Resumable upload exists only via the non-final tus adapter in the reference client, and none of the Rust clients implement it; on iOS this pushes large uploads toward background `URLSession` (see section 6).
- Of the Rust options, `maw-lfs` is the only one with a recent dated release, but it is an internal component of another tool with a fast-moving version number; `git2-lfs` depends on a git2-rs fork. Writing the client in-house against the spec looks lower-risk than depending on any of them, with their code as reference. (Judgement.)
- gitoxide is not a drop-in replacement for git2 here in Nov 2026: no native LFS, and merge/push plumbing is still incomplete per its own status table.

### Gaps
- Whether GitHub's batch responses point `href` at a different host (signed storage URLs) and how long they remain valid was not fetched from a primary source; a client must not assume same-origin and must honour `expires_in`/`expires_at`.
- Working Copy's LFS documentation page could not be found (two guessed manual URLs returned 404); whether it downloads LFS content eagerly or on demand, and any size thresholds, are unconfirmed.
- Fork and Tower: no source fetched on how they provide LFS (I believe both use the bundled/system `git-lfs` CLI; unverified).
- `git-lfs-api` crate: release date, maintainer and maturity not verified; no crates.io page was fetched for any of the three crates.
- No upstream rust-lang/git2-rs issue or PR for filter bindings was located; the "forked git2-rs with filter API support" is known only from the git2-lfs README.
- The exact `.gitattributes` line written by `git lfs track` (background knowledge: `filter=lfs diff=lfs merge=lfs -text`) was not fetched; the spec summary showed `*.mp3 filter=lfs -text`.

---

## 3. Lazy / on-demand content (phone that must not download the library)

### Takeaway
libgit2 1.9.7 supports shallow fetch (`depth`) but neither partial clone/promisor remotes nor sparse checkout — both are multi-year open items with no maintainer commitment — so git-native laziness is unavailable to a git2-based app even though GitHub supports blobless clones server-side. LFS gives the needed laziness for free: a clone carries only sub-1 KB pointers, and which objects to download (none, by path pattern, or on open) is entirely a client decision.

### Cited Findings
- libgit2 issue #5564 "Support for partial clones" was opened 2020-06-18 and is still open; the last substantive comments (May 2022) say the contributor was no longer working on it, kept a private fork, and "nothing ever got merged to libgit2"; the only maintainer comment (Aug 2021) called the plan reasonable but needing more research. — [libgit2 #5564](https://github.com/libgit2/libgit2/issues/5564)
- libgit2 PR #5776 explicitly did not fetch missing objects from a promisor remote and was superseded/closed. — [libgit2 PR #5776](https://github.com/libgit2/libgit2/pull/5776)
- libgit2 PR #6394 "Sparse Checkout" (opened 2022-08-30) is still open with "No reviews"; the author wrote "I'm almost certain I haven't gotten this implementation 100% correct."; unanswered status questions in Sept 2023 and July 2024, the latter reporting the branch "failed during reading the index". The tracking issue #2263 remains open. — [libgit2 PR #6394](https://github.com/libgit2/libgit2/pull/6394); [libgit2 #2263](https://github.com/libgit2/libgit2/issues/2263)
- Local inspection of the vendored libgit2 1.9.7 tree: the strings "promisor" and "sparse" (case-insensitive) do not occur anywhere in `libgit2/src` or `libgit2/include`; `git_fetch_options` has a `depth` field and `git2 0.20.4` exposes `FetchOptions::depth`. — [libgit2-sys 0.18.8+1.9.7 source](https://docs.rs/crate/libgit2-sys/0.18.8+1.9.7/source/)
- GitHub supports partial clone server-side: blobless (`--filter=blob:none`) and treeless (`--filter=tree:0`) clones work "On github.com and GitHub Enterprise Server 2.22+"; a server may also refuse a filter and fall back to a full clone. (Post dated 2020-12-21.) — [GitHub blog: partial clone and shallow clone](https://github.blog/open-source/git/get-up-to-speed-with-partial-clone-and-shallow-clone/)
- gitoxide lists "partial clone, promisor and bundle bootstrapping" among workflows that "still need plumbing across crates", and "fetch missing objects on demand from promisor remotes" and "sparse checkout support" as open items. — [gitoxide crate-status.md](https://github.com/GitoxideLabs/gitoxide/blob/main/crate-status.md)
- Stock git-lfs laziness controls: `GIT_LFS_SKIP_SMUDGE` — if "'true', '1', 'on', or similar, Git LFS will skip the smudge process" (pointers stay in the working tree); `lfs.fetchinclude` / `lfs.fetchexclude` restrict downloads by gitignore-style path lists ("only download objects which match any entry on this comma-separated list of paths/filenames."). — [git-lfs-config man page](https://github.com/git-lfs/git-lfs/blob/main/docs/man/git-lfs-config.adoc)
- An LFS pointer must be smaller than 1024 bytes. — [git-lfs spec.md](https://github.com/git-lfs/git-lfs/blob/main/docs/spec.md)
- A public Obsidian vault on GitHub documents cloning without its LFS attachments and pulling them later. — [LittleD3092/My-Vault](https://github.com/LittleD3092/My-Vault)

### Inferences
- With PDFs and ink behind pointers, the phone can clone the full repository (Markdown + pointer history) and download zero LFS objects; a flashcard-only phone then fetches individual objects only when a card actually needs an image/page. Per-device policy ("everything", "by folder", "on open", "never") is implementable as a local setting with no host support required, mirroring `lfs.fetchinclude`/`fetchexclude`.
- If the vault stayed pure git (no LFS), there is no way with git2 0.20 to avoid downloading every blob reachable from the fetched commits other than shallow depth (which still brings every current blob). Partial clone would need either a different git implementation or shelling out to a git binary, which iOS does not permit.
- Shallow fetch (`depth = 1`) is available as a complementary measure to bound the phone's `.git` size for the text history, but shallow repositories complicate three-way merges (the merge base may be missing), which ilmi's format-aware merge needs. (Reasoning; not tested.)

### Gaps
- Whether libgit2 honours the index skip-worktree bit well enough for a hand-rolled "sparse" working tree was not investigated.
- GitLab.com, Forgejo and Gitea partial-clone support was not looked up (moot while libgit2 lacks the client side).
- No statement was found of a libgit2 roadmap for either feature for 2026–2027.

---

## 4. Growth and pruning (frequently rewritten ink files)

### Takeaway
Every rewrite of an LFS-tracked file creates a new full-size, content-addressed server object, and on GitHub those objects cannot be removed short of deleting and recreating the repository — they keep counting against the storage quota. Local pruning (`git lfs prune`) is easy and server pruning is possible only on self-hosted Gitea/Forgejo (opt-in GC) or GitLab (cleanup after history rewrite), so a page of ink rewritten hundreds of times is a poor fit for LFS-with-history on a commercial host.

### Cited Findings
- GitHub: after removing files from LFS, "the Git LFS objects still exist on the remote storage" and "will continue to count toward your Git LFS storage quota." "To remove Git LFS objects from a repository, delete and recreate the repository." "If you need to purge a removed object and you are unable to delete the repository, please contact support for help." — [Removing files from Git LFS](https://docs.github.com/en/repositories/working-with-files/managing-large-files/removing-files-from-git-large-file-storage)
- GitHub billing: "If you delete Git LFS objects partway through a calendar month, the storage usage for that month is not recalculated." — [Git LFS billing](https://docs.github.com/en/billing/concepts/product-billing/git-lfs)
- `git lfs prune` "Deletes local copies of LFS files which are old, thus freeing up disk space."; it retains objects referenced by the current checkout, stashes, recent refs/commits, other worktrees, and unpushed commits ("any LFS files referenced in those commits is unpushed and will not be deleted"); `--verify-remote` checks the remote has a copy before deleting. Defaults: `lfs.fetchrecentrefsdays` 7, `lfs.fetchrecentcommitsdays` 0, `lfs.pruneoffsetdays` 3. — [git-lfs-prune man page](https://github.com/git-lfs/git-lfs/blob/main/docs/man/git-lfs-prune.adoc); [git-lfs-config man page](https://github.com/git-lfs/git-lfs/blob/main/docs/man/git-lfs-config.adoc)
- GitLab: project size includes "the repository along with LFS objects, job artifacts, packages, and the wiki"; the repository cleanup procedure (upload a `commit-map` from `git filter-repo`, then "Start cleanup") "Unlinks unused LFS objects, freeing storage space"; the simpler purge method "Does not affect LFS objects". — [GitLab: repository size](https://docs.gitlab.com/user/project/repository/repository_size/)
- GitLab: "Expunging file history requires rewriting Git history. This action is destructive and irreversible." — [GitLab Git LFS](https://docs.gitlab.com/topics/git/lfs/)
- Gitea: orphaned-LFS garbage collection exists as `[cron.gc_lfs]` but is off by default and only considers LFS meta objects older than 7 days by default. — [Gitea config cheat sheet](https://docs.gitea.com/administration/config-cheat-sheet)
- Codeberg (plain git): removed objects remain "for approximately 30 days" before the regular garbage collector removes them. — [Codeberg FAQ](https://docs.codeberg.org/getting-started/faq/)
- Experience reports: (a) Nick Dumas (2023) moved an Obsidian vault's attachments to LFS on self-hosted Gitea; migration "was trivial, but it did rewrite every commit", he avoided GitHub LFS because GitHub could change its policies, and said he does not plan to add much more large media. (b) A Zotero user found a 97 MB `zotero.sqlite` broke his git backups and had to rewrite history with `git lfs migrate`. (Both via search summaries of the posts, not fetched in full.) — [ndumas.com: Gitea LFS and syncing Obsidian vaults](https://ndumas.com/2023/01/gitea-lfs-and-syncing-obsidian-vaults/); [jcuenod: Zotero storage update](https://jcuenod.github.io/bibletech/2021/02/02/free-zotero-storage-update)
- Obsidian forum opinion (undated, via search summary): "accumulation of .git per se makes it impossible to indefinitely use git version control on iOS with large vaults and many changes." — [Obsidian forum thread on Working Copy sync](https://forum.obsidian.md/t/mobile-setting-up-ios-git-based-syncing-with-mobile-app-using-working-copy/16499)

### Inferences
- LFS objects are identified by the SHA-256 of the whole content, so there is no delta storage between versions: server storage for one ink page ≈ (number of pushed versions) × (PNG size + stroke-file size). An ink page of S MB pushed after each of N sessions costs N × S MB on the host forever on GitHub. Example: 200 pages × 50 pushed revisions × 1.5 MB ≈ 15 GiB — more than GitHub Free's entire 10 GiB — and it cannot be reclaimed without recreating the repository. (Arithmetic illustration; sizes are assumptions, not measurements.)
- Two mitigations follow directly: commit/push ink at session granularity rather than per stroke (already ilmi's push model), and avoid storing a rendered PNG at all if it can be regenerated from the stroke file (halves or better the per-revision cost). A third is structural: treat ink as *unversioned* content — bytes in an object store the app controls, where superseded objects are deleted once no device needs them — and keep only the pointer (or only the latest pointer) in git. That is not possible within the LFS protocol on GitHub (no delete), but is possible on a self-hosted LFS server with GC or on a plain S3 bucket.
- Keeping ink in plain git instead (no LFS) moves the growth into every device's `.git` (each clone carries every revision; no laziness with libgit2), which is the iPhone problem again; and GitHub recommends single objects ≤ 1 MB and blocks at 100 MB.
- History rewriting to drop old binary revisions (filter-repo + force-push) invalidates every other device's clone and, on GitHub, still does not free LFS storage; it is not a routine maintenance tool for an auto-syncing multi-device app.
- Locally, an app-implemented LFS store can prune aggressively (keep only objects referenced by HEAD and unpushed commits), which keeps iPad/iPhone disk use near "one copy of what I chose to download" — and avoids stock git-lfs's doubling (object store copy + working-tree copy) if the app reads directly from the store. (Design reasoning.)

### Gaps
- No primary source was fetched stating explicitly that LFS performs no delta compression across versions (it follows from content-addressing by full-file SHA-256 in the spec).
- No measurements of real PencilKit stroke-file or PNG sizes, nor of packfile growth for rewritten PNGs in plain git.
- Whether GitHub support will purge individual LFS objects on request for personal accounts in practice, and how quickly, is unknown beyond the one sentence quoted.
- I found no first-hand long-term report of someone keeping frequently rewritten handwriting/ink files in git or LFS.

---

## 5. Alternatives inside the git world

### Takeaway
git-annex is the most capable "pointers in git, bytes elsewhere" system (S3, WebDAV, rclone, even LFS servers as backends, with optional encryption and explicit drop/get), but it is a Haskell program with no iOS app and could only be used by reimplementing its formats. The practical alternatives to "LFS on the git host" are (a) the same LFS client pointed at a standalone LFS server backed by S3/R2 (rudolfs, giftless, several Cloudflare Worker implementations), or (b) app-defined pointers plus direct object-store access, which is the least protocol but the most lock-in to ilmi's own format.

### Cited Findings
- git-annex: "The contents of annexed files are not stored in git, only the names of the files and some other metadata remain there."; "The file that gets checked into git is just a symlink to the key under `.git/annex/`."; location tracking lives "in a separate branch, named "git-annex""; content is moved with `git-annex get/drop/copy/move`, and "If a file is not present you will just see a broken symlink." — [git-annex: how it works](https://git-annex.branchable.com/how_it_works/)
- git-annex special remotes include S3 (and compatibles), webdav, rclone, rsync, directory, borg, bup, gcrypt, **git-lfs**, adb, Glacier, tahoe and others; special remotes can be encrypted. — [git-annex special remotes](https://git-annex.branchable.com/special_remotes/)
- git-annex on mobile: project material found describes Android only; a FAQ-style answer states there is no iOS app (undated, old). No evidence of an iOS port was found. — [git-annex Android doc (Hackage mirror)](https://hackage.haskell.org/package/git-annex-4.20130521/src/doc/Android.mdwn)
- `lfs-test-server` (official reference server) describes itself as intended "for testing the Git LFS client and is not in a production ready state." — [git-lfs/lfs-test-server](https://github.com/git-lfs/lfs-test-server)
- rudolfs: a Rust Git LFS server with an S3 backend, optional local disk cache and optional encryption of stored objects; docs.rs shows 0.3.8, while lib.rs's release history was reported as ending at 0.3.7 (May 2024) — conflicting signals on recency. — [docs.rs rudolfs](https://docs.rs/crate/rudolfs/latest); [lib.rs rudolfs](https://www.lib.rs/crates/rudolfs)
- Giftless (Datopian): pluggable LFS server that issues short-lived presigned URLs so bytes go directly between client and bucket; a PortalJS post describes running it on Cloudflare Containers with R2 (vendor blog, not project docs). — [PortalJS: Giftless and R2](https://www.portaljs.com/blog/scaling-portaljs-data-with-giftless-and-r2)
- Cloudflare Worker LFS servers backed by R2 exist as small open-source projects: `mahardi.me/lfs-proxy` (worker authenticates and returns presigned S3 URLs), `git-lfs-hub/deploy` (R2, GitHub OAuth, Durable Object locks), `quaint-studios/reia-lfs-cloudflare-worker` (MIT; public download, JWT upload), `runreal/gitlfs-server-cloudflare` (MIT; last pushed January 2025). — [tangled.org lfs-proxy](https://tangled.org/mahardi.me/lfs-proxy); [git-lfs-hub/deploy](https://github.com/git-lfs-hub/deploy); [reia-lfs-cloudflare-worker](https://awesome.ecosyste.ms/projects/github.com%2Fquaint-studios%2Freia-lfs-cloudflare-worker); [runreal/gitlfs-server-cloudflare](https://awesome.ecosyste.ms/projects/github.com%2Frunreal%2Fgitlfs-server-cloudflare)
- LFS server location is configurable independently of the git host via `lfs.url` or a committed `.lfsconfig`. — [server-discovery.md](https://github.com/git-lfs/git-lfs/blob/main/docs/api/server-discovery.md)
- Forgejo/Gitea can themselves front an S3/MinIO bucket for LFS with direct signed-URL serving (`SERVE_DIRECT`). — [Forgejo storage settings](https://forgejo.org/docs/latest/admin/setup/storage/)

### Inferences
Comparison for a single user on 2–3 Apple devices (judgement built on the findings above):

| Option | Client work in ilmi | Server the user must run / pay | Lazy fetch | Server-side delete of old versions | Lock-in / interop |
|---|---|---|---|---|---|
| LFS on the git host (GitHub) | Small LFS client | None extra; metered beyond 10 GiB | Yes (client policy) | No (repo delete only) | Standard; stock git-lfs works on desktop |
| LFS on self-hosted Forgejo/Gitea (+S3/MinIO) | Same client | A server (and bucket) | Yes | Yes, opt-in GC after objects are unreferenced | Standard |
| Standalone LFS server on S3/R2 (rudolfs, giftless, CF Worker) + any git host | Same client; `.lfsconfig` points at it | A tiny service + bucket | Yes | Yes (bucket lifecycle / direct delete) | Standard protocol; small, lightly maintained servers |
| App-defined pointers + direct S3/R2/WebDAV | S3 (SigV4) or WebDAV client instead of LFS client | Bucket only | Yes | Yes, fully under app control | ilmi-specific unless LFS pointer format and `.git/lfs` layout are reused |
| git-annex | Reimplement annex keys/branch in Rust; no iOS binary | Any special remote | Yes (get/drop) | Yes (drop, unused) | Rich but git-annex-specific; symlinks unfriendly to iOS |
| DVC | Not evaluated | — | — | — | — |

- Because the LFS server URL is decoupled from the git remote, choosing "LFS on the same host" now does not preclude moving the bytes to a self-hosted or R2-backed LFS endpoint later without changing pointers or history: the oid/size in each pointer stays valid; only `.lfsconfig` changes and objects are re-uploaded. This is the main argument for using the standard pointer format even if the app is the only client.
- "Pointers in git, bytes in an object store, done by the app" is essentially LFS minus the batch negotiation. Its real advantages are deletion/GC control and cheap egress (R2), which are exactly what the ink workload needs; its cost is credentials for a second service on each device.
- A hybrid is coherent: standard LFS for write-once PDFs (history of a textbook is one object), and a separately managed, GC-able store for ink.

### Gaps
- DVC was not researched in this session (no sources fetched); it is a Python tool and, as background knowledge, has no iOS story, but that is unverified here.
- Maintenance status (last commit dates) of giftless, rudolfs and the Worker projects was not verified at their repositories; treat all as lightly maintained until checked.
- Cloudflare R2 pricing/egress terms were out of scope and not fetched.
- git-annex's current (2026) stance on iOS was not confirmed from its own site; the "no iOS app" evidence is old.

---

## 6. Git on iOS in practice

### Takeaway
Native libgit2 on iOS is a proven path (Working Copy, a-Shell, GitSync via git2-rs, newer clients), while JavaScript git (isomorphic-git in Obsidian Git) is described by its own author as "very unstable" with crashes on clone/pull; the recurring failure reports concern large files and LFS, not text. iOS will not run an in-process libgit2 fetch/push for long once the app leaves the foreground, but LFS object transfers are plain HTTPS GET/PUT-from-file and can therefore be handed to a background `URLSession`, with iOS 26's `BGContinuedProcessingTask` as a second, user-visible option for finishing a sync.

### Cited Findings

**Background execution**
- Background `URLSession`: "These tasks continue to run even when your app is suspended"; "the system may suspend your app while the download is performed in another process"; "If the system terminated the app while it was suspended, the system relaunches the app in the background." — [Apple: Downloading files in the background](https://developer.apple.com/documentation/foundation/downloading-files-in-the-background)
- Limitations: "Only HTTP and HTTPS protocols are supported (no custom protocols)."; "Redirects are always followed."; "Only upload tasks from a file are supported (uploads from data instances or a stream fail after the app exits)."; "The session *must* provide a delegate for event delivery." — [Apple: Downloading files in the background](https://developer.apple.com/documentation/foundation/downloading-files-in-the-background)
- Discretion and rate limiting: "In cases where the transfer is initiated while the app is in the background, the session configuration's `isDiscretionary` property is treated as being `true`."; "When your app starts a new download task while in the background, the task doesn't begin until the delay expires. The delay increases each time the system resumes or relaunches your app."; "The delay is reset to 0 whenever the user brings your app to the foreground."; Apple recommends a single background session used to "start many download tasks at once." — [Apple: Downloading files in the background](https://developer.apple.com/documentation/foundation/downloading-files-in-the-background)
- `BGContinuedProcessingTask` (iOS/iPadOS 26.0+): "A task that starts in the foreground and can continue running in the background as needed."; "The system displays the progress of this task in a Live Activity and a person can cancel it through the interface if they wish."; "The system can terminate a continuous background task abruptly depending on run-time conditions, for example, under resource constraints. Your implementation needs to report progress using the ProgressReporting protocol… The system prioritizes the termination of tasks that reflect minimal or no progress, when resources become constrained." — [Apple: BGContinuedProcessingTask](https://developer.apple.com/documentation/backgroundtasks/bgcontinuedprocessingtask)
- A developer-forum thread titled "BGContinuedProcessingTask expiring unpredictably" reports tasks failing in production when the app is backgrounded (anecdote). — [Apple Developer Forums thread 805554](https://developer.apple.com/forums/thread/805554)

**Obsidian Git on mobile (isomorphic-git)**
- "The Git implementation on mobile is **very unstable**!"; "I would not recommend using this plugin on mobile, but try other syncing services."; it "works on mobile thanks to isomorphic-git, a JavaScript-based re-implementation of Git" but "comes with serious limitations and issues."; "It is not possible for an Obsidian plugin to use a native Git installation on Android or iOS." Listed limits: "No **SSH authentication**", "Limited repo size, because of memory restrictions", "No rebase merge strategy", "No submodules support". "Depending on your device and available free RAM, Obsidian may" "crash on clone/pull", "create buffer overflow errors", "run indefinitely." "It's caused by the underlying git implementation on mobile, which is not efficient." The README now points mobile users to GitSync. — [Vinzent03/obsidian-git README](https://github.com/Vinzent03/obsidian-git)

**Native libgit2 clients on iOS**
- GitSync (ViscousPot), the app the Obsidian Git README recommends, is a Flutter app with a Rust core using `flutter_rust_bridge` and **git2-rs**, built for `aarch64-apple-ios`; a release note mentions "file too large ui" and making "large files readonly". — [ViscousPot/GitSync](https://github.com/ViscousPot/GitSync); [GitSync release v1.821](https://newreleases.io/project/github/ViscousPot/GitSync/release/v1.821)
- Working Copy's recent release notes mention upgrading libgit2 to 1.9.7 and LFS authentication fixes (via App Store listing surfaced by search). — [Working Copy on the App Store](https://apps.apple.com/SA/app/id896694807)
- Obsidian forum, 2025-05-22, author of another iOS git client: "It's built on libgit2, so for very large repositories, it may run into similar limitations." Obsidian forum, 2026-04-04: "the 'Setup Folder Sync' workflow described in this thread is now the legacy approach in Working Copy" (superseded by Working Copy's External Repositories). — [Obsidian forum: iOS git sync with Working Copy, p.4](https://forum.obsidian.md/t/mobile-setting-up-ios-git-based-syncing-with-mobile-app-using-working-copy/16499?page=4)
- Obsidian forum, 2026-02-21: a poster notes a-Shell uses libgit2 while Obsidian Git uses a "less capable Isomorphic Git". — [Obsidian forum: Obsidian Git on iOS without iSH or Working Copy](https://forum.obsidian.md/t/setting-up-obsidian-git-on-ios-without-ish-or-working-copy/97800/11)
- Obsidian forum user reports on Working Copy + LFS (undated; surfaced as search-result excerpts, I could not re-locate the posts on the page I fetched): Working Copy's "LFS support seems really touchy for large vaults"; could not recommend "Obsidian + Git LFS + iOS via Working Copy"; many new or moved files "seem to cause timeouts in Working Copy's LFS support"; "once there's too many large files Working Copy's folder sync crashes on initial sync"; the setup "seems solid" if the vault is mostly text with no attachments over a few hundred MB and total size well under 2 GB. — [Obsidian forum: iOS git sync with Working Copy](https://forum.obsidian.md/t/mobile-setting-up-ios-git-based-syncing-with-mobile-app-using-working-copy/16499)

**libgit2 memory/size behaviour**
- A libgit2 maintainer comment on pack indexing: everything other than index metadata is streamed from the remote to disk, so object count rather than pack size drives memory during indexing. — [libgit2 PR #4721](https://github.com/libgit2/libgit2/pull/4721)
- A LibGit2Sharp user reported packs of 4–5 GB working but a ~5.5 GB initial pack failing on read with "delta offset is zero" (wrapper-level report, cause unconfirmed). — [libgit2sharp #1835](https://github.com/libgit2/libgit2sharp/issues/1835)

**HTTPS tokens**
- GitHub fine-grained personal access tokens: "Each token is limited to access resources owned by a single user or organization." and "can be further limited to only access specific repositories"; "Each token is granted specific, fine-grained permissions." (Contents has read and write levels); default expiration "30 days" if none chosen, with non-expiring tokens allowed unless an org policy forbids; for git over HTTPS, "When prompted for your password, enter your personal access token instead of a password."; "Personal access tokens can only be used for HTTPS Git operations." The page lists no LFS-specific limitation. — [GitHub: Managing your personal access tokens](https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/managing-your-personal-access-tokens)
- LFS uses the same HTTP Basic credentials as git over HTTPS. — [git-lfs authentication.md](https://github.com/git-lfs/git-lfs/blob/main/docs/api/authentication.md)

### Inferences
- The LFS basic adapter matches background `URLSession`'s constraints exactly: downloads are HTTPS GETs to a URL with headers (→ download task writing to a file), uploads are HTTPS PUTs of a whole file (→ upload task from file, which is the only upload form that survives app exit). So large PDF transfers can continue while ilmi is suspended, whereas a libgit2 fetch/push (in-process sockets) cannot. Two caveats: batch-issued `href`s expire (`expires_in`), and iOS treats background-initiated transfers as discretionary and rate-limits them, so a deferred transfer may need a fresh batch call when the app next runs; and in a Tauri app this requires a native (Swift) plugin rather than `reqwest`.
- Sequence that fits iOS: in the foreground, do the git fetch/merge/push of text and pointers with libgit2 (small, seconds), then enqueue LFS object transfers on a background session; pushing the git commit that references not-yet-uploaded objects is the ordering hazard — stock git-lfs uploads objects *before* the ref push for that reason, and the app should preserve that order (upload ink/PDF objects, then push pointers), or other devices will see pointers whose objects 404.
- `BGContinuedProcessingTask` suits "finish this sync I just started" on iOS 26+ with visible progress, but it is terminable under pressure and has field reports of unpredictability; treat it as best-effort.
- The negative iOS experience reports cluster around (1) JavaScript git running out of memory and (2) a general-purpose client's LFS and folder-sync handling many large files. Neither is evidence that libgit2 itself struggles with a text-plus-pointers repository; with bytes outside git, the repository libgit2 handles on the phone stays small.
- A fine-grained token restricted to the one vault repository with Contents read/write is the least-privilege credential for both git and LFS on GitHub; note the 30-day default expiry, so the app should ask the user to pick a long or no expiry and handle 401 by prompting for re-entry.

### Gaps
- Apple's "Performing long-running tasks on iOS and iPadOS" article body could not be retrieved (JS-rendered); the requirement that continued-processing tasks start from an explicit user action, and any time limits, are not quoted here. Ordinary background time after leaving the foreground (commonly cited as roughly 30 seconds via `beginBackgroundTask`) is background knowledge, not verified in this session.
- iOS per-app memory (jetsam) limits by device, and libgit2's peak memory when hashing/checking out a single 500 MB blob, were not found in any source; I found no libgit2 issue confirming or denying whole-blob buffering on checkout.
- No source was fetched for iOS Keychain storage of tokens (standard practice; Tauri-specific plugin choice out of scope here).
- Logseq + git on iOS, and a-Shell/iSH git performance, were not researched beyond the one forum mention that a-Shell uses libgit2.
- isomorphic-git's LFS support status was not checked.
- Working Copy's documented LFS behaviour (eager vs on-demand) is unknown (see section 2 gaps).

---

## 7. Merging binaries

### Takeaway
Git never merges binary content: with the `binary` attribute (which unsets `merge`) it keeps the current branch's version in the working tree and leaves the path conflicted, and anything smarter must come from a custom driver or from the application. With LFS the conflict is between two tiny pointer files, so an app that already extracts base/ours/theirs per path can resolve binary conflicts by policy (keep both, or latest wins) without downloading either object.

### Cited Findings
- Built-in `binary` merge driver: "Keep the version from your branch in the work tree, but leave the path in the conflicted state for the user to sort out." — [gitattributes(5)](https://git-scm.com/docs/gitattributes)
- `merge` attribute unset: "Take the version from the current branch as the tentative merge result, and declare that the merge has conflicts. This is suitable for binary files that do not have a well-defined merge semantics." — [gitattributes(5)](https://git-scm.com/docs/gitattributes)
- The `binary` macro is defined as `[attr]binary -diff -merge -text`. — [gitattributes(5)](https://git-scm.com/docs/gitattributes)
- Custom merge drivers are defined in git config (`[merge "name"] driver = cmd %O %A %B %L %P`), receive temp files for ancestor/current/other, must write the result to `%A` and exit 0 for a clean merge. — [gitattributes(5)](https://git-scm.com/docs/gitattributes)
- `git2 0.20.4` exposes `merge_trees`/`merge_commits` returning an `Index`, and `Index::conflicts()` to iterate conflicted paths with their ancestor/our/their entries (local inspection). — [git2 0.20.4 source](https://docs.rs/crate/git2/0.20.4/source/)
- LFS file locking exists to prevent concurrent edits of unmergeable binaries in teams ("mainly needed for team workflows with binary files that can't be merged"). — [ejc3/git2-lfs README](https://github.com/ejc3/git2-lfs)

### Inferences
- For ilmi the existing mechanism (in-memory tree merge, then per-path base/ours/theirs) extends to binaries naturally: for a conflicted pointer path the three blobs are three pointers (oid+size). Policies: (a) **keep both** — write "ours" at the path and "theirs" at a sibling conflicted-copy name; costs nothing in bytes because both objects already exist on the server, and is the only non-lossy choice for handwriting; (b) **latest wins** — needs a trustworthy ordering (commit time is device-clock dependent); acceptable for regenerable artefacts such as a rendered PNG, risky for strokes.
- Ink deserves better than whole-file policy: if the stroke file were a mergeable representation (e.g. an append-only or per-stroke-keyed format), two devices' edits to the same page could be unioned by the app's format-aware merge, with the PNG regenerated. With an opaque PencilKit blob the choice is only keep-both or pick-one. (Design reasoning; PencilKit's data format was not researched here.)
- One page = PNG + stroke file means a conflict policy must resolve the pair atomically (never ours-PNG with theirs-strokes).
- If pointers are ever merged by a stock git client, they must carry `-text`/`-merge` semantics (as `git lfs track` arranges) so git does not insert conflict markers into a pointer.

### Gaps
- No survey source was found documenting what specific note apps (GoodNotes, Notability, Obsidian Sync) do on binary conflicts; "keep both / conflicted copy" as the common file-sync convention is background knowledge, unsourced here.
- libgit2's exact behaviour for binary-attributed paths in `merge_trees` (it reports a conflict with all three entries) was not tested.

---

## 8. Security and privacy (private repo vs end-to-end encryption)

### Takeaway
A private repository on a commercial host protects against outsiders but not the host; the git-world E2EE tools each break something ilmi relies on — git-crypt does not compose cleanly with LFS and needs filter support libgit2's Rust binding lacks, and git-remote-gcrypt re-uploads history and effectively force-pushes — so if E2EE is wanted, the workable route is application-level encryption of the large objects (and, separately, of text) rather than a bolt-on git tool.

### Cited Findings
- git-crypt + LFS: a git-crypt issue asks "Can a large file be both encrypted by git-crypt and stored in git lfs?" with users reporting it does not work well; a Stack Overflow answer explains a file tagged for both was not encrypted because attributes "don't accumulate, they overwrite". A dotfiles repository documents a workaround using a Git LFS *extension* that runs git-crypt's clean/smudge, with `filter=lfs diff=git-crypt`, noting it is not ideal. — [AGWA/git-crypt #93](https://github.com/AGWA/git-crypt/issues/93); [SO mirror: encrypt a file and store it on LFS](https://kiwix.lema.org/stackoverflow.com_en_all_2023-11/questions/64488036/how-to-encrypt-a-file-and-store-it-on-lfs); [bb010g/dotfiles](https://github.com/bb010g/dotfiles)
- git-remote-gcrypt: a GnuPG-encrypted remote helper using `gcrypt::` URLs; over arbitrary git URLs and sftp it requires "uploading the entire repository history with each push", so pushes get slower over time; it may repack the whole remote; "Every git push effectively has --force. Be sure to pull before pushing." (a `gcrypt.require-explicit-force-push` option exists). — [spwhitton/git-remote-gcrypt](https://github.com/spwhitton/git-remote-gcrypt); [git-remote-gcrypt man page](https://manpages.ubuntu.com/manpages/noble/man1/git-remote-gcrypt.1.html)
- git-annex special remotes support encryption, and rudolfs (LFS server) supports encrypting stored objects. — [git-annex special remotes](https://git-annex.branchable.com/special_remotes/); [docs.rs rudolfs](https://docs.rs/crate/rudolfs/latest)
- The `git2 0.20.4` crate has no filter bindings (so git-crypt-style clean/smudge cannot be plugged into libgit2 from Rust without extra FFI). Local inspection. — [git2 0.20.4 source](https://docs.rs/crate/git2/0.20.4/source/)
- GitHub fine-grained tokens can be confined to one repository with specific permissions. — [GitHub: Managing your personal access tokens](https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/managing-your-personal-access-tokens)

### Inferences
- Format-aware merging happens on the device over plaintext, so it is compatible with any scheme where the client decrypts before merging. Filter-style encryption (git-crypt) keeps per-file blobs, so base/ours/theirs remain retrievable per path — but each must be decrypted by the app, since libgit2 will not run the smudge filter. Whole-remote encryption (gcrypt) keeps the local repository plaintext and is merge-transparent, but it is a git CLI remote helper (not usable through libgit2, and no git binary on iOS) and its force-push/full-reupload behaviour is hostile to three devices auto-syncing.
- For the large binaries, an app-implemented LFS client can encrypt before upload: the pointer's `oid` is then the SHA-256 of the ciphertext (the server verifies what it stores), and the spec's "preserve unknown keys" rule leaves room for an extension key carrying a key/nonce reference. This keeps the host from reading PDFs and ink while remaining a valid LFS exchange; the cost is losing interop with stock `git lfs pull` on a desktop and needing key distribution across the user's devices (e.g. iCloud Keychain). Server-side encryption such as rudolfs's protects data at rest in the bucket but not from whoever runs the LFS server.
- Encrypting text content in git while keeping format-aware merges is possible in principle (decrypt three blobs, merge, re-encrypt) but forfeits host-side diffs and delta compression, and with deterministic encryption leaks equality of file versions. For a single-user vault the pragmatic baseline is a private repository + least-privilege token, with E2EE of binaries as an optional layer.

### Gaps
- age-based tools (e.g. git-agecrypt, or SOPS-style workflows) returned no results in the one search made; not evaluated.
- No primary statement was fetched from GitHub/GitLab about staff access to private repository contents or encryption at rest.
- The LFS-extension mechanism (`lfs.extension.*`) referenced by the dotfiles workaround was not read in the git-lfs docs.
