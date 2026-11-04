//! Sync by git (milestone 53): the vault is a repository, and these are the
//! commands the renderer drives it with. libgit2 is built in (`git2`, the
//! vendored library; HTTPS with a token, no SSH), and nothing here shells
//! out to a `git` binary. The renderer owns the policy (when to commit, pull
//! and push, and how two versions of one file are merged by the format's
//! rules, `src/sync/merge.ts`); this module owns the plumbing: status, init,
//! clone, the changes for a commit message, commit, fetch, the merge's
//! bookkeeping (what the other side changed, written to the working tree;
//! what both sides changed, handed back as three texts), resolve, push.

use git2::{
    BranchType, Cred, CredentialType, Delta, DiffOptions, ErrorCode, FetchOptions, IndexAddOption, Oid, PushOptions,
    RemoteCallbacks, Repository, RepositoryInitOptions, ResetType, Signature, StatusOptions,
};
use serde::Serialize;
use std::collections::BTreeSet;
use std::path::{Path, PathBuf};

const REMOTE: &str = "origin";
const BRANCH: &str = "main";
/// What the app never reads, and what it writes only for a moment (`src/vault/vault.ts`'s temp suffix).
const GITIGNORE: &str = "# ilmi: per-device view state, the vault's temp files, Finder's\n.ilmi/state.json\n*.ilmi-tmp\n.DS_Store\n";
/// The temp suffix the vault layer ignores in its watcher; a merged file is written under it and renamed into place.
const TMP_SUFFIX: &str = ".ilmi-tmp";
const TEXT_EXT: [&str; 12] = ["md", "json", "jsonl", "txt", "js", "css", "html", "csv", "tex", "yaml", "yml", "gitignore"];

type R<T> = Result<T, String>;

fn err<E: std::fmt::Display>(e: E) -> String {
    e.to_string()
}

#[derive(Serialize, Debug, PartialEq, Default)]
#[serde(rename_all = "camelCase")]
pub struct Status {
    /// The directory is a repository.
    pub repo: bool,
    pub remote: Option<String>,
    pub branch: Option<String>,
    /// Paths changed since HEAD (added, modified, deleted), vault-relative; ignored files never.
    pub dirty: Vec<String>,
    /// Commits past the remote branch, and behind it, as last fetched.
    pub ahead: usize,
    pub behind: usize,
}

#[derive(Serialize, Debug, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct Change {
    pub path: String,
    /// HEAD's text, and the working tree's; `None` for absent (added, deleted) or binary.
    pub before: Option<String>,
    pub after: Option<String>,
    pub binary: bool,
}

#[derive(Serialize, Debug, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct Conflict {
    pub path: String,
    pub base: Option<String>,
    pub ours: Option<String>,
    pub theirs: Option<String>,
    /// One side is not text: ours is kept, nothing is handed over.
    pub binary: bool,
}

#[derive(Serialize, Debug, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct Merge {
    /// `none` (nothing to merge), `fast` (fast-forwarded), `merged` (a merge commit made), `conflicts` (the files below wait on the renderer's `resolve`).
    pub kind: String,
    /// The commit merged in, for `resolve`.
    pub theirs: Option<String>,
    /// Paths written to the working tree from the other side (deleted ones too).
    pub pulled: Vec<String>,
    pub conflicts: Vec<Conflict>,
}

fn is_text_path(path: &str) -> bool {
    let ext = Path::new(path).extension().and_then(|e| e.to_str()).unwrap_or("");
    TEXT_EXT.contains(&ext) || path.ends_with(".gitignore")
}

fn open(root: &str) -> R<Repository> {
    Repository::open(root).map_err(err)
}

/// HEAD's commit, or `None` on an unborn branch.
fn head_commit(repo: &Repository) -> R<Option<git2::Commit<'_>>> {
    match repo.head() {
        Ok(h) => Ok(Some(h.peel_to_commit().map_err(err)?)),
        Err(e) if e.code() == ErrorCode::UnbornBranch || e.code() == ErrorCode::NotFound => Ok(None),
        Err(e) => Err(err(e)),
    }
}

/// The branch HEAD is on (`main` for a fresh repository).
fn branch_name(repo: &Repository) -> R<String> {
    let head = repo.find_reference("HEAD").map_err(err)?;
    let target = head.symbolic_target().unwrap_or("refs/heads/main");
    Ok(target.strip_prefix("refs/heads/").unwrap_or(BRANCH).to_string())
}

fn remote_branch_oid(repo: &Repository, branch: &str) -> Option<Oid> {
    repo.find_branch(&format!("{REMOTE}/{branch}"), BranchType::Remote).ok().and_then(|b| b.get().target())
}

fn signature() -> R<Signature<'static>> {
    let host = std::env::var("HOSTNAME")
        .ok()
        .or_else(|| std::fs::read_to_string("/etc/hostname").ok().map(|s| s.trim().to_string()))
        .filter(|s| !s.is_empty())
        .unwrap_or_else(|| "device".to_string());
    Signature::now("ilmi", &format!("ilmi@{host}")).map_err(err)
}

fn callbacks(token: Option<String>) -> RemoteCallbacks<'static> {
    let mut cb = RemoteCallbacks::new();
    cb.credentials(move |_url, username, allowed| {
        if allowed.contains(CredentialType::USER_PASS_PLAINTEXT) {
            if let Some(t) = token.as_deref().filter(|t| !t.is_empty()) {
                // a GitHub token goes as the password; the user name is not checked
                return Cred::userpass_plaintext(username.unwrap_or("git"), t);
            }
        }
        if allowed.contains(CredentialType::DEFAULT) {
            return Cred::default();
        }
        Err(git2::Error::from_str("no token for this remote"))
    });
    cb
}

/// Blob text when the blob is valid UTF-8 and the path says text; else `None`.
fn blob_text(repo: &Repository, oid: Oid, path: &str) -> R<Option<String>> {
    if !is_text_path(path) {
        return Ok(None);
    }
    let blob = repo.find_blob(oid).map_err(err)?;
    Ok(std::str::from_utf8(blob.content()).ok().map(|s| s.to_string()))
}

/// The blob of `path` in `tree`, if there.
fn entry_oid(tree: Option<&git2::Tree>, path: &str) -> Option<Oid> {
    tree.and_then(|t| t.get_path(Path::new(path)).ok()).map(|e| e.id())
}

fn write_file(root: &Path, rel: &str, bytes: &[u8]) -> R<()> {
    let abs = root.join(rel);
    if let Some(dir) = abs.parent() {
        std::fs::create_dir_all(dir).map_err(err)?;
    }
    let tmp = PathBuf::from(format!("{}{}", abs.display(), TMP_SUFFIX));
    std::fs::write(&tmp, bytes).map_err(err)?;
    std::fs::rename(&tmp, &abs).map_err(|e| {
        let _ = std::fs::remove_file(&tmp);
        err(e)
    })
}

/// Remove a file and the directories it leaves empty, up to the root.
fn remove_file(root: &Path, rel: &str) -> R<()> {
    let abs = root.join(rel);
    match std::fs::remove_file(&abs) {
        Ok(()) => {}
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => {}
        Err(e) => return Err(err(e)),
    }
    let mut dir = abs.parent().map(Path::to_path_buf);
    while let Some(d) = dir {
        if d == root || std::fs::remove_dir(&d).is_err() {
            break;
        }
        dir = d.parent().map(Path::to_path_buf);
    }
    Ok(())
}

// ── status ───────────────────────────────────────────────────────

pub fn status(root: &str) -> R<Status> {
    let repo = match Repository::open(root) {
        Ok(r) => r,
        Err(_) => return Ok(Status::default()),
    };
    let remote = repo.find_remote(REMOTE).ok().and_then(|r| r.url().map(|u| u.to_string()));
    let branch = branch_name(&repo)?;
    let mut opts = StatusOptions::new();
    opts.include_untracked(true).recurse_untracked_dirs(true).include_ignored(false).exclude_submodules(true);
    let statuses = repo.statuses(Some(&mut opts)).map_err(err)?;
    let mut dirty: Vec<String> = statuses.iter().filter_map(|s| s.path().map(|p| p.to_string())).collect();
    dirty.sort();
    let (ahead, behind) = match (head_commit(&repo)?, remote_branch_oid(&repo, &branch)) {
        (Some(h), Some(r)) => repo.graph_ahead_behind(h.id(), r).map_err(err)?,
        (Some(h), None) => (repo.revwalk().and_then(|mut w| { w.push(h.id())?; Ok(w.count()) }).unwrap_or(1), 0),
        (None, Some(r)) => (0, repo.revwalk().and_then(|mut w| { w.push(r)?; Ok(w.count()) }).unwrap_or(1)),
        (None, None) => (0, 0),
    };
    Ok(Status { repo: true, remote, branch: Some(branch), dirty, ahead, behind })
}

// ── init, clone ──────────────────────────────────────────────────

/// Make `root` a repository (on `main`, with the app's `.gitignore`) when it is not one, and point `origin` at `remote` when given. A repository that is one already is used as it is.
pub fn init(root: &str, remote: Option<&str>) -> R<()> {
    let repo = match Repository::open(root) {
        Ok(r) => r,
        Err(_) => {
            let mut opts = RepositoryInitOptions::new();
            opts.initial_head(BRANCH);
            Repository::init_opts(root, &opts).map_err(err)?
        }
    };
    let ignore = Path::new(root).join(".gitignore");
    if !ignore.exists() {
        std::fs::write(&ignore, GITIGNORE).map_err(err)?;
    }
    if let Some(url) = remote {
        set_remote_in(&repo, url)?;
    }
    Ok(())
}

fn set_remote_in(repo: &Repository, url: &str) -> R<()> {
    if repo.find_remote(REMOTE).is_ok() {
        repo.remote_set_url(REMOTE, url).map_err(err)
    } else {
        repo.remote(REMOTE, url).map(|_| ()).map_err(err)
    }
}

pub fn set_remote(root: &str, url: &str) -> R<()> {
    set_remote_in(&open(root)?, url)
}

/// A bare repository at `path`: the smoke's host, and anyone's own.
pub fn init_bare(path: &str) -> R<()> {
    let mut opts = RepositoryInitOptions::new();
    opts.bare(true).initial_head(BRANCH);
    Repository::init_opts(path, &opts).map(|_| ()).map_err(err)
}

/// Clone `url` into `dest`, which must not exist or be an empty directory.
pub fn clone(url: &str, token: Option<String>, dest: &str) -> R<()> {
    let d = Path::new(dest);
    if d.exists() && std::fs::read_dir(d).map_err(err)?.next().is_some() {
        return Err("not an empty folder".to_string());
    }
    let mut fo = FetchOptions::new();
    fo.remote_callbacks(callbacks(token));
    let mut b = git2::build::RepoBuilder::new();
    b.fetch_options(fo);
    b.clone(url, d).map_err(err)?;
    Ok(())
}

// ── changes, commit ──────────────────────────────────────────────

/// What a commit would carry: each changed path with HEAD's text and the working tree's.
pub fn changes(root: &str) -> R<Vec<Change>> {
    let repo = open(root)?;
    let head = head_commit(&repo)?;
    let tree = match &head {
        Some(c) => Some(c.tree().map_err(err)?),
        None => None,
    };
    let mut opts = StatusOptions::new();
    opts.include_untracked(true).recurse_untracked_dirs(true).include_ignored(false);
    let statuses = repo.statuses(Some(&mut opts)).map_err(err)?;
    let mut out = Vec::new();
    for s in statuses.iter() {
        let Some(path) = s.path().map(|p| p.to_string()) else { continue };
        let binary = !is_text_path(&path);
        let before = match entry_oid(tree.as_ref(), &path) {
            Some(oid) if !binary => blob_text(&repo, oid, &path)?,
            _ => None,
        };
        let abs = Path::new(root).join(&path);
        let after = if !binary && abs.is_file() { std::fs::read_to_string(&abs).ok() } else { None };
        out.push(Change { path, before, after, binary });
    }
    out.sort_by(|a, b| a.path.cmp(&b.path));
    Ok(out)
}

/// Stage everything and commit with `parents` (HEAD and, for a merge, the other side). `None` when there is nothing to commit and no second parent.
fn commit_all(repo: &Repository, message: &str, second: Option<Oid>) -> R<Option<String>> {
    let mut index = repo.index().map_err(err)?;
    index.add_all(["*"].iter(), IndexAddOption::DEFAULT, None).map_err(err)?;
    index.update_all(["*"].iter(), None).map_err(err)?;
    index.write().map_err(err)?;
    let tree_oid = index.write_tree().map_err(err)?;
    let tree = repo.find_tree(tree_oid).map_err(err)?;
    let head = head_commit(repo)?;
    if second.is_none() {
        if let Some(h) = &head {
            if h.tree_id() == tree_oid {
                return Ok(None);
            }
        } else if tree.iter().next().is_none() {
            return Ok(None);
        }
    }
    let sig = signature()?;
    let mut parents: Vec<git2::Commit> = Vec::new();
    if let Some(h) = head {
        parents.push(h);
    }
    if let Some(oid) = second {
        parents.push(repo.find_commit(oid).map_err(err)?);
    }
    let refs: Vec<&git2::Commit> = parents.iter().collect();
    let oid = repo.commit(Some("HEAD"), &sig, &sig, message, &tree, &refs).map_err(err)?;
    Ok(Some(oid.to_string()))
}

pub fn commit(root: &str, message: &str) -> R<Option<String>> {
    commit_all(&open(root)?, message, None)
}

// ── fetch, merge, resolve, push ──────────────────────────────────

pub fn fetch(root: &str, token: Option<String>) -> R<Status> {
    let repo = open(root)?;
    let mut remote = repo.find_remote(REMOTE).map_err(|_| "no remote".to_string())?;
    let mut fo = FetchOptions::new();
    fo.remote_callbacks(callbacks(token));
    remote.fetch(&[format!("+refs/heads/*:refs/remotes/{REMOTE}/*")], Some(&mut fo), None).map_err(err)?;
    status(root)
}

/// Paths changed between two trees (`None` is the empty tree), with their status.
fn changed_paths(repo: &Repository, from: Option<&git2::Tree>, to: Option<&git2::Tree>) -> R<Vec<(String, Delta)>> {
    let mut opts = DiffOptions::new();
    opts.include_typechange(true);
    let diff = repo.diff_tree_to_tree(from, to, Some(&mut opts)).map_err(err)?;
    let mut out = Vec::new();
    for d in diff.deltas() {
        let path = d.new_file().path().or_else(|| d.old_file().path()).and_then(|p| p.to_str()).map(|s| s.to_string());
        if let Some(p) = path {
            out.push((p, d.status()));
        }
    }
    Ok(out)
}

/// The working tree takes `path` as `tree` holds it (removed when it does not).
fn take_from(repo: &Repository, root: &Path, tree: &git2::Tree, path: &str) -> R<()> {
    match entry_oid(Some(tree), path) {
        Some(oid) => {
            let blob = repo.find_blob(oid).map_err(err)?;
            write_file(root, path, blob.content())
        }
        None => remove_file(root, path),
    }
}

/// Bring the fetched branch in. The working tree must be committed first
/// (`commit`): what the other side alone changed is written to it; what
/// both sides changed is handed back as its three texts for the renderer
/// to merge (`resolve` then commits); with nothing of that, the merge
/// commit (or the fast-forward) is made here.
pub fn merge(root: &str) -> R<Merge> {
    let repo = open(root)?;
    let rootp = Path::new(root);
    let branch = branch_name(&repo)?;
    let none = Merge { kind: "none".into(), theirs: None, pulled: vec![], conflicts: vec![] };
    let Some(theirs_oid) = remote_branch_oid(&repo, &branch) else { return Ok(none) };
    let theirs = repo.find_commit(theirs_oid).map_err(err)?;
    let theirs_tree = theirs.tree().map_err(err)?;
    let ours = head_commit(&repo)?;
    let (ours_tree, base_tree) = match &ours {
        None => (None, None),
        Some(o) => {
            if o.id() == theirs_oid {
                return Ok(none);
            }
            let base = match repo.merge_base(o.id(), theirs_oid) {
                Ok(b) => Some(repo.find_commit(b).map_err(err)?.tree().map_err(err)?),
                // unrelated histories: everything is new on both sides
                Err(_) => None,
            };
            if let Some(b) = &base {
                if b.id() == theirs_tree.id() && repo.merge_base(o.id(), theirs_oid).map(|m| m == theirs_oid).unwrap_or(false) {
                    // theirs is behind us: nothing to bring in
                    return Ok(none);
                }
            }
            (Some(o.tree().map_err(err)?), base)
        }
    };
    let their_changes = changed_paths(&repo, base_tree.as_ref(), Some(&theirs_tree))?;
    let our_changes: BTreeSet<String> = changed_paths(&repo, base_tree.as_ref(), ours_tree.as_ref())?.into_iter().map(|(p, _)| p).collect();
    // fast-forward: we have nothing past the base
    let fast = match (&ours, base_tree.as_ref()) {
        (None, _) => true,
        (Some(o), Some(b)) => o.tree_id() == b.id() && repo.merge_base(o.id(), theirs_oid).map(|m| m == o.id()).unwrap_or(false),
        (Some(_), None) => false,
    };
    let mut pulled = Vec::new();
    let mut conflicts = Vec::new();
    for (path, _) in &their_changes {
        let their_oid = entry_oid(Some(&theirs_tree), path);
        let our_oid = entry_oid(ours_tree.as_ref(), path);
        if !our_changes.contains(path) || their_oid == our_oid {
            if their_oid != our_oid {
                take_from(&repo, rootp, &theirs_tree, path)?;
                pulled.push(path.clone());
            }
            continue;
        }
        let binary = !is_text_path(path);
        let text = |oid: Option<Oid>| -> R<Option<String>> {
            match oid {
                Some(o) if !binary => blob_text(&repo, o, path),
                _ => Ok(None),
            }
        };
        conflicts.push(Conflict {
            path: path.clone(),
            base: text(entry_oid(base_tree.as_ref(), path))?,
            ours: text(our_oid)?,
            theirs: text(their_oid)?,
            binary,
        });
    }
    if fast {
        repo.reset(theirs.as_object(), ResetType::Mixed, None).map_err(err)?;
        return Ok(Merge { kind: "fast".into(), theirs: Some(theirs_oid.to_string()), pulled, conflicts: vec![] });
    }
    if conflicts.is_empty() {
        commit_all(&repo, &format!("merge from {REMOTE}"), Some(theirs_oid))?;
        return Ok(Merge { kind: "merged".into(), theirs: Some(theirs_oid.to_string()), pulled, conflicts });
    }
    Ok(Merge { kind: "conflicts".into(), theirs: Some(theirs_oid.to_string()), pulled, conflicts })
}

#[derive(serde::Deserialize, Debug)]
pub struct Resolved {
    pub path: String,
    /// The merged text; `None` removes the file.
    pub text: Option<String>,
}

/// The renderer's merge of the files `merge` handed back, written and committed with both parents.
pub fn resolve(root: &str, theirs: &str, message: &str, files: Vec<Resolved>) -> R<String> {
    let repo = open(root)?;
    let rootp = Path::new(root);
    for f in &files {
        match &f.text {
            Some(t) => write_file(rootp, &f.path, t.as_bytes())?,
            None => remove_file(rootp, &f.path)?,
        }
    }
    let oid = Oid::from_str(theirs).map_err(err)?;
    commit_all(&repo, message, Some(oid))?.ok_or_else(|| "nothing to commit".to_string())
}

pub fn push(root: &str, token: Option<String>) -> R<Status> {
    let repo = open(root)?;
    let branch = branch_name(&repo)?;
    if head_commit(&repo)?.is_none() {
        return Err("nothing to push".to_string());
    }
    let mut remote = repo.find_remote(REMOTE).map_err(|_| "no remote".to_string())?;
    let mut cb = callbacks(token);
    let failed = std::sync::Arc::new(std::sync::Mutex::new(None::<String>));
    let f2 = failed.clone();
    cb.push_update_reference(move |_name, st| {
        if let Some(msg) = st {
            *f2.lock().unwrap() = Some(msg.to_string());
        }
        Ok(())
    });
    let mut po = PushOptions::new();
    po.remote_callbacks(cb);
    remote.push(&[format!("refs/heads/{branch}:refs/heads/{branch}")], Some(&mut po)).map_err(err)?;
    if let Some(msg) = failed.lock().unwrap().take() {
        return Err(msg);
    }
    status(root)
}

#[cfg(test)]
mod tests {
    use super::*;

    struct Temp(PathBuf);
    impl Temp {
        fn new(name: &str) -> Temp {
            let p = std::env::temp_dir().join(format!("ilmi-sync-{}-{}", name, std::process::id()));
            let _ = std::fs::remove_dir_all(&p);
            std::fs::create_dir_all(&p).unwrap();
            Temp(p)
        }
        fn path(&self, rel: &str) -> String {
            self.0.join(rel).to_str().unwrap().to_string()
        }
    }
    impl Drop for Temp {
        fn drop(&mut self) {
            let _ = std::fs::remove_dir_all(&self.0);
        }
    }

    fn put(root: &str, rel: &str, text: &str) {
        let p = Path::new(root).join(rel);
        std::fs::create_dir_all(p.parent().unwrap()).unwrap();
        std::fs::write(p, text).unwrap();
    }
    fn get(root: &str, rel: &str) -> Option<String> {
        std::fs::read_to_string(Path::new(root).join(rel)).ok()
    }

    const CARD: &str = "---\ntype: deck\n---\n\nder Vorsatz :: resolution ^cv-vorsatz\n<!-- sr due=2026-11-04 st=review s=4 d=5 r=2 l=0 ivl=4 last=2026-10-31T08:00:00Z g=3 -->\n\nder Mut :: courage ^cv-mut\n<!-- sr due=2026-11-04 st=review s=4 d=5 r=2 l=0 ivl=4 last=2026-10-31T08:00:00Z g=3 -->\n";

    /// A bare host, a vault `a` connected to it with one commit pushed, and `b` cloned from it.
    fn rig(name: &str) -> (Temp, String, String, String) {
        let t = Temp::new(name);
        let bare = t.path("host.git");
        init_bare(&bare).unwrap();
        let a = t.path("a");
        std::fs::create_dir_all(&a).unwrap();
        put(&a, "german.md", CARD);
        put(&a, "notes/essay.md", "# essay\n\nfirst thoughts.\n\nsecond thoughts.\n");
        put(&a, ".ilmi/order.json", "{\"\":[\"notes/\",\"german.md\"]}\n");
        put(&a, ".ilmi/state.json", "{\"tab\":\"german.md\"}\n");
        put(&a, ".ilmi/reviews/2026-11.jsonl", "{\"at\":\"2026-11-01T08:00:00Z\",\"doc\":\"german.md\",\"card\":\"cv-mut\",\"g\":3,\"st\":\"review\",\"elapsed\":4,\"ivl\":4,\"next\":9}\n");
        init(&a, Some(&bare)).unwrap();
        assert!(commit(&a, "start").unwrap().is_some());
        push(&a, None).unwrap();
        let b = t.path("b");
        clone(&bare, None, &b).unwrap();
        (t, bare, a, b)
    }

    #[test]
    fn init_writes_the_ignore_file_and_status_counts() {
        let t = Temp::new("init");
        let a = t.path("a");
        std::fs::create_dir_all(&a).unwrap();
        assert_eq!(status(&a).unwrap(), Status::default());
        put(&a, "x.md", "x\n");
        put(&a, ".ilmi/state.json", "{}\n");
        init(&a, None).unwrap();
        assert_eq!(get(&a, ".gitignore").unwrap(), GITIGNORE);
        let s = status(&a).unwrap();
        assert!(s.repo && s.remote.is_none());
        assert_eq!(s.branch.as_deref(), Some("main"));
        // state.json is ignored; the ignore file itself is a change
        assert_eq!(s.dirty, vec![".gitignore", "x.md"]);
        assert!(commit(&a, "first").unwrap().is_some());
        assert!(commit(&a, "again").unwrap().is_none(), "nothing to commit twice");
        assert_eq!(status(&a).unwrap().dirty, Vec::<String>::new());
        // a repository already: used as it is, the ignore file untouched
        put(&a, ".gitignore", "mine\n");
        init(&a, Some("file:///nowhere")).unwrap();
        assert_eq!(get(&a, ".gitignore").unwrap(), "mine\n");
        assert_eq!(status(&a).unwrap().remote.as_deref(), Some("file:///nowhere"));
        set_remote(&a, "file:///elsewhere").unwrap();
        assert_eq!(status(&a).unwrap().remote.as_deref(), Some("file:///elsewhere"));
    }

    #[test]
    fn changes_carry_both_texts() {
        let (_t, _bare, a, _b) = rig("changes");
        put(&a, "german.md", &CARD.replace("der Mut :: courage", "der Mut :: courage, nerve"));
        put(&a, "new.md", "new\n");
        std::fs::remove_file(Path::new(&a).join("notes/essay.md")).unwrap();
        put(&a, "pages.pdf", "%PDF-1.4 not really");
        let ch = changes(&a).unwrap();
        let paths: Vec<&str> = ch.iter().map(|c| c.path.as_str()).collect();
        assert_eq!(paths, vec!["german.md", "new.md", "notes/essay.md", "pages.pdf"]);
        assert!(ch[0].before.as_deref() == Some(CARD) && ch[0].after.as_deref().unwrap().contains("nerve"));
        assert!(ch[1].before.is_none() && ch[1].after.as_deref() == Some("new\n"));
        assert!(ch[2].before.is_some() && ch[2].after.is_none());
        assert!(ch[3].binary && ch[3].before.is_none() && ch[3].after.is_none());
    }

    #[test]
    fn a_clone_shares_the_history_and_a_push_fast_forwards_the_other() {
        let (_t, _bare, a, b) = rig("ff");
        assert_eq!(get(&b, "german.md").unwrap(), CARD);
        assert!(get(&b, ".ilmi/state.json").is_none(), "state.json never travels");
        assert_eq!(get(&b, ".ilmi/order.json").unwrap(), "{\"\":[\"notes/\",\"german.md\"]}\n");
        let sb = status(&b).unwrap();
        assert!(sb.repo && sb.ahead == 0 && sb.behind == 0 && sb.dirty.is_empty());
        assert_eq!(sb.remote.as_deref(), Some(_bare.as_str()));
        // a review on a, pushed; b fetches and fast-forwards
        put(&a, "german.md", &CARD.replace("last=2026-10-31T08:00:00Z g=3 -->\n\nder Mut", "last=2026-11-04T09:00:00Z g=4 -->\n\nder Mut"));
        assert_eq!(status(&a).unwrap().dirty, vec!["german.md"]);
        commit(&a, "1 review").unwrap();
        assert_eq!(status(&a).unwrap().ahead, 1);
        let s = push(&a, None).unwrap();
        assert_eq!((s.ahead, s.behind), (0, 0));
        let f = fetch(&b, None).unwrap();
        assert_eq!((f.ahead, f.behind), (0, 1));
        let m = merge(&b).unwrap();
        assert_eq!(m.kind, "fast");
        assert_eq!(m.pulled, vec!["german.md"]);
        assert!(get(&b, "german.md").unwrap().contains("g=4"));
        let s = status(&b).unwrap();
        assert!(s.dirty.is_empty() && s.ahead == 0 && s.behind == 0, "{:?}", s);
        assert_eq!(merge(&b).unwrap().kind, "none");
    }

    #[test]
    fn different_files_merge_without_the_renderer() {
        let (_t, _bare, a, b) = rig("merged");
        put(&a, "german.md", &CARD.replace("der Mut :: courage", "der Mut :: courage, nerve"));
        commit(&a, "edited").unwrap();
        push(&a, None).unwrap();
        put(&b, "notes/essay.md", "# essay\n\nfirst thoughts.\n\nsecond thoughts.\n\nthird.\n");
        commit(&b, "essay").unwrap();
        fetch(&b, None).unwrap();
        let m = merge(&b).unwrap();
        assert_eq!(m.kind, "merged");
        assert_eq!(m.pulled, vec!["german.md"]);
        assert!(m.conflicts.is_empty());
        assert!(get(&b, "german.md").unwrap().contains("nerve"));
        assert!(get(&b, "notes/essay.md").unwrap().contains("third"));
        let s = status(&b).unwrap();
        assert!(s.dirty.is_empty(), "{:?}", s.dirty);
        assert_eq!((s.ahead, s.behind), (2, 0), "the merge commit and ours");
        // the merge commit has two parents
        let repo = Repository::open(&b).unwrap();
        assert_eq!(repo.head().unwrap().peel_to_commit().unwrap().parent_count(), 2);
        push(&b, None).unwrap();
        fetch(&a, None).unwrap();
        assert_eq!(merge(&a).unwrap().kind, "fast");
        assert!(get(&a, "notes/essay.md").unwrap().contains("third"));
    }

    #[test]
    fn a_file_changed_on_both_sides_is_handed_back_and_resolved() {
        let (_t, _bare, a, b) = rig("conflict");
        let ours = CARD.replace("der Mut :: courage", "der Mut :: courage, nerve");
        let theirs = CARD.replace("der Vorsatz :: resolution", "der Vorsatz :: resolution, intent");
        put(&a, "german.md", &theirs);
        put(&a, "pages.pdf", "%PDF-a");
        commit(&a, "a").unwrap();
        push(&a, None).unwrap();
        put(&b, "german.md", &ours);
        put(&b, "pages.pdf", "%PDF-b");
        commit(&b, "b").unwrap();
        fetch(&b, None).unwrap();
        let m = merge(&b).unwrap();
        assert_eq!(m.kind, "conflicts");
        assert!(m.pulled.is_empty());
        assert_eq!(m.conflicts.len(), 2);
        let c = &m.conflicts[0];
        assert_eq!(c.path, "german.md");
        assert_eq!(c.base.as_deref(), Some(CARD));
        assert_eq!(c.ours.as_deref(), Some(ours.as_str()));
        assert_eq!(c.theirs.as_deref(), Some(theirs.as_str()));
        assert!(!c.binary);
        let p = &m.conflicts[1];
        assert!(p.path == "pages.pdf" && p.binary && p.base.is_none() && p.ours.is_none() && p.theirs.is_none());
        // nothing was written: ours stands until resolve
        assert_eq!(get(&b, "german.md").unwrap(), ours);
        assert_eq!(get(&b, "pages.pdf").unwrap(), "%PDF-b");
        let merged = CARD.replace("der Mut :: courage", "der Mut :: courage, nerve").replace("der Vorsatz :: resolution", "der Vorsatz :: resolution, intent");
        let theirs_oid = m.theirs.clone().unwrap();
        let id = resolve(&b, &theirs_oid, "merged: german", vec![Resolved { path: "german.md".into(), text: Some(merged.clone()) }]).unwrap();
        assert_eq!(get(&b, "german.md").unwrap(), merged);
        let repo = Repository::open(&b).unwrap();
        let head = repo.head().unwrap().peel_to_commit().unwrap();
        assert_eq!(head.id().to_string(), id);
        assert_eq!(head.parent_count(), 2);
        assert_eq!(head.parent(1).unwrap().id().to_string(), theirs_oid);
        assert_eq!(head.message(), Some("merged: german"));
        let s = status(&b).unwrap();
        assert!(s.dirty.is_empty() && s.behind == 0, "{:?}", s);
        push(&b, None).unwrap();
        fetch(&a, None).unwrap();
        assert_eq!(merge(&a).unwrap().kind, "fast");
        assert_eq!(get(&a, "german.md").unwrap(), merged);
    }

    #[test]
    fn modify_and_delete_is_handed_back_with_one_side_missing() {
        let (_t, _bare, a, b) = rig("moddel");
        std::fs::remove_file(Path::new(&a).join("notes/essay.md")).unwrap();
        commit(&a, "removed").unwrap();
        push(&a, None).unwrap();
        put(&b, "notes/essay.md", "# essay\n\nfirst thoughts, edited.\n\nsecond thoughts.\n");
        commit(&b, "edited").unwrap();
        fetch(&b, None).unwrap();
        let m = merge(&b).unwrap();
        assert_eq!(m.kind, "conflicts");
        let c = &m.conflicts[0];
        assert!(c.path == "notes/essay.md" && c.base.is_some() && c.ours.is_some() && c.theirs.is_none());
        // the other way round: resolve may remove a file
        resolve(&b, &m.theirs.unwrap(), "kept", vec![]).unwrap();
        assert!(get(&b, "notes/essay.md").unwrap().contains("edited"));
        push(&b, None).unwrap();
        put(&b, "notes/essay.md", "# essay\n\nfirst thoughts, edited twice.\n");
        commit(&b, "b2").unwrap();
        push(&b, None).unwrap();
        fetch(&a, None).unwrap();
        let m = merge(&a).unwrap();
        assert_eq!(m.kind, "fast");
        assert_eq!(m.pulled, vec!["notes/essay.md"]);
        assert!(get(&a, "notes/essay.md").unwrap().contains("twice"));
        // a file deleted on the other side alone goes, and its empty folder with it
        std::fs::remove_file(Path::new(&b).join("notes/essay.md")).unwrap();
        commit(&b, "gone").unwrap();
        push(&b, None).unwrap();
        fetch(&a, None).unwrap();
        assert_eq!(merge(&a).unwrap().pulled, vec!["notes/essay.md"]);
        assert!(!Path::new(&a).join("notes").exists());
    }

    #[test]
    fn unrelated_histories_merge_over_an_empty_base() {
        let t = Temp::new("unrelated");
        let bare = t.path("host.git");
        init_bare(&bare).unwrap();
        let a = t.path("a");
        std::fs::create_dir_all(&a).unwrap();
        put(&a, "german.md", CARD);
        put(&a, "only-a.md", "a\n");
        init(&a, Some(&bare)).unwrap();
        commit(&a, "a").unwrap();
        push(&a, None).unwrap();
        // a copy of the same folder, made a repository of its own and connected to the same host
        let b = t.path("b");
        std::fs::create_dir_all(&b).unwrap();
        put(&b, "german.md", CARD);
        put(&b, "only-b.md", "b\n");
        init(&b, Some(&bare)).unwrap();
        commit(&b, "b").unwrap();
        fetch(&b, None).unwrap();
        let m = merge(&b).unwrap();
        assert_eq!(m.kind, "merged", "{:?}", m);
        assert_eq!(m.pulled, vec!["only-a.md"]);
        assert!(get(&b, "only-a.md").is_some() && get(&b, "only-b.md").is_some());
        push(&b, None).unwrap();
        fetch(&a, None).unwrap();
        assert_eq!(merge(&a).unwrap().kind, "fast");
        assert!(get(&a, "only-b.md").is_some());
    }

    #[test]
    fn a_push_behind_the_remote_is_refused() {
        let (_t, _bare, a, b) = rig("behind");
        put(&a, "new-a.md", "a\n");
        commit(&a, "a").unwrap();
        push(&a, None).unwrap();
        put(&b, "new-b.md", "b\n");
        commit(&b, "b").unwrap();
        assert!(push(&b, None).is_err(), "not a fast-forward");
        fetch(&b, None).unwrap();
        assert_eq!(merge(&b).unwrap().kind, "merged");
        push(&b, None).unwrap();
    }

    #[test]
    fn clone_refuses_a_folder_with_files() {
        let (t, bare, _a, _b) = rig("full");
        let c = t.path("c");
        std::fs::create_dir_all(&c).unwrap();
        put(&c, "x.md", "x\n");
        assert_eq!(clone(&bare, None, &c).unwrap_err(), "not an empty folder");
        let d = t.path("d");
        std::fs::create_dir_all(&d).unwrap();
        clone(&bare, None, &d).unwrap();
        assert!(get(&d, "german.md").is_some());
    }
}
